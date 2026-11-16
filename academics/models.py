from django.conf import settings
from django.db import models


class Subject(models.Model):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=120)
    short = models.CharField(max_length=12)
    semester = models.PositiveSmallIntegerField(default=5)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=20, default="indigo")
    icon = models.CharField(max_length=30, default="BookOpen")
    is_official = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ["semester", "name"]

    def __str__(self):
        return f"{self.code} {self.name}"


class Unit(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="units")
    number = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=160)

    class Meta:
        ordering = ["subject", "number"]
        unique_together = ("subject", "number")

    def __str__(self):
        return f"{self.subject.short} M{self.number}: {self.title}"


class Topic(models.Model):
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="topics")
    name = models.CharField(max_length=160)
    summary = models.CharField(max_length=300, blank=True)
    importance = models.PositiveSmallIntegerField(default=3, help_text="1 (low) to 5 (very frequently asked)")
    order = models.PositiveSmallIntegerField(default=0)
    prerequisites = models.ManyToManyField("self", symmetrical=False, blank=True, related_name="unlocks")

    class Meta:
        ordering = ["unit__subject", "unit__number", "order", "id"]

    @property
    def subject(self):
        return self.unit.subject

    def __str__(self):
        return self.name


class Enrollment(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="enrollments")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="enrollments")
    exam_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "subject")
        ordering = ["exam_date", "subject__name"]


class Syllabus(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="syllabus_files")
    file = models.FileField(upload_to="syllabus/")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    uploaded_at = models.DateTimeField(auto_now_add=True)
