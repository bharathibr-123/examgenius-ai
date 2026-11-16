from collections import defaultdict
from datetime import date, timedelta

from django.conf import settings
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from academics.models import Enrollment, Subject
from . import engine, planner
from .ai import ai_configured
from .models import (Activity, AIUsageLog, FocusSession, Answer, AnswerEvaluation, Conversation, Document, Message, Mistake, Quiz,
                     StudyPlan, StudyTask, TopicMastery, TopicNote)


@api_view(["GET"])
@permission_classes([AllowAny])
def ai_status(request):
    return Response({"configured": ai_configured(), "provider": settings.AI_PROVIDER,
                     "provider_label": settings.AI_PROVIDER_LABEL, "key_name": settings.AI_KEY_ENV,
                     "chat_model": settings.OPENAI_CHAT_MODEL, "embed_model": settings.OPENAI_EMBED_MODEL})


def _today_tasks(user):
    today = date.today()
    rows = StudyTask.objects.filter(plan__user=user, plan__active=True, date=today).exclude(status="skipped") \
        .select_related("plan__subject", "topic")
    return [{"id": t.id, "title": t.title, "kind": t.kind, "minutes": t.minutes, "status": t.status,
             "subject": t.plan.subject.short, "topic_id": t.topic_id, "subject_id": t.plan.subject_id} for t in rows]


@api_view(["GET"])
def dashboard(request):
    user = request.user
    for p in StudyPlan.objects.filter(user=user, active=True):
        planner.recover(p)  # Study Recovery: missed tasks are rescheduled automatically
    enrollments = list(Enrollment.objects.filter(user=user).select_related("subject"))
    ready = [engine.readiness(user, e) for e in enrollments]
    upcoming = sorted([r for r in ready if r["days_left"] is not None and r["days_left"] >= 0], key=lambda r: r["days_left"])
    answers = Answer.objects.filter(question__quiz__user=user)
    n_ans = answers.count()
    objective = answers.exclude(question__qtype="short")
    acc = round(100 * objective.filter(is_correct=True).count() / objective.count(), 1) if objective.count() else None
    gaps = engine.knowledge_gaps(user)
    subjects = []
    for e in enrollments:
        avg, practised, total = engine.subject_mastery(user, e.subject)
        r = next(x for x in ready if x["subject_id"] == e.subject_id)
        subjects.append({"id": e.subject_id, "code": e.subject.code, "name": e.subject.name, "short": e.subject.short,
                         "color": e.subject.color, "icon": e.subject.icon, "mastery": avg, "practised": practised,
                         "topics": total, "exam_date": e.exam_date, "readiness": r["score"], "band": r["band"],
                         "days_left": r["days_left"]})
    overall = round(sum(r["score"] for r in ready) / len(ready), 1) if ready else 0
    return Response({
        "user": {"name": user.first_name or user.full_name, "semester": getattr(getattr(user, "profile", None), "semester", None)},
        "ai": {"configured": ai_configured()},
        "next_exam": upcoming[0] if upcoming else None,
        "overall_readiness": overall,
        "subjects": subjects,
        "today_tasks": _today_tasks(user),
        "weak_topics": gaps["weak"][:4], "repeated_mistakes": gaps["repeated_mistakes"][:3],
        "prerequisite_gaps": gaps["prerequisite_gaps"][:3],
        "revision_due": Mistake.objects.filter(user=user, resolved=False, due_date__lte=date.today()).count(),
        "stats": {"quizzes": Quiz.objects.filter(user=user, submitted_at__isnull=False).exclude(kind="evaluator").count(),
                  "answers": n_ans, "accuracy": acc,
                  "topics_practised": TopicMastery.objects.filter(user=user, attempts__gt=0).count(),
                  "streak": engine.study_streak(user)},
        "recent": [{"kind": a.kind, "text": a.text, "link": a.link, "at": a.created_at}
                   for a in Activity.objects.filter(user=user).exclude(kind="login")[:8]],
    })


@api_view(["GET"])
def readiness(request):
    return Response({"readiness": [engine.readiness(request.user, e)
                                   for e in Enrollment.objects.filter(user=request.user).select_related("subject")],
                     "formula": "R = 0.35 M + 0.20 C + 0.15 X + 0.15 V + 0.15 P"})


@api_view(["GET"])
def gaps(request):
    subject = Subject.objects.filter(id=request.GET.get("subject_id")).first() if request.GET.get("subject_id") else None
    return Response(engine.knowledge_gaps(request.user, subject))


@api_view(["GET"])
def analytics(request):
    user = request.user
    since = timezone.now() - timedelta(days=29)
    answers = Answer.objects.filter(question__quiz__user=user).select_related("question__topic__unit__subject", "question__quiz")

    # accuracy trend per day (score fraction incl. partial marks)
    by_day = defaultdict(lambda: [0.0, 0])
    for a in answers.filter(created_at__gte=since):
        d = timezone.localtime(a.created_at).date().isoformat()
        by_day[d][0] += (a.marks_awarded / a.question.marks) if a.question.marks else float(a.is_correct)
        by_day[d][1] += 1
    trend = [{"date": d, "accuracy": round(100 * v[0] / v[1], 1), "answers": v[1]} for d, v in sorted(by_day.items())]

    subj_rows = []
    for e in Enrollment.objects.filter(user=user).select_related("subject"):
        s = e.subject
        qs = Quiz.objects.filter(user=user, subject=s, submitted_at__isnull=False).exclude(kind="evaluator")
        avg_quiz = round(sum(q.percent for q in qs) / qs.count(), 1) if qs.exists() else None
        m_avg, practised, total = engine.subject_mastery(user, s)
        units = []
        for u in s.units.all():
            ms = list(TopicMastery.objects.filter(user=user, topic__unit=u).values_list("score", flat=True))
            units.append({"unit": f"M{u.number}", "title": u.title, "mastery": round(sum(ms) / u.topics.count(), 1) if u.topics.count() else 0})
        subj_rows.append({"subject": s.short, "name": s.name, "avg_quiz": avg_quiz, "quizzes": qs.count(),
                          "mastery": m_avg, "practised": practised, "topics": total, "units": units})

    mastery = [{"topic_id": m.topic_id, "topic": m.topic.name, "subject": m.topic.subject.short, "score": m.score,
                "attempts": m.attempts, "level": m.level, "status": engine.label(m.score, m.attempts)}
               for m in TopicMastery.objects.filter(user=user, attempts__gt=0).select_related("topic__unit__subject").order_by("-score")]

    tasks_done = StudyTask.objects.filter(plan__user=user, status="done", completed_at__gte=since).exclude(kind="break")
    study_by_day = defaultdict(int)
    for t in tasks_done:
        study_by_day[timezone.localtime(t.completed_at).date().isoformat()] += t.minutes
    for q in Quiz.objects.filter(user=user, submitted_at__gte=since, started_at__isnull=False):
        secs = (q.submitted_at - q.started_at).total_seconds()
        study_by_day[timezone.localtime(q.submitted_at).date().isoformat()] += int(min(secs, 3 * 3600) // 60)
    for fs in FocusSession.objects.filter(user=user, completed_at__gte=since).exclude(task__isnull=False):
        study_by_day[timezone.localtime(fs.completed_at).date().isoformat()] += fs.minutes  # task-linked ones counted above
    study_time = [{"date": d, "minutes": m} for d, m in sorted(study_by_day.items())]

    rev = defaultdict(int)
    for q in Quiz.objects.filter(user=user, kind="revision", submitted_at__gte=since):
        rev[timezone.localtime(q.submitted_at).date().isoformat()] += 1

    usage = AIUsageLog.objects.filter(user=user)
    tok = usage.filter(cached=False, ok=True).aggregate(p=Sum("prompt_tokens"), c=Sum("completion_tokens"))
    p_tok, c_tok = tok["p"] or 0, tok["c"] or 0
    by_feature = list(usage.values("feature").annotate(calls=Count("id"), tokens=Sum("completion_tokens")).order_by("-calls"))
    cache_hits = usage.filter(cached=True).count()

    history = [{"id": q.id, "title": q.title, "kind": q.kind, "percent": q.percent, "at": q.submitted_at,
                "subject": q.subject.short if q.subject else ""}
               for q in Quiz.objects.filter(user=user, submitted_at__isnull=False).exclude(kind="evaluator")[:20]]
    return Response({
        "overall": {"answers": answers.count(), "quizzes": Quiz.objects.filter(user=user, submitted_at__isnull=False).count(),
                    "accuracy": round(sum(t["accuracy"] * t["answers"] for t in trend) / max(1, sum(t["answers"] for t in trend)), 1) if trend else None,
                    "strong": sum(1 for m in mastery if m["status"] == "strong"),
                    "weak": sum(1 for m in mastery if m["status"] == "weak"),
                    "tasks_done": StudyTask.objects.filter(plan__user=user, status="done").exclude(kind="break").count(),
                    "study_minutes": sum(s["minutes"] for s in study_time)},
        "trend": trend, "subjects": subj_rows, "mastery": mastery,
        "confidence": engine.confidence_analysis(user),
        "question_types": engine.question_accuracy_by_type(user),
        "study_time": study_time,
        "revision_history": [{"date": d, "revisions": n} for d, n in sorted(rev.items())],
        "history": history,
        "ai_usage": {"calls": usage.count(), "cache_hits": cache_hits, "failed": usage.filter(ok=False).count(),
                     "prompt_tokens": p_tok, "completion_tokens": c_tok,
                     "est_cost_usd": round(p_tok / 1e6 * settings.PRICE_INPUT_PER_M + c_tok / 1e6 * settings.PRICE_OUTPUT_PER_M, 5),
                     "by_feature": by_feature},
    })


@api_view(["GET"])
def learning_dna(request):
    user = request.user
    p = user.profile
    types = engine.question_accuracy_by_type(user)
    rated = [t for t in types if t["answers"] >= 3 and t["accuracy"] is not None]
    modes = list(Message.objects.filter(conversation__user=user, role="user").values("meta__mode")
                 .annotate(n=Count("id")).order_by("-n"))
    active_days = len({timezone.localtime(a).date() for a in
                       Answer.objects.filter(question__quiz__user=user).values_list("created_at", flat=True)})
    n_answers = Answer.objects.filter(question__quiz__user=user).count()
    hard = [{"topic": m.topic.name, "score": m.score} for m in
            TopicMastery.objects.filter(user=user, attempts__gte=3).select_related("topic").order_by("score")[:5]]
    conf = engine.confidence_analysis(user)
    calib = "Not enough data yet"
    if conf["overconfident"] + conf["underconfident"] >= 3:
        calib = ("Tends to be overconfident" if conf["overconfident"] > conf["underconfident"] * 1.5 else
                 "Tends to be underconfident" if conf["underconfident"] > conf["overconfident"] * 1.5 else "Well calibrated")
    return Response({
        "chosen": {"learning_style": p.learning_style, "learning_style_label": dict(p.STYLES)[p.learning_style],
                   "default_mode": p.default_mode, "preferred_time": p.preferred_time, "daily_hours": p.daily_hours},
        "observed": {
            "best_question_type": max(rated, key=lambda t: t["accuracy"])["type"] if rated else None,
            "weakest_question_type": min(rated, key=lambda t: t["accuracy"])["type"] if len(rated) > 1 else None,
            "question_types": types,
            "favourite_tutor_mode": modes[0]["meta__mode"] if modes and modes[0]["meta__mode"] else None,
            "active_days": active_days, "answers": n_answers,
            "pace": round(n_answers / active_days, 1) if active_days else None,
            "difficult_topics": hard, "calibration": calib,
        },
        "note": "Built only from your study activity and the preferences you chose. No personal characteristics are inferred.",
    })


@api_view(["GET"])
def usage(request):
    logs = AIUsageLog.objects.filter(user=request.user).order_by("-created_at")[:50]
    return Response({"logs": [{"feature": l.feature, "model": l.model, "prompt_tokens": l.prompt_tokens,
                               "completion_tokens": l.completion_tokens, "latency_ms": l.latency_ms, "cached": l.cached,
                               "ok": l.ok, "error": l.error, "at": l.created_at} for l in logs]})


PRIVACY_INFO = {
    "sent_to_ai": [
        "The text of your questions, answers and quiz responses when you use an AI feature.",
        "Your academic context: degree, branch, year, semester, university and chosen learning style.",
        "Relevant excerpts of PDFs you upload (only when you summarise or ask questions about them).",
    ],
    "never_sent": ["Your password (stored only as a salted hash)", "Your email address and name",
                   "Other students' data", "Your analytics and scores"],
    "stored_here": "All data is stored in this application's own database on the server you run.",
    "faculty_access": "Faculty see only aggregate statistics - never your conversations, documents or individual answers.",
    "provider_policy": ("OpenAI states API data is not used for training by default. Note: Google states that Gemini "
                        "FREE-tier requests may be used to improve its products - don't paste personal information."),
}


@api_view(["GET", "POST"])
def privacy(request):
    if request.method == "GET":
        u = request.user
        return Response({**PRIVACY_INFO, "counts": {
            "conversations": Conversation.objects.filter(user=u).count(), "documents": Document.objects.filter(user=u).count(),
            "quizzes": Quiz.objects.filter(user=u).count(), "mistakes": Mistake.objects.filter(user=u).count(),
            "plans": StudyPlan.objects.filter(user=u).count(), "notes": TopicNote.objects.filter(user=u).count()}})
    what = request.data.get("what")
    u = request.user
    if what == "conversations":
        n = Conversation.objects.filter(user=u).delete()[0]
    elif what == "documents":
        n = 0
        for d in Document.objects.filter(user=u):
            d.delete()
            n += 1
    elif what == "history":
        n = 0
        from .models import FocusSession as FS, QuestionPaper as QP
        for model in (Quiz, TopicMastery, Mistake, AnswerEvaluation, StudyPlan, Activity, TopicNote, AIUsageLog, FS, QP):
            n += model.objects.filter(user=u).delete()[0]
    else:
        return Response({"detail": "Choose what to delete."}, status=400)
    return Response({"ok": True, "deleted": n})
