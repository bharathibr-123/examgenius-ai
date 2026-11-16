from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Login is by email. `username` is kept equal to the email for Django admin compatibility."""
    STUDENT, FACULTY = "student", "faculty"
    ROLES = [(STUDENT, "Student"), (FACULTY, "Faculty")]

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=10, choices=ROLES, default=STUDENT)

    @property
    def is_faculty(self):
        return self.role == self.FACULTY or self.is_staff

    @property
    def full_name(self):
        return (self.first_name + " " + self.last_name).strip() or self.email.split("@")[0]


class StudentProfile(models.Model):
    STYLES = [("examples", "Examples"), ("diagrams", "Diagrams"), ("steps", "Step-by-step"),
              ("theory", "Theory"), ("practice", "Practice questions")]
    TIMES = [("morning", "Morning"), ("afternoon", "Afternoon"), ("evening", "Evening"), ("night", "Night")]
    MODES = [("beginner", "Beginner"), ("simple", "Simple"), ("detailed", "Detailed"),
             ("exam", "Exam preparation"), ("interview", "Interview preparation")]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    college = models.CharField(max_length=160, blank=True)
    university = models.CharField(max_length=120, blank=True, default="VTU")
    degree = models.CharField(max_length=60, blank=True, default="B.E.")
    branch = models.CharField(max_length=80, blank=True, default="Computer Science & Engineering")
    year = models.PositiveSmallIntegerField(default=3)
    semester = models.PositiveSmallIntegerField(default=5)
    usn = models.CharField(max_length=20, blank=True)
    learning_style = models.CharField(max_length=12, choices=STYLES, default="examples")
    default_mode = models.CharField(max_length=12, choices=MODES, default="exam")
    daily_hours = models.FloatField(default=4)
    preferred_time = models.CharField(max_length=10, choices=TIMES, default="evening")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Profile of {self.user.email}"
