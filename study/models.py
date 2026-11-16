from django.conf import settings
from django.db import models

from academics.models import Subject, Topic

User = settings.AUTH_USER_MODEL


# ----------------------------------------------------------------------------- AI bookkeeping
class AICache(models.Model):
    """Identical AI requests are answered from here (0 tokens) - sustainability."""
    key = models.CharField(max_length=64, unique=True)
    feature = models.CharField(max_length=30)
    response = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)


class AIUsageLog(models.Model):
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name="ai_logs")
    feature = models.CharField(max_length=30)
    model = models.CharField(max_length=60, blank=True)
    prompt_tokens = models.PositiveIntegerField(default=0)
    completion_tokens = models.PositiveIntegerField(default=0)
    latency_ms = models.PositiveIntegerField(default=0)
    cached = models.BooleanField(default=False)
    ok = models.BooleanField(default=True)
    error = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)


class Activity(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="activities")
    kind = models.CharField(max_length=30)
    text = models.CharField(max_length=255)
    link = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]


# ----------------------------------------------------------------------------- Tutor
class Conversation(models.Model):
    KINDS = [("tutor", "Tutor"), ("doc", "Document Q&A")]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="conversations")
    subject = models.ForeignKey(Subject, null=True, blank=True, on_delete=models.SET_NULL)
    topic = models.ForeignKey(Topic, null=True, blank=True, on_delete=models.SET_NULL)
    document = models.ForeignKey("Document", null=True, blank=True, on_delete=models.CASCADE)
    kind = models.CharField(max_length=10, choices=KINDS, default="tutor")
    title = models.CharField(max_length=160, default="New conversation")
    mode = models.CharField(max_length=12, default="exam")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=10)  # user / assistant
    content = models.TextField()
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]


class TopicNote(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="topic_notes")
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE)
    style = models.CharField(max_length=10, default="short")
    content = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "topic", "style")


# ----------------------------------------------------------------------------- Documents (RAG)
class Document(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="documents")
    subject = models.ForeignKey(Subject, null=True, blank=True, on_delete=models.SET_NULL)
    title = models.CharField(max_length=200)
    file = models.FileField(upload_to="docs/%Y/%m/")
    pages = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=12, default="ready")  # ready / no_text
    retrieval = models.CharField(max_length=12, default="keyword")  # embedding / keyword
    summary = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def delete(self, *args, **kwargs):
        storage, name = self.file.storage, self.file.name
        super().delete(*args, **kwargs)
        if name:
            storage.delete(name)


class Chunk(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="chunks")
    page = models.PositiveIntegerField()
    text = models.TextField()
    embedding = models.BinaryField(null=True, blank=True)  # float32 bytes


# ----------------------------------------------------------------------------- Quizzes & evidence
class Quiz(models.Model):
    KINDS = [("practice", "Practice quiz"), ("mock", "Exam hall mock"), ("doubt", "Doubt check"),
             ("revision", "Mistake revision"), ("viva", "Viva"), ("evaluator", "Answer evaluator")]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="quizzes")
    subject = models.ForeignKey(Subject, null=True, blank=True, on_delete=models.SET_NULL)
    title = models.CharField(max_length=200)
    kind = models.CharField(max_length=10, choices=KINDS, default="practice")
    difficulty = models.CharField(max_length=10, default="medium")  # easy/medium/hard/adaptive
    duration_min = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    started_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    score = models.FloatField(default=0)
    max_score = models.FloatField(default=0)
    feedback = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def percent(self):
        return round(100 * self.score / self.max_score, 1) if self.max_score else 0


class Question(models.Model):
    TYPES = [("mcq", "Multiple choice"), ("tf", "True/False"), ("fill", "Fill in the blank"), ("short", "Short answer")]
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="questions")
    topic = models.ForeignKey(Topic, null=True, blank=True, on_delete=models.SET_NULL)
    qtype = models.CharField(max_length=6, choices=TYPES)
    text = models.TextField()
    options = models.JSONField(default=list, blank=True)
    answer = models.TextField()  # mcq: option text; tf: "True"/"False"; fill: answer; short: model answer
    accept = models.JSONField(default=list, blank=True)  # extra accepted answers for fill-in
    key_points = models.JSONField(default=list, blank=True)  # rubric points for short answers
    marks = models.FloatField(default=1)
    explanation = models.TextField(blank=True)
    difficulty = models.CharField(max_length=10, default="medium")
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]


class Answer(models.Model):
    CONF = [(1, "Guessing"), (2, "Unsure"), (3, "Sure")]
    question = models.OneToOneField(Question, on_delete=models.CASCADE, related_name="student_answer")
    response = models.TextField(blank=True)
    confidence = models.PositiveSmallIntegerField(choices=CONF, null=True, blank=True)
    is_correct = models.BooleanField(default=False)
    marks_awarded = models.FloatField(default=0)
    feedback = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)


class TopicMastery(models.Model):
    LEVELS = ["easy", "medium", "hard"]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="mastery")
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="mastery")
    score = models.FloatField(default=0)
    attempts = models.PositiveIntegerField(default=0)
    level = models.CharField(max_length=6, default="easy")
    streak_correct = models.PositiveSmallIntegerField(default=0)
    streak_wrong = models.PositiveSmallIntegerField(default=0)
    simplify_next = models.BooleanField(default=False)
    last_practised = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("user", "topic")
        indexes = [models.Index(fields=["user", "score"])]


class Mistake(models.Model):
    """Mistake Memory + Revision Time Machine (spaced repetition)."""
    INTERVALS = [1, 3, 7, 14, 30]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="mistakes")
    topic = models.ForeignKey(Topic, null=True, blank=True, on_delete=models.SET_NULL)
    source_answer = models.ForeignKey(Answer, null=True, blank=True, on_delete=models.SET_NULL)
    qtype = models.CharField(max_length=6)
    question_text = models.TextField()
    options = models.JSONField(default=list, blank=True)
    your_answer = models.TextField(blank=True)
    correct_answer = models.TextField()
    accept = models.JSONField(default=list, blank=True)
    explanation = models.TextField(blank=True)
    marks = models.FloatField(default=1)
    step = models.PositiveSmallIntegerField(default=0)
    due_date = models.DateField(db_index=True)
    revisions = models.PositiveSmallIntegerField(default=0)
    last_result = models.CharField(max_length=10, blank=True)
    resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["due_date", "-created_at"]


class AnswerEvaluation(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="evaluations")
    subject = models.ForeignKey(Subject, null=True, blank=True, on_delete=models.SET_NULL)
    topic = models.ForeignKey(Topic, null=True, blank=True, on_delete=models.SET_NULL)
    question = models.TextField()
    marks = models.PositiveSmallIntegerField()
    answer = models.TextField()
    result = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


# ----------------------------------------------------------------------------- Planner
class StudyPlan(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="plans")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    exam_date = models.DateField()
    daily_hours = models.FloatField()
    mode = models.CharField(max_length=8, default="normal")  # normal / rescue
    active = models.BooleanField(default=True)
    notes = models.JSONField(default=list, blank=True)  # human-readable change log
    uncovered = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class StudyTask(models.Model):
    KINDS = [("study", "Study"), ("revise", "Revise"), ("quiz", "Quiz"), ("break", "Break"), ("mock", "Mock exam")]
    plan = models.ForeignKey(StudyPlan, on_delete=models.CASCADE, related_name="tasks")
    date = models.DateField(db_index=True)
    order = models.PositiveSmallIntegerField(default=0)
    topic = models.ForeignKey(Topic, null=True, blank=True, on_delete=models.SET_NULL)
    kind = models.CharField(max_length=6, choices=KINDS)
    title = models.CharField(max_length=200)
    minutes = models.PositiveSmallIntegerField()
    priority = models.FloatField(default=0)
    status = models.CharField(max_length=8, default="pending")  # pending/done/missed/skipped
    completed_at = models.DateTimeField(null=True, blank=True)
    rescheduled_from = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["date", "order", "id"]


# ----------------------------------------------------------------------------- New: papers & focus sessions
class QuestionPaper(models.Model):
    """AI-generated VTU-style model question paper (printable / downloadable as PDF)."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="papers")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    content = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class FocusSession(models.Model):
    """Pomodoro / focus timer sessions - real study time for analytics."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="focus_sessions")
    task = models.ForeignKey(StudyTask, null=True, blank=True, on_delete=models.SET_NULL)
    label = models.CharField(max_length=200, blank=True)
    minutes = models.PositiveSmallIntegerField()
    completed_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-completed_at"]
