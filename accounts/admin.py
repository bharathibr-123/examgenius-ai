from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import StudentProfile, User


@admin.register(User)
class ExamUserAdmin(UserAdmin):
    list_display = ("email", "first_name", "role", "is_staff", "date_joined")
    list_filter = ("role", "is_staff")
    search_fields = ("email", "first_name", "last_name")
    ordering = ("-date_joined",)
    fieldsets = UserAdmin.fieldsets + (("ExamGenius", {"fields": ("role",)}),)


@admin.register(StudentProfile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "college", "branch", "semester", "year")
