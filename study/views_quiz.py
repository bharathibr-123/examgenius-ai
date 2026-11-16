from datetime import date

from django.utils import timezone
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response

from academics.models import Subject, Topic
from . import engine, quizlib
from .models import Mistake, Question, Quiz
from .views_common import AIThrottle


def _topics_for(request, subject):
    ids = request.data.get("topic_ids") or []
    unit_ids = request.data.get("unit_ids") or []
    qs = Topic.objects.filter(unit__subject=subject)
    if ids:
        qs = qs.filter(id__in=[int(i) for i in ids])
    elif unit_ids:
        qs = qs.filter(unit_id__in=[int(i) for i in unit_ids])
    return list(qs.select_related("unit"))


@api_view(["POST"])
@throttle_classes([AIThrottle])
def create_quiz(request):
    d = request.data
    subject = Subject.objects.get(id=int(d.get("subject_id")))
    topics = _topics_for(request, subject)
    if not topics:
        return Response({"detail": "Choose at least one topic or module."}, status=400)
    try:
        n = max(1, min(15, int(d.get("count", 5))))
    except (TypeError, ValueError):
        return Response({"detail": "Number of questions must be a number."}, status=400)
    difficulty = d.get("difficulty", "adaptive")
    if difficulty not in ("easy", "medium", "hard", "adaptive"):
        return Response({"detail": "Invalid difficulty."}, status=400)
    types = d.get("types") or ["mcq"]
    if len(topics) > 12:  # keep prompts small: pick highest-priority topics
        topics = sorted(topics, key=lambda t: -t.importance)[:12]
    quiz = quizlib.build_quiz(request.user, subject, topics, n, types, difficulty)
    return Response(quizlib.serialize_quiz(quiz), status=201)


@api_view(["POST"])
@throttle_classes([AIThrottle])
def create_mock(request):
    """Exam Hall Simulator: timed, mixed objective + descriptive, no hints, feedback after submit."""
    d = request.data
    subject = Subject.objects.get(id=int(d.get("subject_id")))
    topics = _topics_for(request, subject)
    if not topics:
        topics = list(Topic.objects.filter(unit__subject=subject))
    try:
        duration = max(5, min(180, int(d.get("duration_min", 30))))
        n = max(4, min(15, int(d.get("count", 8))))
    except (TypeError, ValueError):
        return Response({"detail": "Invalid duration or count."}, status=400)
    topics = sorted(topics, key=lambda t: -t.importance)[:12]
    quiz = quizlib.build_quiz(request.user, subject, topics, n, ["mcq", "fill", "short"], "adaptive", kind="mock",
                              title=f"{subject.short} Mock Exam - {duration} min", duration=duration, short_marks=5)
    return Response(quizlib.serialize_quiz(quiz), status=201)


@api_view(["GET"])
def quiz_list(request):
    qs = Quiz.objects.filter(user=request.user, submitted_at__isnull=False).exclude(kind__in=["evaluator"])
    kind = request.GET.get("kind")
    if kind:
        qs = qs.filter(kind=kind)
    return Response({"quizzes": [{"id": q.id, "title": q.title, "kind": q.kind, "subject": q.subject.short if q.subject else "",
                                  "percent": q.percent, "score": q.score, "max_score": q.max_score,
                                  "submitted_at": q.submitted_at, "questions": q.questions.count()} for q in qs[:100]]})


@api_view(["GET", "DELETE"])
def quiz_detail(request, pk):
    quiz = Quiz.objects.get(pk=pk, user=request.user)
    if request.method == "DELETE":
        if quiz.submitted_at:
            return Response({"detail": "Submitted quizzes are part of your history and can be removed in Settings > Privacy."}, status=400)
        quiz.delete()
        return Response({"ok": True})
    return Response(quizlib.serialize_quiz(quiz, reveal=True))


@api_view(["POST"])
@throttle_classes([AIThrottle])
def submit_quiz(request, pk):
    quiz = Quiz.objects.get(pk=pk, user=request.user)
    if quiz.submitted_at:
        return Response({"detail": "This quiz was already submitted."}, status=400)
    if quiz.kind == "viva":
        return Response({"detail": "Use the viva screen to answer viva questions."}, status=400)
    responses = {}
    for a in request.data.get("answers", []):
        try:
            responses[int(a.get("question_id"))] = {"response": a.get("response", ""), "confidence": a.get("confidence")}
        except (TypeError, ValueError):
            continue
    quiz = quizlib.grade_quiz(request.user, quiz, responses)
    if quiz.kind == "revision" and quiz.feedback.get("mistake_id"):
        m = Mistake.objects.filter(id=quiz.feedback["mistake_id"], user=request.user).first()
        if m:
            q = quiz.questions.first()
            ok = q.student_answer.is_correct
            engine.review_mistake(m, ok)
            quiz.feedback["revision"] = {
                "correct": ok, "next_due": m.due_date.isoformat(), "resolved": m.resolved,
                "message": ("Resolved - you have mastered this one!" if m.resolved else
                            f"Correct! Next review on {m.due_date:%d %b}." if ok else
                            "Not yet - it comes back tomorrow.")}
            quiz.save(update_fields=["feedback"])
    return Response(quizlib.serialize_quiz(quiz, reveal=True))


# ------------------------------------------------------------------ Mistake Memory + Revision Time Machine
@api_view(["GET"])
def mistakes(request):
    qs = Mistake.objects.filter(user=request.user).select_related("topic__unit__subject")
    status = request.GET.get("status", "open")
    if status == "open":
        qs = qs.filter(resolved=False)
    elif status == "resolved":
        qs = qs.filter(resolved=True)
    subj = request.GET.get("subject_id")
    if subj:
        qs = qs.filter(topic__unit__subject_id=int(subj))
    today = date.today()
    return Response({
        "mistakes": [{"id": m.id, "topic": m.topic.name if m.topic else "", "topic_id": m.topic_id,
                      "subject": m.topic.subject.short if m.topic else "", "type": m.qtype,
                      "question": m.question_text, "options": m.options, "your_answer": m.your_answer,
                      "correct_answer": m.correct_answer, "explanation": m.explanation,
                      "created_at": m.created_at, "due_date": m.due_date, "due": m.due_date <= today and not m.resolved,
                      "step": m.step, "interval_days": Mistake.INTERVALS[min(m.step, 4)], "revisions": m.revisions,
                      "last_result": m.last_result, "resolved": m.resolved} for m in qs[:200]],
        "counts": {"open": Mistake.objects.filter(user=request.user, resolved=False).count(),
                   "due": Mistake.objects.filter(user=request.user, resolved=False, due_date__lte=today).count(),
                   "resolved": Mistake.objects.filter(user=request.user, resolved=True).count()},
    })


@api_view(["POST"])
def revise_mistake(request, pk):
    """Re-ask the saved question (no AI cost) as a 1-question revision quiz."""
    m = Mistake.objects.get(pk=pk, user=request.user)
    quiz = Quiz.objects.create(user=request.user, subject=m.topic.subject if m.topic else None, kind="revision",
                               title=f"Revision: {m.topic.name if m.topic else 'question'}", difficulty="medium",
                               started_at=timezone.now(), feedback={"mistake_id": m.id})
    Question.objects.create(quiz=quiz, topic=m.topic, qtype=m.qtype, text=m.question_text, options=m.options,
                            answer=m.correct_answer, accept=m.accept, marks=m.marks, explanation=m.explanation,
                            key_points=m.source_answer.question.key_points if m.source_answer else [])
    return Response(quizlib.serialize_quiz(quiz), status=201)


@api_view(["GET"])
def revision_queue(request):
    return Response({"queue": engine.revision_queue(request.user),
                     "intervals": Mistake.INTERVALS,
                     "rule": "Correct on review: next interval (1, 3, 7, 14, 30 days). Wrong: back to 1 day."})
