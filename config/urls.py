from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path, re_path
from django.views.decorators.csrf import ensure_csrf_cookie


@ensure_csrf_cookie
def spa(request, *args, **kwargs):
    """Serve the built React app for every non-API URL."""
    index = settings.FRONTEND_DIST / "index.html"
    if not index.exists():
        return HttpResponse(
            "<h2>Frontend build not found.</h2><p>The API is running. Build the frontend with "
            "<code>cd frontend; npm install; npm run build</code>.</p>", status=200)
    return HttpResponse(index.read_text(encoding="utf-8"))


urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("academics.urls")),
    path("api/", include("study.urls")),
]
urlpatterns += [re_path(r"^(?!api/|django-admin/|static/|media/).*$", spa)]

admin.site.site_header = "ExamGenius AI administration"
admin.site.site_title = "ExamGenius AI admin"
