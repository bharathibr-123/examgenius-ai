"""The ONLY module that talks to OpenAI.

* API key stays on the server (.env) - never sent to the browser.
* Every call is logged (tokens, latency) in AIUsageLog.
* Identical requests are served from AICache (0 tokens) - sustainability.
* JSON replies are validated with Pydantic; one automatic repair retry.
* Clear, honest errors - the app never invents an AI answer.
"""
from __future__ import annotations

import hashlib
import importlib
import json
import logging
import time

from django.conf import settings
from pydantic import BaseModel, ValidationError

from .models import AICache, AIUsageLog

log = logging.getLogger("examgenius")


def _messages():
    p, key, label = settings.AI_PROVIDER, settings.AI_KEY_ENV, settings.AI_PROVIDER_LABEL
    quota = {
        "openai": "Your OpenAI account has no remaining credit. Add credit at platform.openai.com > Billing, "
                  "or switch to the free Gemini / GitHub option (see README).",
        "gemini": "Gemini free-tier limit reached (too many requests per minute or per day). Wait a minute and try again; "
                  "the daily quota resets at midnight Pacific time.",
        "github": "GitHub Models free limit reached (about 15 requests/minute, 150/day). Wait a minute or try again tomorrow.",
    }[p]
    return {
        "not_configured": f"AI is not configured. Add your {key} to backend/.env and restart the server.",
        "auth": f"{label} rejected the API key. Check {key} in backend/.env (copy it again, no spaces or quotes).",
        "quota": quota,
        "rate": f"{label} is rate-limiting requests right now. Wait about a minute and try again.",
        "timeout": f"{label} took too long to respond. Please try again.",
        "unavailable": f"Could not reach {label}. Check your internet connection and try again.",
        "model": f"The model '{settings.OPENAI_CHAT_MODEL}' is not available for this key. Set AI_CHAT_MODEL in backend/.env "
                 f"(run: python manage.py check_ai to list available models).",
        "bad_output": "The AI returned an answer in an unexpected format. Please try again.",
        "other": "The AI request failed. Please try again.",
    }


class AIError(Exception):
    def __init__(self, code: str, detail: str = ""):
        self.code = code
        self.detail = detail
        msgs = _messages()
        super().__init__(msgs.get(code, msgs["other"]))

    @property
    def user_message(self):
        return str(self)


def ai_configured() -> bool:
    return bool(settings.AI_CLIENT_FACTORY or settings.AI_API_KEY)


_client = None


def get_client():
    global _client
    if settings.AI_CLIENT_FACTORY:  # tests only
        mod, _, attr = settings.AI_CLIENT_FACTORY.rpartition(".")
        return getattr(importlib.import_module(mod), attr)()
    if not settings.AI_API_KEY:
        raise AIError("not_configured")
    if _client is None:
        from openai import OpenAI
        _client = OpenAI(api_key=settings.AI_API_KEY, base_url=settings.AI_BASE_URL or None,
                         timeout=settings.OPENAI_TIMEOUT, max_retries=3)
    return _client


def _map_exception(exc) -> AIError:
    name = type(exc).__name__
    text = str(exc)
    low = text.lower()
    if name == "AuthenticationError" or ("api key" in low and ("invalid" in low or "not valid" in low)):
        return AIError("auth", text)
    if name == "RateLimitError":
        return AIError("quota" if ("quota" in low or "resource_exhausted" in low or "exhausted" in low) else "rate", text)
    if name == "APITimeoutError":
        return AIError("timeout", text)
    if name == "APIConnectionError":
        return AIError("unavailable", text)
    if name in ("NotFoundError", "PermissionDeniedError") or "model" in text.lower() and "not" in text.lower():
        return AIError("model", text)
    return AIError("other", text)


def _create(client, kwargs):
    """Call Chat Completions, adapting to parameter differences between model families."""
    for _ in range(5):
        try:
            return client.chat.completions.create(**kwargs)
        except Exception as exc:  # noqa: BLE001
            msg = str(exc)
            if type(exc).__name__ == "BadRequestError":
                if "reasoning" in msg and "reasoning_effort" in kwargs:
                    kwargs.pop("reasoning_effort")
                    continue
                if "response_format" in msg and "response_format" in kwargs:
                    kwargs.pop("response_format")
                    continue
                if "temperature" in msg and "temperature" in kwargs:
                    kwargs.pop("temperature")
                    continue
                if "max_completion_tokens" in msg and "max_completion_tokens" in kwargs:
                    kwargs["max_tokens"] = kwargs.pop("max_completion_tokens")
                    continue
                if "max_tokens" in msg and "max_tokens" in kwargs and "max_completion_tokens" in msg:
                    kwargs["max_completion_tokens"] = kwargs.pop("max_tokens")
                    continue
            raise _map_exception(exc) from exc
    raise AIError("other", "parameter negotiation failed")


def _log(user, feature, model, pt=0, ct=0, ms=0, cached=False, ok=True, error=""):
    AIUsageLog.objects.create(
        user=user if getattr(user, "is_authenticated", False) else None, feature=feature, model=model,
        prompt_tokens=pt, completion_tokens=ct, latency_ms=ms, cached=cached, ok=ok, error=error[:300])


def _ns(obj):
    from types import SimpleNamespace
    if isinstance(obj, dict):
        return SimpleNamespace(**{k: _ns(v) for k, v in obj.items()})
    if isinstance(obj, list):
        return [_ns(v) for v in obj]
    return obj


def _normalize(resp):
    """Some OpenAI-compatible servers (e.g. GitHub Models) reply with a non-JSON content type, so the SDK
    returns the raw body as a string. Parse it ourselves; if it isn't JSON, report what the server said."""
    if not isinstance(resp, (str, bytes)):
        return resp
    raw = resp.decode() if isinstance(resp, bytes) else resp
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise AIError("other", "Server returned non-JSON: " + raw[:300]) from None
    if isinstance(data, dict) and "error" in data and "choices" not in data and "data" not in data:
        err = data["error"]
        msg = err.get("message", str(err)) if isinstance(err, dict) else str(err)
        code = str(err.get("code", "")).lower() if isinstance(err, dict) else ""
        low = msg.lower()
        if "unauthorized" in code or "auth" in low or "token" in low and "invalid" in low or "permission" in low:
            raise AIError("auth", msg)
        if "rate" in code or "rate" in low or "quota" in low:
            raise AIError("quota", msg)
        if "model" in low:
            raise AIError("model", msg)
        raise AIError("other", msg)
    return _ns(data)


def _parse_json(text: str):
    """Accept plain JSON, JSON inside ```json fences, or JSON with text around it."""
    t = text.strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[1] if "\n" in t else t[3:]
        t = t.rsplit("```", 1)[0]
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        start, end = t.find("{"), t.rfind("}")
        if start != -1 and end > start:
            return json.loads(t[start:end + 1])
        raise


def chat(user, feature: str, messages: list[dict], *, schema: type[BaseModel] | None = None,
         max_tokens: int = 900, temperature: float = 0.4, cache: bool = True):
    """Send a chat request. Returns str, or a validated Pydantic object when `schema` is given."""
    model = settings.OPENAI_CHAT_MODEL
    key = hashlib.sha256(json.dumps([model, messages, bool(schema), max_tokens, temperature],
                                    sort_keys=True).encode()).hexdigest()
    if cache:
        hit = AICache.objects.filter(key=key).first()
        if hit:
            _log(user, feature, model, cached=True)
            return schema.model_validate_json(hit.response) if schema else hit.response

    client = get_client()
    budget = min(max_tokens, settings.AI_MAX_OUTPUT)
    kwargs = dict(model=model, messages=list(messages), temperature=temperature)
    if settings.AI_PROVIDER == "gemini":
        # Gemini "thinks" before answering and thinking tokens count against the limit:
        # keep thinking low and leave headroom so answers are never cut off.
        kwargs["reasoning_effort"] = "low"
        kwargs["max_tokens"] = min(budget + 2048, settings.AI_MAX_OUTPUT)
    elif settings.AI_PROVIDER == "github":
        kwargs["max_tokens"] = budget
    else:
        kwargs["max_completion_tokens"] = budget
    if schema:
        kwargs["response_format"] = {"type": "json_object"}

    attempts = 2 if schema else 1
    last_error = None
    for attempt in range(attempts):
        t0 = time.perf_counter()
        try:
            resp = _create(client, kwargs)
        except AIError as err:
            _log(user, feature, model, ms=int((time.perf_counter() - t0) * 1000), ok=False, error=err.detail or err.code)
            raise
        ms = int((time.perf_counter() - t0) * 1000)
        try:
            resp = _normalize(resp)
        except AIError as err:
            _log(user, feature, model, ms=ms, ok=False, error=err.detail)
            raise
        usage = getattr(resp, "usage", None)
        pt = getattr(usage, "prompt_tokens", 0) or 0
        ct = getattr(usage, "completion_tokens", 0) or 0
        text = (resp.choices[0].message.content or "").strip()
        if not schema:
            _log(user, feature, model, pt, ct, ms)
            if cache and text:
                AICache.objects.update_or_create(key=key, defaults={"feature": feature, "response": text})
            return text
        try:
            obj = schema.model_validate(_parse_json(text))
            _log(user, feature, model, pt, ct, ms)
            if cache:
                AICache.objects.update_or_create(key=key, defaults={"feature": feature, "response": obj.model_dump_json()})
            return obj
        except (json.JSONDecodeError, ValidationError) as exc:
            last_error = str(exc)[:280]
            _log(user, feature, model, pt, ct, ms, ok=False, error="invalid JSON: " + last_error)
            kwargs["messages"] = list(messages) + [
                {"role": "assistant", "content": text[:4000]},
                {"role": "user", "content": "Your reply did not match the required JSON format. "
                 f"Problem: {last_error}. Reply again with ONLY valid JSON in the exact required structure."}]
    raise AIError("bad_output", last_error or "")


def embed(user, texts: list[str]) -> list[list[float]]:
    client = get_client()
    out = []
    for i in range(0, len(texts), 64):
        batch = texts[i:i + 64]
        t0 = time.perf_counter()
        try:
            resp = client.embeddings.create(model=settings.OPENAI_EMBED_MODEL, input=batch)
        except Exception as exc:  # noqa: BLE001
            err = _map_exception(exc)
            _log(user, "embeddings", settings.OPENAI_EMBED_MODEL, ok=False, error=err.detail or err.code)
            raise err from exc
        resp = _normalize(resp)
        usage = getattr(resp, "usage", None)
        _log(user, "embeddings", settings.OPENAI_EMBED_MODEL, getattr(usage, "prompt_tokens", 0) or 0, 0,
             int((time.perf_counter() - t0) * 1000))
        out.extend(d.embedding for d in resp.data)
    return out
