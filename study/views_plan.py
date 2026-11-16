from collections import OrderedDict
from datetime import date

from rest_framework.decorators import api_view
from rest_framework.response import Response

from academics.models import Enrollment, Subject
from . import engine, planner
from .models import StudyPlan, StudyTask


def plan_payload(plan, changes=None):
    groups = OrderedDict()
    for t in plan.tasks.select_related("topic"):
        groups.setdefault(t.date.isoformat(), []).append({
            "id": t.id, "kind": t.kind, "title": t.title, "minutes": t.minutes, "status": t.status,
            "topic_id": t.topic_id, "topic": t.topic.name if t.topic else None, "priority": t.priority,
            "rescheduled_from": t.rescheduled_from})
    tasks = plan.tasks.exclude(kind="break")
    total = tasks.exclude(status="skipped").count()
    done = tasks.filter(status="done").count()
    today = date.today()
    return {
        "id": plan.id, "subject_id": plan.subject_id, "subject": plan.subject.name, "short": plan.subject.short,
        "exam_date": plan.exam_date, "days_left": (plan.exam_date - today).days, "daily_hours": plan.daily_hours,
        "mode": plan.mode, "created_at": plan.created_at, "notes": plan.notes[-12:], "uncovered": plan.uncovered,
        "progress": {"done": done, "total": total, "percent": round(100 * done / total, 1) if total else 0,
                     "missed": tasks.filter(status="missed").count()},
        "days": [{"date": d, "is_today": d == today.isoformat(), "minutes": sum(t["minutes"] for t in ts if t["status"] != "skipped"),
                  "tasks": ts} for d, ts in groups.items()],
        "recovery_changes": changes or [],
    }


@api_view(["GET", "POST"])
def plans(request):
    if request.method == "GET":
        out = []
        for p in StudyPlan.objects.filter(user=request.user, active=True).select_related("subject"):
            changes = planner.recover(p)
            out.append(plan_payload(p, changes))
        return Response({"plans": out})
    d = request.data
    subject = Subject.objects.get(id=int(d.get("subject_id")))
    try:
        exam_date = date.fromisoformat(str(d.get("exam_date"))[:10])
        hours = float(d.get("daily_hours", 4))
    except (TypeError, ValueError):
        return Response({"detail": "Enter a valid exam date and study hours."}, status=400)
    if exam_date <= date.today():
        return Response({"detail": "The exam date must be in the future."}, status=400)
    if not 0.5 <= hours <= 14:
        return Response({"detail": "Daily study hours must be between 0.5 and 14."}, status=400)
    mode = "rescue" if d.get("mode") == "rescue" else "normal"
    unit_ids = [int(u) for u in d.get("unit_ids") or []]
    plan = planner.generate_plan(request.user, subject, exam_date, hours, mode, unit_ids)
    Enrollment.objects.update_or_create(user=request.user, subject=subject, defaults={"exam_date": exam_date})
    engine.log_activity(request.user, "plan", f"Created {'Exam Rescue' if mode == 'rescue' else 'study'} plan for {subject.short}", "/planner")
    return Response(plan_payload(plan), status=201)


@api_view(["GET", "DELETE"])
def plan_detail(request, pk):
    plan = StudyPlan.objects.get(pk=pk, user=request.user)
    if request.method == "DELETE":
        plan.delete()
        return Response({"ok": True})
    return Response(plan_payload(plan, planner.recover(plan)))


@api_view(["POST"])
def plan_recalculate(request, pk):
    """Rebuild the remaining schedule from today using current mastery (keeps completed history)."""
    old = StudyPlan.objects.get(pk=pk, user=request.user)
    if old.exam_date <= date.today():
        return Response({"detail": "The exam date has passed."}, status=400)
    new = planner.generate_plan(request.user, old.subject, old.exam_date, old.daily_hours, old.mode)
    old.tasks.filter(status="done").update(plan=new)  # keep done history
    new.notes = old.notes + [f"{date.today()}: plan recalculated from current mastery."] + new.notes
    new.save(update_fields=["notes"])
    old.delete()
    return Response(plan_payload(new))


@api_view(["PATCH"])
def task_update(request, pk):
    task = StudyTask.objects.select_related("plan").get(pk=pk, plan__user=request.user)
    status = request.data.get("status")
    if status not in ("done", "pending", "skipped"):
        return Response({"detail": "Invalid status."}, status=400)
    planner.mark_task(task, status)
    if status == "done":
        engine.log_activity(request.user, "task", f"Completed: {task.title}", "/planner")
    return Response({"id": task.id, "status": task.status})


@api_view(["GET"])
def rescue_preview(request):
    """Topic priority table used by Exam Rescue Mode (transparent ranking)."""
    subject = Subject.objects.get(id=int(request.GET.get("subject_id")))
    rows = planner.topic_priorities(request.user, subject)
    rows.sort(key=lambda r: (-r["priority"], not r["weak"], -r["topic"].importance))
    return Response({"formula": "priority = importance/5 x (1 - mastery/100) x b  (b = 1.2 if prerequisite of a weak topic); ties: proven-weak topics first",
                     "topics": [{"topic_id": r["topic"].id, "topic": r["topic"].name, "module": r["topic"].unit.number,
                                 "importance": r["topic"].importance, "mastery": r["mastery"], "attempts": r["attempts"],
                                 "weak": r["weak"], "priority": r["priority"], "done": r["done"]} for r in rows]})
