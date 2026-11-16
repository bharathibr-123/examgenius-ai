from django.db.models import Avg, Count
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response

from study.engine import MIN_EVIDENCE, label, subject_mastery
from study.models import AIUsageLog, Quiz, TopicMastery
from accounts.models import User
from .models import Enrollment, Subject, Topic, Unit


class IsFaculty(BasePermission):
    message = "Faculty access only."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_faculty)


def subject_brief(s, user=None):
    out = {"id": s.id, "code": s.code, "name": s.name, "short": s.short, "semester": s.semester,
           "description": s.description, "color": s.color, "icon": s.icon,
           "topic_count": Topic.objects.filter(unit__subject=s).count(), "unit_count": s.units.count()}
    if user:
        avg, practised, total = subject_mastery(user, s)
        e = Enrollment.objects.filter(user=user, subject=s).first()
        out.update({"mastery": avg, "practised": practised, "enrolled": bool(e),
                    "exam_date": e.exam_date if e else None, "enrollment_id": e.id if e else None})
    return out


@api_view(["GET"])
def subjects(request):
    qs = Subject.objects.all()
    mine = request.GET.get("mine") == "1"
    if mine:
        qs = qs.filter(enrollments__user=request.user)
    return Response({"subjects": [subject_brief(s, request.user) for s in qs]})


@api_view(["GET"])
@permission_classes([AllowAny])
def subjects_public(request):
    return Response({"subjects": [{"id": s.id, "code": s.code, "name": s.name, "short": s.short,
                                   "semester": s.semester, "color": s.color, "icon": s.icon}
                                  for s in Subject.objects.all()]})



@api_view(["GET"])
def subject_detail(request, pk):
    s = Subject.objects.get(pk=pk)
    mastery = {m.topic_id: m for m in TopicMastery.objects.filter(user=request.user, topic__unit__subject=s)}
    units = []
    for u in s.units.prefetch_related("topics__prerequisites"):
        topics = []
        for t in u.topics.all():
            m = mastery.get(t.id)
            score, att = (m.score, m.attempts) if m else (0, 0)
            topics.append({"id": t.id, "name": t.name, "summary": t.summary, "importance": t.importance,
                           "mastery": score, "attempts": att, "status": label(score, att),
                           "level": m.level if m else "easy",
                           "prerequisites": [{"id": p.id, "name": p.name} for p in t.prerequisites.all()]})
        units.append({"id": u.id, "number": u.number, "title": u.title, "topics": topics})
    return Response({"subject": subject_brief(s, request.user), "units": units})


@api_view(["GET"])
def concept_map(request, pk):
    s = Subject.objects.get(pk=pk)
    topics = list(Topic.objects.filter(unit__subject=s).select_related("unit").prefetch_related("prerequisites__unit__subject"))
    ids = {t.id for t in topics}
    mastery = {m.topic_id: m for m in TopicMastery.objects.filter(user=request.user, topic__in=topics)}
    # depth = longest prerequisite chain inside this subject
    depth = {}

    def d(t, seen=()):
        if t.id in depth:
            return depth[t.id]
        pres = [p for p in t.prerequisites.all() if p.id in ids and p.id not in seen]
        val = 0 if not pres else 1 + max(d(p, seen + (t.id,)) for p in pres)
        depth[t.id] = val
        return val

    nodes, edges = [], []
    for t in topics:
        m = mastery.get(t.id)
        nodes.append({"id": t.id, "name": t.name, "unit": t.unit.number, "depth": d(t),
                      "mastery": m.score if m else 0, "status": label(m.score if m else 0, m.attempts if m else 0)})
        for p in t.prerequisites.all():
            edges.append({"from": p.id, "to": t.id, "external": p.id not in ids,
                          "external_name": f"{p.name} ({p.unit.subject.short})" if p.id not in ids else None})
    return Response({"subject": s.name, "nodes": nodes, "edges": edges})


# ------------------------------------------------------------------ faculty portal (aggregate only)
@api_view(["GET"])
@permission_classes([IsFaculty])
def faculty_overview(request):
    students = User.objects.filter(role=User.STUDENT, is_staff=False)
    subj_rows = []
    for s in Subject.objects.all():
        agg = TopicMastery.objects.filter(topic__unit__subject=s, user__in=students, attempts__gte=MIN_EVIDENCE) \
            .aggregate(avg=Avg("score"), n=Count("user", distinct=True))
        subj_rows.append({"id": s.id, "code": s.code, "name": s.name, "short": s.short,
                          "enrolled": Enrollment.objects.filter(subject=s, user__in=students).count(),
                          "active_learners": agg["n"] or 0,
                          "avg_mastery": round(agg["avg"], 1) if agg["avg"] is not None else None,
                          "topics": Topic.objects.filter(unit__subject=s).count()})
    hardest = (TopicMastery.objects.filter(user__in=students, attempts__gte=MIN_EVIDENCE)
               .values("topic__id", "topic__name", "topic__unit__subject__short")
               .annotate(avg=Avg("score"), n=Count("user")).filter(n__gte=1).order_by("avg")[:8])
    quizzes = Quiz.objects.filter(user__in=students, submitted_at__isnull=False)
    return Response({
        "privacy_note": "Aggregate statistics only. Faculty cannot view individual students' conversations, documents or answers.",
        "students": students.count(),
        "quizzes_taken": quizzes.count(),
        "avg_quiz_score": round(sum(q.percent for q in quizzes) / quizzes.count(), 1) if quizzes.exists() else None,
        "ai_requests": AIUsageLog.objects.filter(user__in=students).count(),
        "subjects": subj_rows,
        "hardest_topics": [{"topic": h["topic__name"], "subject": h["topic__unit__subject__short"],
                            "avg_mastery": round(h["avg"], 1), "students": h["n"]} for h in hardest],
    })


@api_view(["POST"])
@permission_classes([IsFaculty])
def faculty_add_topic(request, pk):
    s = Subject.objects.get(pk=pk)
    d = request.data
    name = str(d.get("name", "")).strip()
    if len(name) < 3:
        return Response({"detail": "Topic name is too short."}, status=400)
    try:
        unit = Unit.objects.get(subject=s, number=int(d.get("unit_number")))
        imp = max(1, min(5, int(d.get("importance", 3))))
    except (Unit.DoesNotExist, TypeError, ValueError):
        return Response({"detail": "Choose a valid module."}, status=400)
    t = Topic.objects.create(unit=unit, name=name[:160], summary=str(d.get("summary", ""))[:300], importance=imp,
                             order=unit.topics.count())
    return Response({"id": t.id, "name": t.name}, status=201)


@api_view(["POST"])
@permission_classes([IsFaculty])
def faculty_add_subject(request):
    d = request.data
    code, name = str(d.get("code", "")).strip().upper(), str(d.get("name", "")).strip()
    if not code or len(name) < 3:
        return Response({"detail": "Code and name are required."}, status=400)
    if Subject.objects.filter(code=code).exists():
        return Response({"detail": "A subject with this code exists."}, status=400)
    try:
        units = max(1, min(8, int(d.get("modules", 5))))
        sem = int(d.get("semester", 5))
    except (TypeError, ValueError):
        return Response({"detail": "Invalid numbers."}, status=400)
    s = Subject.objects.create(code=code[:20], name=name[:120], short=str(d.get("short") or code)[:12], semester=sem,
                               description=str(d.get("description", ""))[:500], created_by=request.user)
    for i in range(1, units + 1):
        Unit.objects.create(subject=s, number=i, title=f"Module {i}")
    return Response({"id": s.id}, status=201)
