"""New features: VTU question paper generator, focus timer, achievements."""
from datetime import date, timedelta

from django.utils import timezone
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response

from academics.models import Subject, Topic
from . import ai, engine, prompts
from .models import (Activity, AnswerEvaluation, Document, FocusSession, Mistake, QuestionPaper, Quiz, StudyPlan,
                     StudyTask, TopicMastery, TopicNote)
from .schemas import PaperOut
from .views_common import AIThrottle


# ------------------------------------------------------------------ VTU model question paper
def _fix_paper(out: PaperOut, subject, units):
    """Validate & normalise: 2 questions per module, parts lettered a-c, marks summing to 20."""
    valid_topics = {t.id: t.name for t in Topic.objects.filter(unit__subject=subject)}
    by_module = {m.module: m for m in out.modules}
    modules, qno = [], 1
    for u in units:
        m = by_module.get(u.number)
        if not m:
            continue
        qs = []
        for q in m.questions[:2]:
            parts = q.parts[:3]
            total = sum(p.marks for p in parts) or 1
            scaled = [max(1, round(p.marks * 20 / total)) for p in parts]
            scaled[-1] += 20 - sum(scaled)  # make the marks add up to exactly 20
            qs.append({"number": qno, "parts": [{
                "part": "abc"[i], "text": p.text.strip(), "marks": scaled[i],
                "level": p.level if p.level in ("L1", "L2", "L3", "L4", "L5", "L6") else "L2",
                "topic": valid_topics.get(p.topic_id, ""), "answer_outline": p.answer_outline.strip()}
                for i, p in enumerate(parts)]})
            qno += 1
        if len(qs) == 2:
            modules.append({"module": u.number, "title": u.title, "questions": qs})
    if not modules:
        raise ai.AIError("bad_output", "paper had no usable modules")
    return modules


@api_view(["GET", "POST"])
@throttle_classes([AIThrottle])
def papers(request):
    if request.method == "GET":
        return Response({"papers": [{"id": p.id, "subject": p.subject.name, "code": p.subject.code,
                                     "modules": len(p.content["modules"]), "created_at": p.created_at}
                                    for p in QuestionPaper.objects.filter(user=request.user).select_related("subject")[:30]]})
    subject = Subject.objects.get(id=int(request.data.get("subject_id")))
    units = list(subject.units.prefetch_related("topics"))
    if not units:
        return Response({"detail": "This subject has no modules yet."}, status=400)
    out: PaperOut = ai.chat(request.user, "question_paper", [
        {"role": "system", "content": "You are a senior VTU question paper setter. Reply only with JSON."},
        {"role": "user", "content": prompts.paper_prompt(subject, units)}],
        schema=PaperOut, max_tokens=3800, temperature=0.6, cache=False)
    modules = _fix_paper(out, subject, units)
    paper = QuestionPaper.objects.create(user=request.user, subject=subject, content={
        "subject": subject.name, "code": subject.code, "semester": subject.semester,
        "max_marks": 20 * len(modules), "duration": "3 Hours", "modules": modules,
        "note": f"Answer any FIVE full questions, choosing ONE full question from each module." if len(modules) == 5
        else f"Answer any {len(modules)} full questions, choosing ONE full question from each module."})
    engine.log_activity(request.user, "paper", f"Generated a model question paper: {subject.short}", f"/papers/{paper.id}")
    return Response({"id": paper.id, **paper.content, "created_at": paper.created_at}, status=201)


@api_view(["GET", "DELETE"])
def paper_detail(request, pk):
    p = QuestionPaper.objects.get(pk=pk, user=request.user)
    if request.method == "DELETE":
        p.delete()
        return Response({"ok": True})
    return Response({"id": p.id, **p.content, "created_at": p.created_at})


# ------------------------------------------------------------------ Focus timer
@api_view(["GET", "POST"])
def focus(request):
    if request.method == "GET":
        today = timezone.localdate()
        qs = FocusSession.objects.filter(user=request.user)
        week = qs.filter(completed_at__date__gte=today - timedelta(days=6))
        return Response({"today_minutes": sum(qs.filter(completed_at__date=today).values_list("minutes", flat=True)),
                         "week_minutes": sum(week.values_list("minutes", flat=True)),
                         "sessions": qs.count()})
    try:
        minutes = int(request.data.get("minutes", 0))
    except (TypeError, ValueError):
        minutes = 0
    if not 1 <= minutes <= 240:
        return Response({"detail": "A focus session must be between 1 and 240 minutes."}, status=400)
    task = None
    if request.data.get("task_id"):
        task = StudyTask.objects.filter(id=request.data["task_id"], plan__user=request.user).first()
    label = (task.title if task else str(request.data.get("label") or "Focus session"))[:200]
    FocusSession.objects.create(user=request.user, task=task, minutes=minutes, label=label)
    if task and request.data.get("complete_task", True):
        task.status, task.completed_at = "done", timezone.now()
        task.save(update_fields=["status", "completed_at"])
    engine.log_activity(request.user, "focus", f"Focused {minutes} min: {label}", "/planner")
    return Response({"ok": True, "task_done": bool(task)}, status=201)


# ------------------------------------------------------------------ Achievements (computed from real data)
def _achievements(user):
    quizzes = Quiz.objects.filter(user=user, submitted_at__isnull=False)
    practice = quizzes.exclude(kind__in=["evaluator", "viva"])
    strong = TopicMastery.objects.filter(user=user, attempts__gte=3, score__gte=70).count()
    focus_min = sum(FocusSession.objects.filter(user=user).values_list("minutes", flat=True))
    streak = engine.study_streak(user)
    best = max((q.percent for q in practice), default=0)
    defs = [
        ("first_steps", "First Steps", "Complete your first quiz", "Rocket", practice.count(), 1),
        ("quiz_master", "Quiz Master", "Complete 10 quizzes", "Trophy", practice.count(), 10),
        ("perfect", "Perfectionist", "Score 100% on a quiz", "Star", 1 if best >= 100 else 0, 1),
        ("on_fire", "On Fire", "Study 3 days in a row", "Flame", streak, 3),
        ("unstoppable", "Unstoppable", "Study 7 days in a row", "Zap", streak, 7),
        ("topic_tamer", "Topic Tamer", "Reach Strong mastery in 5 topics", "Target", strong, 5),
        ("comeback", "Comeback Kid", "Master a mistake from Mistake Memory", "RotateCcw",
         Mistake.objects.filter(user=user, resolved=True).count(), 1),
        ("reviser", "Time Traveller", "Complete 5 spaced-repetition revisions", "History",
         quizzes.filter(kind="revision").count(), 5),
        ("orator", "Viva Voice", "Complete an AI viva", "Mic", quizzes.filter(kind="viva").count(), 1),
        ("exam_ready", "Exam Hall Hero", "Finish a timed mock exam", "Timer", quizzes.filter(kind="mock").count(), 1),
        ("writer", "Answer Architect", "Get 3 answers evaluated", "PenLine", AnswerEvaluation.objects.filter(user=user).count(), 3),
        ("planner", "Master Planner", "Create a study plan", "CalendarCheck", StudyPlan.objects.filter(user=user).count(), 1),
        ("focused", "Deep Focus", "Log 120 minutes in focus mode", "Hourglass", focus_min, 120),
        ("librarian", "Librarian", "Upload notes or generate 3 topic notes", "Library",
         Document.objects.filter(user=user).count() + TopicNote.objects.filter(user=user).count(), 3),
        ("curious", "Curious Mind", "Ask the AI tutor 10 questions", "MessageCircleQuestion",
         Activity.objects.filter(user=user, kind="tutor").count(), 10),
    ]
    return [{"id": i, "title": t, "description": d, "icon": ic, "progress": min(v, goal), "goal": goal,
             "earned": v >= goal} for i, t, d, ic, v, goal in defs]


@api_view(["GET"])
def achievements(request):
    items = _achievements(request.user)
    earned = sum(a["earned"] for a in items)
    level = 1 + earned // 2
    return Response({"achievements": items, "earned": earned, "total": len(items), "level": level,
                     "xp": earned * 100 + sum(a["progress"] for a in items if not a["earned"]) * 10})
