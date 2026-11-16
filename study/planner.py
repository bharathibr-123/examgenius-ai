"""Study planner, Exam Rescue Mode and Study Recovery - deterministic scheduling (no AI cost).

priority = importance/5 * (1 - mastery/100) * b     (b = 1.2 if prerequisite of a weak topic)
Blocks: 45 min study -> 15 min quiz -> 10 min break. Weak topics get an extra 30 min revise block.
No day exceeds the student's daily hours. What doesn't fit is reported honestly as "not covered".
"""
from __future__ import annotations

from datetime import date, timedelta

from django.db import transaction
from django.utils import timezone

from academics.models import Topic
from .models import StudyPlan, StudyTask, TopicMastery

STUDY, QUIZ, BREAK, REVISE, MOCK = 45, 15, 10, 30, 60


def topic_priorities(user, subject, unit_ids=None):
    topics = list(Topic.objects.filter(unit__subject=subject).select_related("unit").prefetch_related("unlocks"))
    if unit_ids:
        topics = [t for t in topics if t.unit_id in set(unit_ids)]
    mastery = {m.topic_id: m for m in TopicMastery.objects.filter(user=user, topic__in=topics)}
    weak_ids = {tid for tid, m in mastery.items() if m.attempts >= 3 and m.score < 40}
    rows = []
    for t in topics:
        m = mastery.get(t.id)
        score = m.score if m else 0.0
        b = 1.2 if any(u.id in weak_ids for u in t.unlocks.all()) else 1.0
        pr = round(t.importance / 5 * (1 - score / 100) * b, 3)
        rows.append({"topic": t, "mastery": score, "attempts": m.attempts if m else 0,
                     "weak": t.id in weak_ids, "priority": pr, "done": score >= 80 and (m.attempts if m else 0) >= 3})
    return rows


def _days(start, exam_date):
    last = exam_date - timedelta(days=1)
    if last < start:
        last = start
    n = (last - start).days + 1
    return [start + timedelta(days=i) for i in range(n)]


@transaction.atomic
def generate_plan(user, subject, exam_date, daily_hours, mode="normal", unit_ids=None, start=None):
    start = start or date.today()
    StudyPlan.objects.filter(user=user, subject=subject, active=True).update(active=False)
    plan = StudyPlan.objects.create(user=user, subject=subject, exam_date=exam_date,
                                    daily_hours=daily_hours, mode=mode, notes=[], uncovered=[])
    days = _days(start, exam_date)
    cap = int(daily_hours * 60)
    reserve_ratio = 0.2 if mode == "rescue" else 0.15
    reserve_days = max(1, round(len(days) * reserve_ratio)) if len(days) > 2 else 0
    work_days, final_days = (days[:-reserve_days], days[-reserve_days:]) if reserve_days else (days, [])

    rows = [r for r in topic_priorities(user, subject, unit_ids) if not r["done"]]
    if mode == "rescue":
        rows.sort(key=lambda r: (-r["priority"], not r["weak"], -r["topic"].importance))  # ties: proven-weak first
    else:  # syllabus order, but weak topics first within the order
        rows.sort(key=lambda r: (r["topic"].unit.number, not r["weak"], r["topic"].order))

    used = {d: 0 for d in days}
    order = {d: 0 for d in days}
    uncovered = []
    tasks = []

    def place(d, kind, title, minutes, topic=None, priority=0.0):
        order[d] += 1
        used[d] += minutes
        tasks.append(StudyTask(plan=plan, date=d, order=order[d], topic=topic, kind=kind, title=title,
                               minutes=minutes, priority=priority))

    di = 0
    for r in rows:
        t = r["topic"]
        block = STUDY + QUIZ + BREAK + (REVISE if r["weak"] else 0)
        if block > cap:  # tiny daily budgets: drop the break
            block -= BREAK
        while di < len(work_days) and used[work_days[di]] + block > cap:
            di += 1
        if di >= len(work_days):
            uncovered.append({"topic": t.name, "topic_id": t.id, "priority": r["priority"]})
            continue
        d = work_days[di]
        verb = "Re-learn" if r["weak"] else "Study"
        place(d, "study", f"{verb}: {t.name}", STUDY, t, r["priority"])
        if r["weak"]:
            place(d, "revise", f"Extra practice (weak topic): {t.name}", REVISE, t, r["priority"])
        place(d, "quiz", f"Quick quiz: {t.name}", QUIZ, t, r["priority"])
        if block <= cap and used[d] + BREAK <= cap:
            place(d, "break", "Break - stretch, water, no screens", BREAK)

    # Final revision days: mock exam + revision of highest-priority covered topics
    covered = [r for r in rows if r["topic"].name not in {u["topic"] for u in uncovered}]
    covered.sort(key=lambda r: -r["priority"])
    ci = 0
    for fi, d in enumerate(final_days):
        if fi == len(final_days) - 1 and cap >= MOCK:
            place(d, "mock", "Timed mock exam (Exam Hall)", MOCK)
        while ci < len(covered) and used[d] + REVISE <= cap:
            r = covered[ci]
            place(d, "revise", f"Final revision: {r['topic'].name}", REVISE, r["topic"], r["priority"])
            ci += 1
    if not final_days and cap >= MOCK + 10:
        d = days[-1]
        if used[d] + MOCK <= cap:
            place(d, "mock", "Timed mock exam (Exam Hall)", MOCK)

    StudyTask.objects.bulk_create(tasks)
    uncovered.sort(key=lambda u: -u["priority"])
    plan.uncovered = uncovered
    plan.notes = [f"{date.today()}: {mode} plan created - {len(days)} day(s), {daily_hours} h/day, "
                  f"{len([t for t in tasks if t.kind == 'study'])} topics scheduled, {len(uncovered)} not covered."]
    plan.save()
    return plan


@transaction.atomic
def recover(plan: StudyPlan):
    """Study Recovery System: missed tasks are moved to free slots before the exam, highest priority first."""
    today = date.today()
    overdue = list(plan.tasks.filter(date__lt=today, status="pending"))
    if not overdue:
        return []
    changes = []
    cap = int(plan.daily_hours * 60)
    future_days = _days(today, plan.exam_date) if plan.exam_date > today else []
    used = {d: 0 for d in future_days}
    for t in plan.tasks.filter(date__gte=today).exclude(status__in=["skipped"]):
        if t.date in used:
            used[t.date] += t.minutes
    movable = []
    for t in overdue:
        t.status = "missed"
        t.save(update_fields=["status"])
        if t.kind != "break":
            movable.append(t)
    movable.sort(key=lambda t: -t.priority)
    for t in movable:
        slot = next((d for d in future_days if used[d] + t.minutes <= cap), None)
        if slot is None:
            changes.append(f"No free time left for '{t.title}' - dropped (lower priority than what is scheduled).")
            continue
        used[slot] += t.minutes
        StudyTask.objects.create(plan=plan, date=slot, order=99, topic=t.topic, kind=t.kind,
                                 title=t.title, minutes=t.minutes, priority=t.priority, rescheduled_from=t.date)
        changes.append(f"Moved '{t.title}' from {t.date:%d %b} to {slot:%d %b}.")
    plan.notes = (plan.notes or []) + [f"{today}: recovery - {c}" for c in changes]
    plan.save(update_fields=["notes"])
    return changes


def after_quiz(user, topic_scores: dict):
    """Recalculate active plans after a quiz: <50% adds a re-study block, >=80% frees remaining blocks."""
    messages = []
    today = date.today()
    for topic_id, pct in topic_scores.items():
        plans = StudyPlan.objects.filter(user=user, active=True, subject__units__topics__id=topic_id).distinct()
        for plan in plans:
            if plan.exam_date <= today:
                continue
            topic = Topic.objects.get(id=topic_id)
            if pct < 50:
                d = today + timedelta(days=1)
                if d >= plan.exam_date:
                    d = today
                cap = int(plan.daily_hours * 60)
                used = sum(plan.tasks.filter(date=d).exclude(status="skipped").values_list("minutes", flat=True))
                if not plan.tasks.filter(topic=topic, kind="revise", date=d, status="pending").exists() and used + REVISE <= cap:
                    StudyTask.objects.create(plan=plan, date=d, order=0, topic=topic, kind="revise",
                                             title=f"Re-study (quiz {pct:.0f}%): {topic.name}", minutes=REVISE, priority=1.0)
                    msg = f"Scored {pct:.0f}% on {topic.name}: added a 30-min re-study block on {d:%d %b}."
                    plan.notes = (plan.notes or []) + [f"{today}: {msg}"]
                    plan.save(update_fields=["notes"])
                    messages.append(msg)
            elif pct >= 80:
                n = plan.tasks.filter(topic=topic, status="pending", kind__in=["study", "revise"],
                                      date__gt=today).exclude(title__startswith="Final revision").update(status="skipped")
                if n:
                    msg = f"Scored {pct:.0f}% on {topic.name}: marked done, freed {n} upcoming block(s)."
                    plan.notes = (plan.notes or []) + [f"{today}: {msg}"]
                    plan.save(update_fields=["notes"])
                    messages.append(msg)
    return messages


def mark_task(task: StudyTask, status: str):
    task.status = status
    task.completed_at = timezone.now() if status == "done" else None
    task.save(update_fields=["status", "completed_at"])
    return task
