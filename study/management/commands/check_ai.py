"""python manage.py check_ai  -  verify the AI key works and list the models it can use."""
import time

from django.conf import settings
from django.core.management.base import BaseCommand

from study import ai


class Command(BaseCommand):
    help = "Check the configured AI provider, key and model"

    def handle(self, *args, **opts):
        w = self.stdout.write
        w(f"Provider : {settings.AI_PROVIDER_LABEL}  (AI_PROVIDER={settings.AI_PROVIDER})")
        w(f"Key      : {settings.AI_KEY_ENV} = " + (settings.AI_API_KEY[:6] + "..." + settings.AI_API_KEY[-4:] if settings.AI_API_KEY else "NOT SET"))
        w(f"Endpoint : {settings.AI_BASE_URL or 'https://api.openai.com/v1'}")
        w(f"Model    : {settings.OPENAI_CHAT_MODEL}   embeddings: {settings.OPENAI_EMBED_MODEL}")
        if not settings.AI_API_KEY:
            self.stderr.write(self.style.ERROR(f"\nAdd {settings.AI_KEY_ENV}=your-key to backend/.env first."))
            return
        client = ai.get_client()
        try:
            listing = client.models.list()
            if isinstance(listing, str):
                w(f"\n(Model list returned as text: {listing[:200]})")
                listing = []
            names = sorted(getattr(m, "id", str(m)) for m in listing)
            chatty = [n for n in names if any(k in n for k in ("flash", "gpt", "gemini", "o4", "o3"))]
            w(f"\nModels available to this key ({len(names)}), e.g.:\n  " + "\n  ".join((chatty or names)[:25]))
        except Exception as exc:  # noqa: BLE001
            w(f"\n(Could not list models: {str(exc)[:150]})")
        w("\nSending a test question...")
        t0 = time.perf_counter()
        try:
            reply = ai.chat(None, "check", [{"role": "user", "content": "In one sentence: what is an intelligent agent in AI?"}],
                            max_tokens=120, cache=False)
            w(self.style.SUCCESS(f"\nOK in {time.perf_counter() - t0:.1f}s. Reply: {reply[:300]}"))
            w(self.style.SUCCESS("Your AI setup works - start the app with: python manage.py runserver"))
        except ai.AIError as err:
            self.stderr.write(self.style.ERROR(f"\nFAILED: {err.user_message}\nDetails: {err.detail[:400]}"))
            if settings.AI_PROVIDER == "github":
                w("\nTip for GitHub Models: try the older endpoint by adding these lines to backend/.env:\n"
                  "  AI_BASE_URL=https://models.inference.ai.azure.com\n  AI_CHAT_MODEL=gpt-4o-mini\n"
                  "  AI_EMBED_MODEL=text-embedding-3-small\nand check the token has the 'Models: Read-only' permission.")
