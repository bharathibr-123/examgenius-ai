from django.http import FileResponse, Http404
from django.views.decorators.clickjacking import xframe_options_sameorigin
from rest_framework.decorators import api_view, parser_classes, throttle_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from academics.models import Subject, Topic
from . import ai, engine, prompts, quizlib, rag
from .models import Conversation, Document, Message
from .schemas import DocAnswerOut, DocSummaryOut
from .views_common import AIThrottle


def _doc(d, full=False):
    out = {"id": d.id, "title": d.title, "pages": d.pages, "status": d.status, "retrieval": d.retrieval,
           "subject_id": d.subject_id, "subject": d.subject.short if d.subject else None,
           "created_at": d.created_at, "url": f"/api/documents/{d.id}/file/", "has_summary": bool(d.summary)}
    if full:
        out["summary"] = d.summary
        out["chunks"] = d.chunks.count()
        conv = Conversation.objects.filter(document=d, kind="doc").first()
        out["qa"] = [{"role": m.role, "content": m.content, "meta": m.meta} for m in conv.messages.all()] if conv else []
    return out


@api_view(["GET", "POST"])
@parser_classes([MultiPartParser, FormParser, JSONParser])
@throttle_classes([AIThrottle])
def documents(request):
    if request.method == "GET":
        return Response({"documents": [_doc(d) for d in Document.objects.filter(user=request.user).select_related("subject")]})
    f = request.FILES.get("file")
    if not f:
        return Response({"detail": "Choose a PDF file to upload."}, status=400)
    rag.validate_pdf(f)
    subject = Subject.objects.filter(id=request.data.get("subject_id")).first() if request.data.get("subject_id") else None
    if not subject:
        return Response({"detail": "Choose the subject these notes belong to."}, status=400)
    title = (request.data.get("title") or f.name.rsplit(".", 1)[0])[:200]
    doc = Document.objects.create(user=request.user, subject=subject, title=title, file=f)
    try:
        rag.ingest(request.user, doc)
    except rag.PDFError:
        doc.delete()
        raise
    engine.log_activity(request.user, "document", f"Uploaded notes: {doc.title} ({doc.pages} pages)", f"/notes/{doc.id}")
    return Response(_doc(doc, full=True), status=201)


@api_view(["GET", "DELETE"])
def document_detail(request, pk):
    doc = Document.objects.get(pk=pk, user=request.user)
    if request.method == "DELETE":
        doc.delete()
        return Response({"ok": True})
    return Response(_doc(doc, full=True))


@api_view(["GET"])
def document_page(request, pk, page):
    doc = Document.objects.get(pk=pk, user=request.user)
    chunks = doc.chunks.filter(page=page).order_by("id")
    text = ""
    for c in chunks:  # merge overlapping chunks
        text = c.text if not text else text + c.text[rag.OVERLAP:]
    return Response({"page": page, "pages": doc.pages, "text": text})


@api_view(["POST"])
@throttle_classes([AIThrottle])
def document_summary(request, pk):
    doc = Document.objects.get(pk=pk, user=request.user)
    if doc.status != "ready":
        return Response({"detail": "No text could be extracted from this PDF (it may be scanned images)."}, status=400)
    style = request.data.get("style", "short")
    style = style if style in ("short", "detailed") else "short"
    out: DocSummaryOut = ai.chat(request.user, "doc_summary", [
        {"role": "system", "content": "You turn study material into exam revision notes. Use only the given document. Reply only with JSON."},
        {"role": "user", "content": prompts.doc_summary_prompt(doc.title, rag.document_text(doc), style)}],
        schema=DocSummaryOut, max_tokens=2200, temperature=0.2)
    doc.summary = {**(doc.summary or {}), style: out.model_dump()}
    doc.save(update_fields=["summary"])
    engine.log_activity(request.user, "notes", f"Summarised {doc.title}", f"/notes/{doc.id}")
    return Response(_doc(doc, full=True))


@api_view(["POST"])
@throttle_classes([AIThrottle])
def document_ask(request, pk):
    doc = Document.objects.get(pk=pk, user=request.user)
    question = str(request.data.get("question", "")).strip()[:1500]
    if len(question) < 3:
        return Response({"detail": "Type a question about your notes."}, status=400)
    chunks, method = rag.retrieve(request.user, doc, question, k=5)
    conv, _ = Conversation.objects.get_or_create(user=request.user, document=doc, kind="doc",
                                                 defaults={"title": f"Q&A: {doc.title}", "subject": doc.subject})
    if not chunks:
        answer = {"found": False, "answer": "Your uploaded notes don't seem to contain anything about this question. "
                                            "Try rephrasing, or ask the AI Tutor for a general explanation.", "citations": []}
    else:
        srcs = [{"page": c.page, "text": c.text} for c in chunks]
        out: DocAnswerOut = ai.chat(request.user, "doc_qa", [
            {"role": "system", "content": "You answer strictly from the provided sources and cite them. Reply only with JSON."},
            {"role": "user", "content": prompts.doc_answer_prompt(question, srcs)}],
            schema=DocAnswerOut, max_tokens=900, temperature=0.1)
        used = sorted({s for s in out.sources if 1 <= s <= len(chunks)}) if out.found else []
        citations = [{"source": s, "file": doc.title, "page": chunks[s - 1].page,
                      "excerpt": chunks[s - 1].text[:220]} for s in used]
        answer = {"found": out.found and bool(citations), "answer": out.answer, "citations": citations}
    Message.objects.create(conversation=conv, role="user", content=question)
    Message.objects.create(conversation=conv, role="assistant", content=answer["answer"],
                           meta={"found": answer["found"], "citations": answer["citations"], "retrieval": method})
    return Response({**answer, "retrieval": method})


@api_view(["POST"])
@throttle_classes([AIThrottle])
def document_quiz(request, pk):
    doc = Document.objects.get(pk=pk, user=request.user)
    if not doc.subject:
        return Response({"detail": "This document has no subject."}, status=400)
    topics = list(Topic.objects.filter(unit__subject=doc.subject))
    try:
        n = max(3, min(10, int(request.data.get("count", 5))))
    except (TypeError, ValueError):
        n = 5
    quiz = quizlib.build_quiz(request.user, doc.subject, sorted(topics, key=lambda t: -t.importance)[:15], n,
                              request.data.get("types") or ["mcq", "tf", "fill"], "medium",
                              context="Questions must be answerable from this document (match each to the closest topic id):\n"
                                      + rag.document_text(doc, 8000),
                              title=f"Quiz from {doc.title}")
    return Response(quizlib.serialize_quiz(quiz), status=201)


@xframe_options_sameorigin
def document_file(request, pk):
    """Serve a PDF only to its owner (files are never publicly reachable)."""
    if not request.user.is_authenticated:
        raise Http404
    doc = Document.objects.filter(pk=pk, user=request.user).first()
    if not doc:
        raise Http404
    resp = FileResponse(doc.file.open("rb"), content_type="application/pdf")
    resp["Content-Disposition"] = f'inline; filename="{doc.title[:80]}.pdf"'
    return resp
