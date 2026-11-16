from django.core.exceptions import ObjectDoesNotExist
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import exception_handler as drf_handler

from .ai import AIError, ai_configured


class AIThrottle(UserRateThrottle):
    scope = "ai"


def exception_handler(exc, context):
    from .rag import PDFError

    if isinstance(exc, AIError):
        status = 503 if exc.code in ("not_configured", "unavailable", "timeout", "rate") else 502
        if exc.code in ("auth", "quota", "model"):
            status = 503
        return Response({"detail": exc.user_message, "ai_error": exc.code}, status=status)
    if isinstance(exc, PDFError):
        return Response({"detail": str(exc)}, status=400)
    if isinstance(exc, ObjectDoesNotExist):
        return Response({"detail": "Not found."}, status=404)
    resp = drf_handler(exc, context)
    if resp is not None and isinstance(resp.data, dict) and "detail" in resp.data:
        resp.data["detail"] = str(resp.data["detail"])
    return resp


def ai_status():
    return {"configured": ai_configured()}
