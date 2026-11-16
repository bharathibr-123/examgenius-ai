"""ExamGenius AI - Django settings.

All secrets come from backend/.env (copy .env.example to .env).
"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY") or "dev-only-insecure-key-change-me-in-production"
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = [h.strip() for h in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]
CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.getenv(
    "DJANGO_CSRF_TRUSTED_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000,http://localhost:5173,http://127.0.0.1:5173"
).split(",") if o.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "accounts",
    "academics",
    "study",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
FRONTEND_DIST = BASE_DIR / "frontend_dist"

TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [FRONTEND_DIST],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
# Optional PostgreSQL: set DATABASE_URL=postgres://user:pass@host:5432/dbname (needs psycopg installed)
if os.getenv("DATABASE_URL", "").startswith("postgres"):
    from urllib.parse import urlparse
    u = urlparse(os.environ["DATABASE_URL"])
    DATABASES["default"] = {
        "ENGINE": "django.db.backends.postgresql", "NAME": u.path.lstrip("/"),
        "USER": u.username, "PASSWORD": u.password, "HOST": u.hostname, "PORT": u.port or 5432,
    }

AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("TIME_ZONE", "Asia/Kolkata")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
WHITENOISE_ROOT = FRONTEND_DIST  # serves /assets/*, favicon etc. from the built React app
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Uploads
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "10"))
MAX_PDF_PAGES = int(os.getenv("MAX_PDF_PAGES", "60"))
DATA_UPLOAD_MAX_MEMORY_SIZE = (MAX_UPLOAD_MB + 1) * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = (MAX_UPLOAD_MB + 1) * 1024 * 1024

# Sessions & cookies
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_AGE = 60 * 60 * 24 * 7
if not DEBUG:  # production / HTTPS
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = env_bool("DJANGO_SSL_REDIRECT", True)
    SECURE_HSTS_SECONDS = 3600
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_THROTTLE_RATES": {
        "ai": os.getenv("AI_RATE_LIMIT", "120/hour"),
        "login": "20/min",
        "register": "10/hour",
    },
    "EXCEPTION_HANDLER": "study.views_common.exception_handler",
}

# ----------------------------------------------------------------------------- AI provider
# AI_PROVIDER = openai | gemini | github   (blank = picked automatically from whichever key is filled in)
#   openai : paid OpenAI API (ChatGPT models)             key: OPENAI_API_KEY
#   gemini : Google Gemini free tier (OpenAI-compatible)   key: GEMINI_API_KEY
#   github : GitHub Models free tier (ChatGPT models)      key: GITHUB_TOKEN
AI_PROVIDERS = {
    "openai": {"label": "OpenAI ChatGPT", "key_env": "OPENAI_API_KEY", "base_url": None,
               "chat": "gpt-4o-mini", "embed": "text-embedding-3-small", "max_output": 16000},
    "gemini": {"label": "Google Gemini", "key_env": "GEMINI_API_KEY",
               "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
               "chat": "gemini-flash-latest", "embed": "gemini-embedding-001", "max_output": 16000},
    "github": {"label": "ChatGPT via GitHub Models", "key_env": "GITHUB_TOKEN",
               "base_url": "https://models.github.ai/inference",
               "chat": "openai/gpt-4o-mini", "embed": "openai/text-embedding-3-small", "max_output": 4000},
}
AI_PROVIDER = os.getenv("AI_PROVIDER", "").strip().lower()
if AI_PROVIDER not in AI_PROVIDERS:
    AI_PROVIDER = next((p for p, c in AI_PROVIDERS.items() if os.getenv(c["key_env"], "").strip()), "openai")
_prov = AI_PROVIDERS[AI_PROVIDER]
AI_PROVIDER_LABEL = _prov["label"]
AI_KEY_ENV = _prov["key_env"]
AI_API_KEY = os.getenv(AI_KEY_ENV, "").strip()
AI_BASE_URL = os.getenv("AI_BASE_URL", "").strip() or _prov["base_url"]
AI_MAX_OUTPUT = int(os.getenv("AI_MAX_OUTPUT_TOKENS", _prov["max_output"]))
OPENAI_API_KEY = AI_API_KEY  # kept for backwards compatibility
OPENAI_CHAT_MODEL = (os.getenv("AI_CHAT_MODEL") or (os.getenv("OPENAI_CHAT_MODEL") if AI_PROVIDER == "openai" else "")
                     or _prov["chat"]).strip()
OPENAI_EMBED_MODEL = (os.getenv("AI_EMBED_MODEL") or (os.getenv("OPENAI_EMBED_MODEL") if AI_PROVIDER == "openai" else "")
                      or _prov["embed"]).strip()
OPENAI_TIMEOUT = float(os.getenv("AI_TIMEOUT", "90"))
PRICE_INPUT_PER_M = float(os.getenv("PRICE_INPUT_PER_M", "0" if AI_PROVIDER != "openai" else "0.15"))
PRICE_OUTPUT_PER_M = float(os.getenv("PRICE_OUTPUT_PER_M", "0" if AI_PROVIDER != "openai" else "0.60"))
# Tests swap in a fake AI client; never used in normal runs.
AI_CLIENT_FACTORY = None

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

LOGGING = {
    "version": 1,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {"examgenius": {"handlers": ["console"], "level": "INFO"}},
}
