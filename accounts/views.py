from datetime import date

from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from academics.models import Enrollment, Subject
from study.engine import log_activity
from .models import StudentProfile, User

PROFILE_FIELDS = ["college", "university", "degree", "branch", "year", "semester", "usn",
                  "learning_style", "default_mode", "daily_hours", "preferred_time"]


class LoginThrottle(ScopedRateThrottle):
    scope_attr = "throttle_scope"


def user_payload(user):
    p, _ = StudentProfile.objects.get_or_create(user=user)
    return {
        "id": user.id, "email": user.email, "first_name": user.first_name, "last_name": user.last_name,
        "full_name": user.full_name, "role": "faculty" if user.is_faculty else "student",
        "is_admin": user.is_superuser, "date_joined": user.date_joined,
        "profile": {f: getattr(p, f) for f in PROFILE_FIELDS},
        "enrollments": [{"id": e.id, "subject_id": e.subject_id, "code": e.subject.code, "name": e.subject.name,
                         "short": e.subject.short, "color": e.subject.color, "icon": e.subject.icon,
                         "exam_date": e.exam_date} for e in user.enrollments.select_related("subject")],
    }


def _clean_profile(data, errors):
    out = {}
    for f in PROFILE_FIELDS:
        if f not in data:
            continue
        v = data[f]
        if f in ("year", "semester"):
            try:
                v = int(v)
            except (TypeError, ValueError):
                errors[f] = "Must be a number."
                continue
            if f == "year" and not 1 <= v <= 5:
                errors[f] = "Year must be 1-5."
            if f == "semester" and not 1 <= v <= 10:
                errors[f] = "Semester must be 1-10."
        elif f == "daily_hours":
            try:
                v = float(v)
            except (TypeError, ValueError):
                errors[f] = "Must be a number."
                continue
            if not 0.5 <= v <= 14:
                errors[f] = "Daily hours must be between 0.5 and 14."
        else:
            v = str(v).strip()[:160]
            choices = {"learning_style": StudentProfile.STYLES, "default_mode": StudentProfile.MODES,
                       "preferred_time": StudentProfile.TIMES}.get(f)
            if choices and v not in {c[0] for c in choices}:
                errors[f] = "Invalid choice."
        out[f] = v
    return out


def _set_enrollments(user, items, errors):
    if items is None:
        return
    keep = []
    for it in items:
        try:
            subj = Subject.objects.get(id=int(it.get("subject_id")))
        except (Subject.DoesNotExist, TypeError, ValueError):
            errors["subjects"] = "Unknown subject."
            return
        exam = it.get("exam_date") or None
        if exam:
            try:
                exam = date.fromisoformat(str(exam)[:10])
            except ValueError:
                errors["subjects"] = "Invalid exam date."
                return
        keep.append((subj, exam))
    Enrollment.objects.filter(user=user).exclude(subject__in=[s for s, _ in keep]).delete()
    for subj, exam in keep:
        Enrollment.objects.update_or_create(user=user, subject=subj, defaults={"exam_date": exam})


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf(request):
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([AllowAny])
def me(request):
    if not request.user.is_authenticated:
        return Response({"authenticated": False})
    return Response({"authenticated": True, "user": user_payload(request.user)})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def register(request):
    d = request.data
    errors = {}
    email = str(d.get("email", "")).strip().lower()
    name = str(d.get("full_name", "")).strip()
    password = str(d.get("password", ""))
    try:
        validate_email(email)
    except ValidationError:
        errors["email"] = "Enter a valid email address."
    if not errors.get("email") and User.objects.filter(email__iexact=email).exists():
        errors["email"] = "An account with this email already exists."
    if len(name) < 2:
        errors["full_name"] = "Enter your full name."
    first, _, last = name.partition(" ")
    try:
        validate_password(password, User(email=email, first_name=first, last_name=last))
    except ValidationError as e:
        errors["password"] = " ".join(e.messages)
    profile = _clean_profile(d, errors)
    if errors:
        return Response({"errors": errors, "detail": "Please fix the highlighted fields."}, status=400)
    with transaction.atomic():
        user = User.objects.create_user(username=email, email=email, password=password,
                                        first_name=first[:150], last_name=last[:150])
        StudentProfile.objects.create(user=user, **profile)
        _set_enrollments(user, d.get("subjects"), errors)
        if errors:
            transaction.set_rollback(True)
            return Response({"errors": errors, "detail": "Please fix the highlighted fields."}, status=400)
    login(request, user)
    log_activity(user, "account", "Joined ExamGenius AI")
    return Response({"user": user_payload(user)}, status=201)


register.cls.throttle_scope = "register"


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def login_view(request):
    email = str(request.data.get("email", "")).strip().lower()
    password = str(request.data.get("password", ""))
    user = authenticate(request, username=email, password=password)
    if not user:
        return Response({"detail": "Incorrect email or password."}, status=400)
    login(request, user)
    log_activity(user, "login", "Signed in")
    return Response({"user": user_payload(user)})


login_view.cls.throttle_scope = "login"


@api_view(["POST"])
def logout_view(request):
    logout(request)
    return Response({"ok": True})


@api_view(["GET", "PATCH"])
def profile(request):
    if request.method == "PATCH":
        errors = {}
        d = request.data
        data = _clean_profile(d, errors)
        name = d.get("full_name")
        if name is not None and len(str(name).strip()) < 2:
            errors["full_name"] = "Enter your full name."
        if errors:
            return Response({"errors": errors, "detail": "Please fix the highlighted fields."}, status=400)
        StudentProfile.objects.filter(user=request.user).update(**data)
        if name is not None:
            first, _, last = str(name).strip().partition(" ")
            request.user.first_name, request.user.last_name = first[:150], last[:150]
            request.user.save(update_fields=["first_name", "last_name"])
        _set_enrollments(request.user, d.get("subjects"), errors)
        if errors:
            return Response({"errors": errors, "detail": errors["subjects"]}, status=400)
    return Response({"user": user_payload(request.user)})


@api_view(["POST"])
def change_password(request):
    old, new = request.data.get("old_password", ""), request.data.get("new_password", "")
    if not request.user.check_password(old):
        return Response({"errors": {"old_password": "Current password is incorrect."}, "detail": "Current password is incorrect."}, status=400)
    try:
        validate_password(new, request.user)
    except ValidationError as e:
        return Response({"errors": {"new_password": " ".join(e.messages)}, "detail": " ".join(e.messages)}, status=400)
    request.user.set_password(new)
    request.user.save()
    update_session_auth_hash(request, request.user)
    return Response({"ok": True})


@api_view(["POST"])
def delete_account(request):
    if not request.user.check_password(request.data.get("password", "")):
        return Response({"detail": "Password is incorrect - account not deleted."}, status=400)
    user = request.user
    for doc in user.documents.all():
        doc.delete()  # removes files from disk too
    logout(request)
    user.delete()  # cascades to every student-owned row
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def password_reset(request):
    """Always answers the same way, so nobody can find out which emails are registered."""
    email = str(request.data.get("email", "")).strip().lower()
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user:
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        link = f"{request.scheme}://{request.get_host()}/reset-password?uid={uid}&token={token}"
        send_mail("Reset your ExamGenius AI password",
                  f"Hi {user.first_name or 'there'},\n\nOpen this link to choose a new password (valid for 3 days):\n{link}\n\n"
                  "If you didn't ask for this, ignore this email.", "noreply@examgenius.local", [user.email])
    note = ("Local demo: emails are printed in the terminal window running the server - copy the link from there."
            if settings.EMAIL_BACKEND.endswith("console.EmailBackend") else "")
    return Response({"ok": True, "detail": "If that email is registered, a reset link has been sent.", "note": note})


password_reset.cls.throttle_scope = "login"


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def password_reset_confirm(request):
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(str(request.data.get("uid", "")))))
    except (User.DoesNotExist, ValueError, TypeError, OverflowError):
        user = None
    if not user or not default_token_generator.check_token(user, str(request.data.get("token", ""))):
        return Response({"detail": "This reset link is invalid or has expired. Request a new one."}, status=400)
    new = str(request.data.get("new_password", ""))
    try:
        validate_password(new, user)
    except ValidationError as e:
        return Response({"detail": " ".join(e.messages), "errors": {"new_password": " ".join(e.messages)}}, status=400)
    user.set_password(new)
    user.save()
    return Response({"ok": True, "detail": "Password changed - you can sign in now."})


password_reset_confirm.cls.throttle_scope = "login"
