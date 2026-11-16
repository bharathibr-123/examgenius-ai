"""python manage.py seed_demo  -  loads the DEMO syllabus and demo accounts (safe to run again)."""
from datetime import date, timedelta

from django.contrib.auth.models import Permission
from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import StudentProfile, User
from academics.models import Enrollment, Subject, Topic, Unit
from academics.seed_data import CROSS_PREREQS, SUBJECTS

DEMO_PASSWORD = "ExamGenius@2026"


class Command(BaseCommand):
    help = "Load demo subjects/topics and demo accounts"

    @transaction.atomic
    def handle(self, *args, **opts):
        topics_by_name = {}
        for s in SUBJECTS:
            subj, _ = Subject.objects.update_or_create(code=s["code"], defaults={
                "name": s["name"], "short": s["short"], "semester": s["semester"], "color": s["color"],
                "icon": s["icon"], "description": s["description"], "is_official": True})
            pending = []
            for mi, (mtitle, topics) in enumerate(s["modules"], start=1):
                unit, _ = Unit.objects.update_or_create(subject=subj, number=mi, defaults={"title": mtitle})
                for ti, (name, imp, summary, prereqs) in enumerate(topics):
                    t, _ = Topic.objects.update_or_create(unit=unit, name=name, defaults={
                        "importance": imp, "summary": summary, "order": ti})
                    topics_by_name[(subj.code, name)] = t
                    topics_by_name.setdefault(("*", name), t)
                    pending.append((t, prereqs))
            for t, prereqs in pending:
                t.prerequisites.set([topics_by_name[(subj.code, p)] for p in prereqs])
        for name, pre in CROSS_PREREQS:
            topics_by_name[("*", name)].prerequisites.add(topics_by_name[("*", pre)])

        # Demo accounts - clearly marked DEMO
        student, created = User.objects.get_or_create(email="student@demo.examgenius", defaults={
            "username": "student@demo.examgenius", "first_name": "Demo", "last_name": "Student"})
        if created:
            student.set_password(DEMO_PASSWORD)
            student.save()
        StudentProfile.objects.get_or_create(user=student, defaults={
            "college": "ATME College of Engineering (DEMO)", "semester": 5, "year": 3})
        today = date.today()
        for code, days in [("BCS515B", 12), ("BRMK557", 20), ("BCS502", 4)]:
            Enrollment.objects.get_or_create(user=student, subject=Subject.objects.get(code=code),
                                             defaults={"exam_date": today + timedelta(days=days)})

        faculty, created = User.objects.get_or_create(email="faculty@demo.examgenius", defaults={
            "username": "faculty@demo.examgenius", "first_name": "Demo", "last_name": "Faculty",
            "role": User.FACULTY, "is_staff": True})
        if created:
            faculty.set_password(DEMO_PASSWORD)
            faculty.save()
        # Faculty may manage academic content in Django admin - nothing else.
        perms = Permission.objects.filter(content_type__app_label="academics",
                                          codename__regex=r"_(subject|unit|topic|syllabus)$")
        faculty.user_permissions.set(perms)

        self.stdout.write(self.style.SUCCESS(
            f"Loaded {Subject.objects.count()} subjects, {Topic.objects.count()} topics.\n"
            f"DEMO student: student@demo.examgenius / {DEMO_PASSWORD}\n"
            f"DEMO faculty: faculty@demo.examgenius / {DEMO_PASSWORD}"))
