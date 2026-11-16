"""Learning engine - deterministic Python (no AI calls). Every number is explainable.

Formulas are documented in the README (section "How the scores work").
"""
from __future__ import annotations

import re
from datetime import date, timedelta

from django.utils import timezone

from academics.models import Enrollment, Topic
from .models import Activity, Answer, Mistake, Question, Quiz, StudyTask, TopicMastery

DIFF_WEIGHT = {"easy": 1.0, "medium": 1.5, "hard": 2.0}
RECENCY = 0.85
WINDOW = 10
MIN_EVIDENCE = 3
LEVELS = ["easy", "medium", "hard"]


def log_activity(user, kind, text, link=""):
    Activity.objects.create(user=user, kind=kind, text=text[:255], link=link)


# ------------------------------------------------------------------ objective grading
def _norm(s: str) -> str:
    s = (s or "").lower().strip()
    s = re.sub(r"[^a-z0-9.+\-*/=() ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def grade_objective(qtype, response, answer, accept=()):
    """Returns True/False for mcq, tf, fill. Pure Python - no AI call."""
    r = _norm(response)
    if not r:
        return False
    if qtype in ("mcq", "tf"):
        return r == _norm(answer)
    targets = {_norm(answer), *(_norm(a) for a in accept)}
    if r in targets:
        return True
    # tolerate a leading article and plural 's'
    r2 = re.sub(r"^(the|a|an) ", "", r).rstrip("s")
    return any(r2 == re.sub(r"^(the|a|an) ", "", t).rstrip("s") for t in targets if t)


# ------------------------------------------------------------------ mastery
def compute_mastery(user, topic):
    """M = 100 * sum(w*s)/sum(w), w = 0.85^k * difficulty weight, last 10 answers."""
    answers = (Answer.objects.filter(question__topic=topic, question__quiz__user=user)
               .select_related("question").order_by("-created_at")[:WINDOW])
    num = den = 0.0
    count = 0
    for k, a in enumerate(answers):
        w = (RECENCY ** k) * DIFF_WEIGHT.get(a.question.difficulty, 1.5)
        s = (a.marks_awarded / a.question.marks) if a.question.marks else float(a.is_correct)
        num += w * max(0.0, min(1.0, s))
        den += w
        count += 1
    total = Answer.objects.filter(question__topic=topic, question__quiz__user=user).count()
    return (round(100 * num / den, 1) if den else 0.0), total


def label(score, attempts):
    if attempts < MIN_EVIDENCE:
        return "not_enough"
    return "weak" if score < 40 else "developing" if score < 70 else "strong"


def record_answer_effects(user, answer: Answer):
    """After an answer is graded: update mastery, adaptive level, mistakes. Returns events list."""
    q = answer.question
    events = []
    if not q.topic_id:
        return events
    tm, _ = TopicMastery.objects.get_or_create(user=user, topic=q.topic)
    tm.score, tm.attempts = compute_mastery(user, q.topic)
    tm.last_practised = timezone.now()
    good = answer.is_correct or (q.marks and answer.marks_awarded / q.marks >= 0.5)
    # Adaptive learning engine (documented rules)
    if good:
        tm.streak_correct += 1
        tm.streak_wrong = 0
        tm.simplify_next = False
        if tm.streak_correct >= 3 and tm.level != "hard":
            tm.level = LEVELS[LEVELS.index(tm.level) + 1]
            tm.streak_correct = 0
            events.append(f"Level up: {q.topic.name} questions are now {tm.level}.")
    else:
        tm.streak_wrong += 1
        tm.streak_correct = 0
        if tm.streak_wrong >= 2:
            tm.simplify_next = True
            if tm.level != "easy":
                tm.level = LEVELS[LEVELS.index(tm.level) - 1]
                events.append(f"{q.topic.name}: difficulty lowered to {tm.level}; next explanation will be simpler.")
            tm.streak_wrong = 0
    tm.save()
    if not good and answer.question.quiz.kind != "revision":
        Mistake.objects.create(
            user=user, topic=q.topic, source_answer=answer, qtype=q.qtype, question_text=q.text,
            options=q.options, your_answer=answer.response, correct_answer=q.answer, accept=q.accept,
            explanation=q.explanation, marks=q.marks, due_date=date.today() + timedelta(days=1))
        recent = Mistake.objects.filter(user=user, topic=q.topic, resolved=False,
                                        created_at__gte=timezone.now() - timedelta(days=7)).count()
        if recent >= 3:
            if add_targeted_revision(user, q.topic):
                events.append(f"Repeated mistakes on {q.topic.name}: a targeted revision task was added to your plan.")
    return events


def add_targeted_revision(user, topic):
    from .models import StudyPlan
    plan = StudyPlan.objects.filter(user=user, subject=topic.subject, active=True).first()
    if not plan:
        return False
    tomorrow = date.today() + timedelta(days=1)
    if tomorrow >= plan.exam_date:
        tomorrow = date.today()
    if plan.tasks.filter(topic=topic, kind="revise", status="pending", date__gte=date.today()).exists():
        return False
    StudyTask.objects.create(plan=plan, date=tomorrow, order=0, topic=topic, kind="revise",
                             title=f"Targeted revision: {topic.name}", minutes=30, priority=1.0)
    plan.notes = (plan.notes or []) + [f"{date.today()}: added targeted revision for {topic.name} (repeated mistakes)."]
    plan.save(update_fields=["notes"])
    return True


def topic_level(user, topic):
    tm = TopicMastery.objects.filter(user=user, topic=topic).first()
    return tm.level if tm else "easy"


# ------------------------------------------------------------------ spaced repetition
def review_mistake(mistake: Mistake, correct: bool):
    """1 -> 3 -> 7 -> 14 -> 30 days. Correct: next step. Wrong: back to 1 day."""
    mistake.revisions += 1
    mistake.last_result = "correct" if correct else "wrong"
    if correct:
        mistake.step += 1
        if mistake.step >= len(Mistake.INTERVALS):
            mistake.resolved = True
            mistake.due_date = date.today()
        else:
            mistake.due_date = date.today() + timedelta(days=Mistake.INTERVALS[mistake.step])
    else:
        mistake.step = 0
        mistake.due_date = date.today() + timedelta(days=1)
    mistake.save()
    return mistake


def revision_queue(user, limit=50):
    """Due mistakes + stale strong topics, ordered by (100 - mastery) + 10 * days overdue."""
    today = date.today()
    mastery = {m.topic_id: m.score for m in TopicMastery.objects.filter(user=user)}
    items = []
    for m in Mistake.objects.filter(user=user, resolved=False, due_date__lte=today).select_related("topic__unit"):
        overdue = (today - m.due_date).days
        items.append({"type": "mistake", "id": m.id, "topic": m.topic.name if m.topic else "",
                      "topic_id": m.topic_id, "subject_id": m.topic.unit.subject_id if m.topic else None, "question": m.question_text,
                      "priority": round((100 - mastery.get(m.topic_id, 0)) + 10 * overdue, 1),
                      "overdue_days": overdue, "step": m.step})
    stale = TopicMastery.objects.filter(user=user, score__gte=70, attempts__gte=MIN_EVIDENCE,
                                        last_practised__lt=timezone.now() - timedelta(days=14)).select_related("topic")
    for tm in stale:
        days = (timezone.now() - tm.last_practised).days
        items.append({"type": "topic", "id": tm.topic_id, "topic": tm.topic.name, "topic_id": tm.topic_id,
                      "subject_id": tm.topic.unit.subject_id,
                      "question": f"Not practised for {days} days - take a quick quiz to keep it fresh.",
                      "priority": round(100 - tm.score + (days - 14), 1), "overdue_days": days - 14, "step": None})
    items.sort(key=lambda x: -x["priority"])
    return items[:limit]


# ------------------------------------------------------------------ knowledge gaps
def knowledge_gaps(user, subject=None):
    qs = TopicMastery.objects.filter(user=user).select_related("topic__unit__subject")
    if subject:
        qs = qs.filter(topic__unit__subject=subject)
    by_topic = {m.topic_id: m for m in qs}
    weak, repeated, prereq, stale = [], [], [], []
    for m in by_topic.values():
        if m.attempts >= MIN_EVIDENCE and m.score < 40:
            weak.append({"topic_id": m.topic_id, "topic": m.topic.name, "subject": m.topic.subject.short,
                         "subject_id": m.topic.subject.id,
                         "score": m.score, "attempts": m.attempts})
            for p in m.topic.prerequisites.all():
                pm = TopicMastery.objects.filter(user=user, topic=p).first()
                if not pm or pm.score < 60:
                    prereq.append({"topic": m.topic.name, "topic_id": m.topic_id, "prerequisite": p.name,
                                   "prerequisite_id": p.id, "prerequisite_score": pm.score if pm else None})
        if m.attempts >= MIN_EVIDENCE and m.score >= 70 and m.last_practised and \
                m.last_practised < timezone.now() - timedelta(days=14):
            stale.append({"topic_id": m.topic_id, "topic": m.topic.name, "score": m.score})
    mq = Mistake.objects.filter(user=user, resolved=False, created_at__gte=timezone.now() - timedelta(days=14))
    if subject:
        mq = mq.filter(topic__unit__subject=subject)
    counts = {}
    for mk in mq.select_related("topic"):
        if mk.topic:
            counts.setdefault(mk.topic_id, [mk.topic.name, 0])
            counts[mk.topic_id][1] += 1
    repeated = [{"topic_id": k, "topic": v[0], "mistakes": v[1]} for k, v in counts.items() if v[1] >= 3]
    weak.sort(key=lambda x: x["score"])
    return {"weak": weak, "repeated_mistakes": repeated, "prerequisite_gaps": prereq, "needs_revision": stale}


# ------------------------------------------------------------------ confidence vs knowledge
def confidence_analysis(user):
    rows = []
    qs = Answer.objects.filter(question__quiz__user=user, confidence__isnull=False).select_related("question__topic")
    for lvl, name in Answer.CONF:
        sub = qs.filter(confidence=lvl)
        n = sub.count()
        c = sub.filter(is_correct=True).count()
        rows.append({"confidence": name, "level": lvl, "answers": n, "accuracy": round(100 * c / n, 1) if n else None})
    over = qs.filter(confidence=3, is_correct=False)
    under = qs.filter(confidence=1, is_correct=True)
    topics = {}
    for a in over:
        if a.question.topic:
            topics[a.question.topic.name] = topics.get(a.question.topic.name, 0) + 1
    return {"levels": rows, "overconfident": over.count(), "underconfident": under.count(),
            "overconfident_topics": sorted(({"topic": k, "count": v} for k, v in topics.items()), key=lambda x: -x["count"])[:5]}


# ------------------------------------------------------------------ readiness
def readiness(user, enrollment: Enrollment):
    """R = 0.35 M + 0.20 C + 0.15 X + 0.15 V + 0.15 P (missing parts' weight is shared out)."""
    subject = enrollment.subject
    topics = list(Topic.objects.filter(unit__subject=subject))
    n = len(topics) or 1
    mastery = {m.topic_id: m for m in TopicMastery.objects.filter(user=user, topic__in=topics)}
    M = sum(mastery[t.id].score if t.id in mastery else 0 for t in topics) / n
    done_study = set(StudyTask.objects.filter(plan__user=user, plan__subject=subject, status="done",
                                              topic__isnull=False).values_list("topic_id", flat=True))
    covered = sum(1 for t in topics if (t.id in mastery and mastery[t.id].attempts >= MIN_EVIDENCE) or t.id in done_study)
    C = 100 * covered / n
    mock = Quiz.objects.filter(user=user, subject=subject, kind="mock", submitted_at__isnull=False).order_by("-submitted_at").first()
    X = mock.percent if mock else None
    mk = Mistake.objects.filter(user=user, topic__unit__subject=subject)
    reviewed = sum(m.revisions for m in mk)
    overdue = mk.filter(resolved=False, due_date__lt=date.today()).count()
    V = 100 * reviewed / (reviewed + overdue) if (reviewed + overdue) else None
    past = StudyTask.objects.filter(plan__user=user, plan__subject=subject, date__lt=date.today()).exclude(kind="break")
    pd_, pm_ = past.filter(status="done").count(), past.filter(status="missed").count()
    P = 100 * pd_ / (pd_ + pm_) if (pd_ + pm_) else None

    parts = [("Topic mastery", "M", 0.35, M), ("Syllabus coverage", "C", 0.20, C), ("Mock exam", "X", 0.15, X),
             ("Revision completion", "V", 0.15, V), ("Plan adherence", "P", 0.15, P)]
    available = [p for p in parts if p[3] is not None]
    wsum = sum(p[2] for p in available)
    score = sum(p[2] * p[3] for p in available) / wsum if wsum else 0
    days_left = (enrollment.exam_date - date.today()).days if enrollment.exam_date else None
    pending_topics = [t for t in topics if not (t.id in mastery and mastery[t.id].score >= 70)]
    hours_needed = round(len(pending_topics) * 1.0, 1)  # ~1 h (study + quiz) per pending topic
    per_day = round(hours_needed / days_left, 1) if days_left and days_left > 0 else None
    strong = sorted([{"topic": t.name, "score": mastery[t.id].score} for t in topics
                     if t.id in mastery and mastery[t.id].attempts >= MIN_EVIDENCE and mastery[t.id].score >= 70],
                    key=lambda x: -x["score"])[:5]
    weak = sorted([{"topic": t.name, "topic_id": t.id, "score": mastery[t.id].score} for t in topics
                   if t.id in mastery and mastery[t.id].attempts >= MIN_EVIDENCE and mastery[t.id].score < 40],
                  key=lambda x: x["score"])[:5]
    untouched = [t for t in topics if t.id not in mastery]
    actions = []
    if weak:
        actions.append(f"Practise your weakest topic: {weak[0]['topic']} ({weak[0]['score']}%).")
    if untouched:
        top = max(untouched, key=lambda t: t.importance)
        actions.append(f"Start an untouched high-importance topic: {top.name}.")
    if X is None:
        actions.append("Take a timed mock exam in the Exam Hall to measure exam performance.")
    if overdue:
        actions.append(f"Clear {overdue} overdue revision item(s) in Mistake Memory.")
    if days_left is not None and days_left <= 7:
        actions.append("Your exam is within a week - switch on Exam Rescue Mode in the Planner.")
    band = "On track" if score >= 70 else "Getting there" if score >= 45 else "At risk"
    return {
        "subject_id": subject.id, "subject": subject.name, "short": subject.short, "code": subject.code,
        "score": round(score, 1), "band": band, "days_left": days_left,
        "exam_date": enrollment.exam_date.isoformat() if enrollment.exam_date else None,
        "components": [{"name": nme, "symbol": sym, "weight": w, "value": None if v is None else round(v, 1)}
                       for nme, sym, w, v in parts],
        "hours_needed": hours_needed, "hours_per_day_needed": per_day,
        "strong": strong, "weak": weak, "actions": actions[:4],
        "disclaimer": "Estimated preparation indicator - not a prediction of university marks.",
    }


def study_streak(user):
    days = {timezone.localtime(dt).date() for dt in Activity.objects.filter(user=user)
            .order_by("-created_at").values_list("created_at", flat=True)[:500]}
    streak, d = 0, timezone.localdate()
    if d not in days:
        d -= timedelta(days=1)
    while d in days:
        streak += 1
        d -= timedelta(days=1)
    return streak


def subject_mastery(user, subject):
    topics = Topic.objects.filter(unit__subject=subject)
    ms = {m.topic_id: m.score for m in TopicMastery.objects.filter(user=user, topic__in=topics)}
    n = topics.count() or 1
    return round(sum(ms.values()) / n, 1), len(ms), n


def question_accuracy_by_type(user):
    out = []
    for code, name in Question.TYPES:
        qs = Answer.objects.filter(question__quiz__user=user, question__qtype=code)
        n = qs.count()
        if code == "short":
            got = sum(a.marks_awarded / a.question.marks for a in qs.select_related("question") if a.question.marks)
        else:
            got = qs.filter(is_correct=True).count()
        out.append({"type": name, "code": code, "answers": n, "accuracy": round(100 * got / n, 1) if n else None})
    return out
