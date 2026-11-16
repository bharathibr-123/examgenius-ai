from django.contrib import admin

from . import models as m


@admin.register(m.AIUsageLog)
class UsageAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "feature", "model", "prompt_tokens", "completion_tokens", "latency_ms", "cached", "ok")
    list_filter = ("feature", "cached", "ok")


@admin.register(m.Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "kind", "difficulty", "score", "max_score", "submitted_at")
    list_filter = ("kind",)


@admin.register(m.StudyPlan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("user", "subject", "exam_date", "mode", "active")


admin.site.register(m.TopicMastery)
admin.site.register(m.Mistake)
admin.site.register(m.Document)
