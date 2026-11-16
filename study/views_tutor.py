from django.utils import timezone
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response

from academics.models import Subject, Topic
from . import ai, engine, prompts, quizlib
from .models import Answer, AnswerEvaluation, Conversation, Message, Question, Quiz, TopicMastery, TopicNote
from .schemas import EvaluationOut, NotesOut, VivaSummaryOut, VivaTurnOut
from .views_common import AIThrottle

HISTORY = 8


def _conv_payload(c, messages=True):
    out = {"id": c.id, "title": c.title, "mode": c.mode, "kind": c.kind,
           "subject_id": c.subject_id, "subject": c.subject.short if c.subject else None,
           "topic_id": c.topic_id, "topic": c.topic.name if c.topic else None, "updated_at": c.updated_at}
    if messages:
        out["messages"] = [{"id": m.id, "role": m.role, "content": m.content, "meta": m.meta, "created_at": m.created_at}
                           for m in c.messages.all()]
    return out


@api_view(["GET", "POST"])
def conversations(request):
    if request.method == "POST":
        d = request.data
        subj = Subject.objects.filter(id=d.get("subject_id")).first() if d.get("subject_id") else None
        topic = Topic.objects.filter(id=d.get("topic_id")).first() if d.get("topic_id") else None
        if topic and not subj:
            subj = topic.subject
        mode = d.get("mode") or getattr(getattr(request.user, "profile", None), "default_mode", "exam")
        c = Conversation.objects.create(user=request.user, subject=subj, topic=topic, mode=mode,
                                        title=(f"{topic.name}" if topic else "New conversation"))
        return Response(_conv_payload(c), status=201)
    qs = Conversation.objects.filter(user=request.user, kind="tutor").select_related("subject", "topic")
    return Response({"conversations": [_conv_payload(c, messages=False) for c in qs[:60]]})


@api_view(["GET", "DELETE", "PATCH"])
def conversation_detail(request, pk):
    c = Conversation.objects.get(pk=pk, user=request.user)
    if request.method == "DELETE":
        c.delete()
        return Response({"ok": True})
    if request.method == "PATCH":
        d = request.data
        if "mode" in d and d["mode"] in prompts.MODES:
            c.mode = d["mode"]
        if "subject_id" in d:
            c.subject = Subject.objects.filter(id=d["subject_id"]).first() if d["subject_id"] else None
            c.topic = None
        if "topic_id" in d:
            c.topic = Topic.objects.filter(id=d["topic_id"]).first() if d["topic_id"] else None
            if c.topic:
                c.subject = c.topic.subject
        c.save()
    return Response(_conv_payload(c))


@api_view(["POST"])
@throttle_classes([AIThrottle])
def send_message(request, pk):
    c = Conversation.objects.get(pk=pk, user=request.user)
    content = str(request.data.get("content", "")).strip()
    if not content:
        return Response({"detail": "Type a question first."}, status=400)
    if len(content) > 4000:
        return Response({"detail": "Message is too long (max 4000 characters)."}, status=400)
    mode = request.data.get("mode") or c.mode
    if mode not in prompts.MODES:
        mode = "exam"
    marks = request.data.get("marks")
    marks = int(marks) if str(marks) in ("2", "5", "10") else None
    simplify = bool(c.topic and TopicMastery.objects.filter(user=request.user, topic=c.topic, simplify_next=True).exists())
    system = prompts.tutor_system(request.user, c.subject, c.topic, mode, simplify)
    history = [{"role": m.role, "content": m.content} for m in c.messages.order_by("-created_at")[:HISTORY]][::-1]
    user_text = content + (f"\n\n[{prompts.MARKS[marks]}]" if marks else "")
    reply = ai.chat(request.user, "tutor", [{"role": "system", "content": system}, *history,
                                            {"role": "user", "content": user_text}],
                    max_tokens=1400 if marks == 10 or mode == "detailed" else 900, temperature=0.5)
    Message.objects.create(conversation=c, role="user", content=content, meta={"mode": mode, "marks": marks})
    msg = Message.objects.create(conversation=c, role="assistant", content=reply,
                                 meta={"mode": mode, "marks": marks, "simplified": simplify})
    if c.title in ("New conversation", "") or c.messages.count() <= 2:
        c.title = content[:70] + ("…" if len(content) > 70 else "")
    c.mode = mode
    c.save()
    if simplify:
        TopicMastery.objects.filter(user=request.user, topic=c.topic).update(simplify_next=False)
    engine.log_activity(request.user, "tutor", f"Asked the AI tutor: {content[:80]}", f"/tutor/{c.id}")
    return Response({"message": {"id": msg.id, "role": "assistant", "content": reply, "meta": msg.meta,
                                 "created_at": msg.created_at}, "conversation": _conv_payload(c, messages=False)})


@api_view(["POST"])
@throttle_classes([AIThrottle])
def doubt_check(request, pk):
    """Doubt-to-Mastery: turn the conversation into 2 practice questions that update topic mastery."""
    c = Conversation.objects.get(pk=pk, user=request.user)
    msgs = list(c.messages.order_by("-created_at")[:4])[::-1]
    if not msgs:
        return Response({"detail": "Ask a doubt first, then check your understanding."}, status=400)
    if c.topic:
        topics = [c.topic]
        subject = c.subject
    elif c.subject:
        subject = c.subject
        topics = list(Topic.objects.filter(unit__subject=subject))
    else:
        return Response({"detail": "Pick a subject for this chat (top of the chat) so the check can update your mastery."}, status=400)
    context = "\n".join(f"{m.role}: {m.content[:1500]}" for m in msgs)
    quiz = quizlib.build_quiz(request.user, subject, topics[:20], 2, ["mcq", "short"], "adaptive", kind="doubt",
                              context="Test the student's understanding of what was explained in this tutoring conversation "
                                      "(pick the single best-matching topic id):\n" + context,
                              title=f"Doubt check: {c.title[:60]}")
    quiz.feedback = {"conversation_id": c.id}
    quiz.save(update_fields=["feedback"])
    return Response(quizlib.serialize_quiz(quiz), status=201)


# ------------------------------------------------------------------ Smart topic notes (no upload needed)
@api_view(["GET", "POST"])
@throttle_classes([AIThrottle])
def topic_notes(request, pk):
    topic = Topic.objects.select_related("unit__subject").get(pk=pk)
    style = request.data.get("style") if request.method == "POST" else request.GET.get("style", "short")
    style = style if style in ("short", "detailed") else "short"
    note = TopicNote.objects.filter(user=request.user, topic=topic, style=style).first()
    if request.method == "GET":
        return Response({"topic": topic.name, "style": style, "notes": note.content if note else None,
                         "created_at": note.created_at if note else None})
    if note and not request.data.get("regenerate"):
        return Response({"topic": topic.name, "style": style, "notes": note.content, "created_at": note.created_at})
    out: NotesOut = ai.chat(request.user, "notes", [
        {"role": "system", "content": "You are an expert lecturer who writes precise exam revision notes. Reply only with JSON. "
                                      + prompts.profile_context(request.user)},
        {"role": "user", "content": prompts.notes_prompt(topic, style)}],
        schema=NotesOut, max_tokens=2200 if style == "detailed" else 1500, temperature=0.3,
        cache=not request.data.get("regenerate"))
    note, _ = TopicNote.objects.update_or_create(user=request.user, topic=topic, style=style,
                                                 defaults={"content": out.model_dump()})
    engine.log_activity(request.user, "notes", f"Generated {style} notes: {topic.name}", f"/subjects/{topic.subject.id}")
    return Response({"topic": topic.name, "style": style, "notes": note.content, "created_at": note.created_at})


# ------------------------------------------------------------------ AI Answer Evaluator
@api_view(["GET", "POST"])
@throttle_classes([AIThrottle])
def evaluate_answer(request):
    if request.method == "GET":
        return Response({"evaluations": [{"id": e.id, "question": e.question, "marks": e.marks,
                                          "estimated": e.result.get("estimated_marks"), "created_at": e.created_at,
                                          "subject": e.subject.short if e.subject else None}
                                         for e in AnswerEvaluation.objects.filter(user=request.user)[:30]]})
    d = request.data
    question, answer = str(d.get("question", "")).strip(), str(d.get("answer", "")).strip()
    try:
        marks = int(d.get("marks", 5))
    except (TypeError, ValueError):
        marks = 0
    if marks not in (2, 5, 10):
        return Response({"detail": "Marks must be 2, 5 or 10."}, status=400)
    if len(question) < 8:
        return Response({"detail": "Enter the exam question."}, status=400)
    if len(answer) < 10:
        return Response({"detail": "Write your answer (at least a sentence) before evaluating."}, status=400)
    subject = Subject.objects.filter(id=d.get("subject_id")).first() if d.get("subject_id") else None
    topic = Topic.objects.filter(id=d.get("topic_id")).first() if d.get("topic_id") else None
    out: EvaluationOut = ai.chat(request.user, "evaluator", [
        {"role": "system", "content": "You are a strict but fair university examiner. Reply only with JSON."},
        {"role": "user", "content": prompts.evaluation_prompt(question, marks, answer[:6000], subject)}],
        schema=EvaluationOut, max_tokens=1800 if marks == 10 else 1200, temperature=0.1)
    result = out.model_dump()
    result["estimated_marks"] = max(0.0, min(float(marks), round(out.estimated_marks * 2) / 2))
    result["max_marks"] = marks
    result["disclaimer"] = "AI-generated practice estimate - not official university grading."
    ev = AnswerEvaluation.objects.create(user=request.user, subject=subject or (topic.subject if topic else None),
                                         topic=topic, question=question, marks=marks, answer=answer, result=result)
    if topic:  # counts as mastery evidence
        quiz = Quiz.objects.create(user=request.user, subject=topic.subject, kind="evaluator", title=f"Evaluated answer: {topic.name}",
                                   started_at=timezone.now(), submitted_at=timezone.now(),
                                   score=result["estimated_marks"], max_score=marks)
        q = Question.objects.create(quiz=quiz, topic=topic, qtype="short", text=question, answer=out.model_answer,
                                    marks=marks, key_points=out.missing_points[:6], difficulty=engine.topic_level(request.user, topic))
        a = Answer.objects.create(question=q, response=answer, is_correct=result["estimated_marks"] >= marks / 2,
                                  marks_awarded=result["estimated_marks"], feedback="; ".join(out.improvements[:3]))
        result["events"] = engine.record_answer_effects(request.user, a)
    engine.log_activity(request.user, "evaluator", f"Answer evaluated: {result['estimated_marks']}/{marks} - {question[:60]}", "/evaluator")
    return Response({"id": ev.id, **result})


# ------------------------------------------------------------------ AI Viva Examiner
def _viva_state(quiz):
    turns = []
    for q in quiz.questions.select_related("topic"):
        a = getattr(q, "student_answer", None)
        turns.append({"question_id": q.id, "question": q.text, "topic": q.topic.name if q.topic else "",
                      "answer": a.response if a else None, "score": a.marks_awarded if a else None,
                      "feedback": a.feedback if a else None, "ideal_answer": q.explanation if a else None})
    fb = quiz.feedback or {}
    return {"id": quiz.id, "title": quiz.title, "subject": quiz.subject.name if quiz.subject else "",
            "total": fb.get("total", 5), "turns": turns, "finished": bool(quiz.submitted_at),
            "score": quiz.score, "max_score": quiz.max_score, "summary": fb.get("summary")}


@api_view(["GET", "POST"])
@throttle_classes([AIThrottle])
def viva_start(request):
    if request.method == "GET":
        return Response({"sessions": [{"id": q.id, "title": q.title, "percent": q.percent, "submitted_at": q.submitted_at,
                                       "created_at": q.created_at}
                                      for q in Quiz.objects.filter(user=request.user, kind="viva")[:20]]})
    d = request.data
    subject = Subject.objects.get(id=int(d.get("subject_id")))
    ids = d.get("topic_ids") or []
    topics = list(Topic.objects.filter(unit__subject=subject, **({"id__in": ids} if ids else {})))
    topics = sorted(topics, key=lambda t: -t.importance)[:12]
    total = max(3, min(8, int(d.get("questions", 5))))
    turn: VivaTurnOut = ai.chat(request.user, "viva", [
        {"role": "system", "content": "You are an examiner conducting a viva. Reply only with JSON."},
        {"role": "user", "content": prompts.viva_prompt(subject, topics, [], 1, total)}],
        schema=VivaTurnOut, max_tokens=400, temperature=0.6, cache=False)
    if not turn.next_question.strip():
        raise ai.AIError("bad_output", "no viva question")
    tmap = {t.id: t for t in topics}
    quiz = Quiz.objects.create(user=request.user, subject=subject, kind="viva", title=f"{subject.short} viva",
                               started_at=timezone.now(), feedback={"total": total, "topic_ids": [t.id for t in topics]})
    Question.objects.create(quiz=quiz, topic=tmap.get(turn.topic_id, topics[0]), qtype="short", text=turn.next_question,
                            answer="", marks=10, order=0, difficulty=engine.topic_level(request.user, tmap.get(turn.topic_id, topics[0])))
    return Response(_viva_state(quiz), status=201)


@api_view(["GET", "POST"])
@throttle_classes([AIThrottle])
def viva_turn(request, pk):
    quiz = Quiz.objects.get(pk=pk, user=request.user, kind="viva")
    if request.method == "GET":
        return Response(_viva_state(quiz))
    if quiz.submitted_at:
        return Response({"detail": "This viva is finished."}, status=400)
    answer = str(request.data.get("answer", "")).strip()[:3000]
    if not answer:
        return Response({"detail": "Type your answer (or 'I don't know')."}, status=400)
    fb = quiz.feedback or {}
    total = fb.get("total", 5)
    topics = list(Topic.objects.filter(id__in=fb.get("topic_ids", [])))
    tmap = {t.id: t for t in topics}
    qs = list(quiz.questions.select_related("topic"))
    current = qs[-1]
    history = [{"topic_id": q.topic_id, "question": q.text,
                "answer": q.student_answer.response if hasattr(q, "student_answer") else answer} for q in qs]
    next_no = len(qs) + 1
    turn: VivaTurnOut = ai.chat(request.user, "viva", [
        {"role": "system", "content": "You are an examiner conducting a viva. Reply only with JSON."},
        {"role": "user", "content": prompts.viva_prompt(quiz.subject, topics, history, next_no, total)}],
        schema=VivaTurnOut, max_tokens=700, temperature=0.4, cache=False)
    score = max(0.0, min(10.0, float(turn.score if turn.score is not None else 0)))
    current.explanation = turn.ideal_answer
    current.answer = turn.ideal_answer
    current.save(update_fields=["explanation", "answer"])
    a = Answer.objects.create(question=current, response=answer, is_correct=score >= 5, marks_awarded=score,
                              feedback=turn.feedback)
    engine.record_answer_effects(request.user, a)
    if next_no <= total and turn.next_question.strip():
        t = tmap.get(turn.topic_id) or (topics[0] if topics else current.topic)
        Question.objects.create(quiz=quiz, topic=t, qtype="short", text=turn.next_question, answer="", marks=10,
                                order=next_no - 1, difficulty=engine.topic_level(request.user, t) if t else "medium")
    else:
        hist = [{"question": q.text, "answer": q.student_answer.response, "score": q.student_answer.marks_awarded}
                for q in quiz.questions.all() if hasattr(q, "student_answer")]
        summary: VivaSummaryOut = ai.chat(request.user, "viva", [
            {"role": "system", "content": "You summarise viva performance. Reply only with JSON."},
            {"role": "user", "content": prompts.viva_summary_prompt(quiz.subject, hist)}],
            schema=VivaSummaryOut, max_tokens=400, temperature=0.3)
        quiz.score = sum(h["score"] for h in hist)
        quiz.max_score = 10 * len(hist)
        quiz.submitted_at = timezone.now()
        quiz.feedback = {**fb, "summary": summary.model_dump()}
        quiz.save()
        engine.log_activity(request.user, "viva", f"Completed {quiz.title}: {quiz.percent}%", f"/viva/{quiz.id}")
    quiz.refresh_from_db()
    return Response(_viva_state(quiz))
