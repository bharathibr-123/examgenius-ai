from django.contrib import admin

from .models import Enrollment, Subject, Syllabus, Topic, Unit


class UnitInline(admin.TabularInline):
    model = Unit
    extra = 0


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "semester", "is_official")
    inlines = [UnitInline]


class TopicInline(admin.TabularInline):
    model = Topic
    extra = 0
    fields = ("name", "importance", "order", "summary")


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ("subject", "number", "title")
    list_filter = ("subject",)
    inlines = [TopicInline]


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ("name", "unit", "importance")
    list_filter = ("unit__subject",)
    search_fields = ("name",)
    filter_horizontal = ("prerequisites",)


admin.site.register(Enrollment)
admin.site.register(Syllabus)
