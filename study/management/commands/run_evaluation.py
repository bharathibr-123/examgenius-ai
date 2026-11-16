"""python manage.py run_evaluation

Runs the assignment's 20 sample inputs through the REAL ExamGenius API (real ChatGPT calls),
checks every output automatically, and writes for the report:

  evaluation_results/results.csv     one row per test input (latency, tokens, pass/fail)
  evaluation_results/outputs.md      the full AI output of every test
  evaluation_results/summary.json    totals
  evaluation_results/graphs/*.png    6 graphs (needs: pip install matplotlib)

Uses a separate account (evaluation@examgenius.local) so your own data is untouched.
"""
import csv
import io
import json
import time
from datetime import date, timedelta
from pathlib import Path

from django.conf import settings
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand
from django.test import Client
from django.test.utils import setup_test_environment

from accounts.models import StudentProfile, User
from academics.models import Enrollment, Subject, Topic
from study.ai import ai_configured
from study.models import AIUsageLog

OUT = settings.BASE_DIR / "evaluation_results"

NOTES_PAGES = [
    "Intelligent Agents. An agent perceives its environment through sensors and acts upon it through actuators. "
    "A rational agent selects the action expected to maximise its performance measure. The task environment is "
    "specified by PEAS: Performance, Environment, Actuators, Sensors.",
    "Uninformed search. Breadth-first search expands the shallowest node first using a FIFO queue; it is complete "
    "and optimal for equal step costs. Depth-first search uses a LIFO stack and needs little memory but is not optimal.",
    "Informed search. A* search evaluates nodes using f(n) = g(n) + h(n). If the heuristic h(n) is admissible "
    "(never overestimates), tree-search A* is optimal. Greedy best-first search uses only h(n).",
]


def make_pdf():
    import pymupdf as fitz
    doc = fitz.open()
    for t in NOTES_PAGES:
        page = doc.new_page()
        page.insert_textbox(fitz.Rect(60, 60, 540, 780), t, fontsize=11)
    return SimpleUploadedFile("ai_evaluation_notes.pdf", doc.tobytes(), content_type="application/pdf")


class Command(BaseCommand):
    help = "Run the 20-input evaluation against the real OpenAI API and produce report graphs"

    def handle(self, *args, **opts):
        if not ai_configured():
            self.stderr.write(self.style.ERROR(f"{settings.AI_KEY_ENV} is not set in backend/.env - cannot run the evaluation."))
            return
        setup_test_environment()  # lets the test client run against the real database
        settings.ALLOWED_HOSTS = list(settings.ALLOWED_HOSTS) + ["testserver"]
        cache.clear()
        OUT.mkdir(exist_ok=True)
        (OUT / "graphs").mkdir(exist_ok=True)

        user, _ = User.objects.get_or_create(email="evaluation@examgenius.local", defaults={
            "username": "evaluation@examgenius.local", "first_name": "Evaluation", "last_name": "Run"})
        StudentProfile.objects.get_or_create(user=user, defaults={"semester": 5, "year": 3, "learning_style": "examples"})
        ai_sub = Subject.objects.get(code="BCS515B")
        Enrollment.objects.update_or_create(user=user, subject=ai_sub, defaults={"exam_date": date.today() + timedelta(days=4)})
        topics = {t.name: t for t in Topic.objects.filter(unit__subject=ai_sub)}
        c = Client()
        c.force_login(user)

        rows, md, state = [], ["# ExamGenius AI - outputs of the 20 evaluation inputs\n"], {}

        pause = {"gemini": 7, "github": 5}.get(settings.AI_PROVIDER, 0)  # stay under free-tier requests/minute
        if pause:
            self.stdout.write(f"Free-tier provider ({settings.AI_PROVIDER_LABEL}): pausing {pause}s between tests "
                              "to respect rate limits - this takes a few minutes.")

        def run(no, feature, description, fn, check):
            if pause and no > 1:
                time.sleep(pause)
            before = AIUsageLog.objects.filter(user=user).count()
            t0 = time.perf_counter()
            try:
                r = fn()
                body = r.json()
                ok_http = r.status_code in (200, 201)
                passed, note = (check(body) if ok_http else (False, body.get("detail", "")))
            except Exception as exc:  # noqa: BLE001
                body, ok_http, passed, note = {}, False, False, str(exc)[:200]
            secs = time.perf_counter() - t0
            logs = AIUsageLog.objects.filter(user=user).order_by("id")[before:]
            pt = sum(l.prompt_tokens for l in logs)
            ct = sum(l.completion_tokens for l in logs)
            cached = bool(logs) and all(l.cached for l in logs)
            cost = pt / 1e6 * settings.PRICE_INPUT_PER_M + ct / 1e6 * settings.PRICE_OUTPUT_PER_M
            rows.append({"test": no, "feature": feature, "input": description, "seconds": round(secs, 2),
                         "ai_calls": len(logs), "prompt_tokens": pt, "completion_tokens": ct, "cached": cached,
                         "cost_usd": round(cost, 6), "passed": bool(passed), "note": note})
            self.stdout.write(f"[{no:02}/20] {feature:<14} {'PASS' if passed else 'FAIL'}  {secs:5.1f}s  {pt + ct:5d} tok  {description}")
            md.append(f"\n## Test {no}: {description}\n**Feature:** {feature} · **Result:** {'PASS' if passed else 'FAIL'} "
                      f"· {secs:.1f} s · {pt + ct} tokens\n\n```json\n{json.dumps(body, indent=2, default=str)[:4000]}\n```\n")
            return body

        # ---------------- tutor
        conv = c.post("/api/conversations/", {"subject_id": ai_sub.id, "mode": "exam"}, content_type="application/json").json()
        chk_text = lambda *words: (lambda b: (all(w.lower() in b["message"]["content"].lower() for w in words), "keywords present"))
        run(1, "AI tutor", "Explain A* search (exam mode)", lambda: c.post(f"/api/conversations/{conv['id']}/messages/",
            {"content": "Explain A* search algorithm."}, content_type="application/json"), chk_text("heuristic"))
        run(2, "AI tutor", "Follow-up: is it always optimal?", lambda: c.post(f"/api/conversations/{conv['id']}/messages/",
            {"content": "Is it always optimal? When can it fail?"}, content_type="application/json"), chk_text("admissible"))
        run(3, "AI tutor", "10-mark answer: structure of agents", lambda: c.post(f"/api/conversations/{conv['id']}/messages/",
            {"content": "Explain the different types of agent structures.", "marks": 10}, content_type="application/json"),
            lambda b: (len(b["message"]["content"].split()) > 200 and "reflex" in b["message"]["content"].lower(), "length + keyword"))
        conv2 = c.post("/api/conversations/", {"subject_id": ai_sub.id, "mode": "exam"}, content_type="application/json").json()
        run(4, "AI tutor (cache)", "Repeat of test 1 in a new chat (cache)", lambda: c.post(f"/api/conversations/{conv2['id']}/messages/",
            {"content": "Explain A* search algorithm."}, content_type="application/json"), chk_text("heuristic"))

        # ---------------- notes
        t_agents = topics["Agents and environments"]
        chk_notes = lambda b: (bool(b["notes"]["key_points"]) and len(b["notes"]["flashcards"]) >= 3, "key points + flashcards")
        run(5, "Topic notes", "Short notes: Agents and environments", lambda: c.post(f"/api/topics/{t_agents.id}/notes/",
            {"style": "short"}, content_type="application/json"), chk_notes)
        run(6, "Topic notes", "Detailed notes: Propositional logic", lambda: c.post(f"/api/topics/{topics['Propositional logic'].id}/notes/",
            {"style": "detailed"}, content_type="application/json"), chk_notes)

        # ---------------- quizzes
        def chk_quiz(n, types):
            return lambda b: (len(b["questions"]) == n and {q["type"] for q in b["questions"]} <= set(types), f"{len(b.get('questions', []))} valid questions")
        q1 = run(7, "Quiz generator", "5 MCQs on uninformed search (medium)", lambda: c.post("/api/quizzes/", {
            "subject_id": ai_sub.id, "topic_ids": [topics["Breadth-first and uniform-cost search"].id, topics["Depth-first and iterative deepening search"].id],
            "count": 5, "types": ["mcq"], "difficulty": "medium"}, content_type="application/json"), chk_quiz(5, ["mcq"]))
        run(8, "Quiz generator", "6 mixed questions (MCQ/TF/fill/short) on logic", lambda: c.post("/api/quizzes/", {
            "subject_id": ai_sub.id, "topic_ids": [topics["Propositional logic"].id, topics["Syntax and semantics of FOL"].id],
            "count": 6, "types": ["mcq", "tf", "fill", "short"], "difficulty": "easy"}, content_type="application/json"),
            chk_quiz(6, ["mcq", "tf", "fill", "short"]))
        q3 = run(9, "Quiz generator", "Adaptive quiz on heuristics (4 questions incl. short)", lambda: c.post("/api/quizzes/", {
            "subject_id": ai_sub.id, "topic_ids": [topics["Heuristic functions"].id, topics["Greedy best-first and A* search"].id],
            "count": 4, "types": ["mcq", "short"], "difficulty": "adaptive"}, content_type="application/json"), chk_quiz(4, ["mcq", "short"]))

        def submit_quiz(q, good):
            answers = []
            for i, x in enumerate(q.get("questions", [])):
                if x["type"] in ("mcq", "tf"):
                    resp = x["options"][0]
                elif x["type"] == "fill":
                    resp = "heuristic"
                else:
                    resp = ("A heuristic function h(n) estimates the cost from node n to the goal. A* uses f(n)=g(n)+h(n) and is "
                            "optimal when h is admissible, meaning it never overestimates the true cost.") if good else "I am not sure."
                answers.append({"question_id": x["id"], "response": resp, "confidence": 3 if i % 2 else 2})
            return c.post(f"/api/quizzes/{q['id']}/submit/", {"answers": answers}, content_type="application/json")
        run(10, "Quiz marking", "Submit test 9 quiz (AI marks short answers)", lambda: submit_quiz(q3, True),
            lambda b: (b["max_score"] > 0 and all("marks_awarded" in x for x in b["questions"]), f"score {b.get('score')}/{b.get('max_score')}"))

        # ---------------- evaluator
        chk_eval = lambda m: (lambda b: (0 <= b["estimated_marks"] <= m and bool(b["model_answer"]), f"{b.get('estimated_marks')}/{m}"))
        run(11, "Answer evaluator", "Good 5-mark answer: PEAS", lambda: c.post("/api/evaluate/", {
            "question": "Explain PEAS description with an example.", "marks": 5, "topic_id": t_agents.id, "subject_id": ai_sub.id,
            "answer": "PEAS stands for Performance measure, Environment, Actuators and Sensors. It is used to specify the task "
                      "environment of an agent. Example: automated taxi - performance: safe, fast, legal trip; environment: roads, "
                      "traffic, pedestrians; actuators: steering, accelerator, brake, horn; sensors: cameras, GPS, speedometer."},
            content_type="application/json"), chk_eval(5))
        run(12, "Answer evaluator", "Weak 10-mark answer: types of agents", lambda: c.post("/api/evaluate/", {
            "question": "Explain the different types of agents with neat diagrams.", "marks": 10, "subject_id": ai_sub.id,
            "answer": "There are many agents like reflex agent and goal agent. They work in environment."}, content_type="application/json"), chk_eval(10))

        # ---------------- PDF RAG
        doc = c.post("/api/documents/", {"file": make_pdf(), "subject_id": ai_sub.id, "title": "AI evaluation notes"}).json()
        run(13, "PDF summary", "Summarise the uploaded 3-page PDF", lambda: c.post(f"/api/documents/{doc['id']}/summary/", {"style": "short"},
            content_type="application/json"), lambda b: (bool(b["summary"]["short"]["summary"]), "summary created"))
        run(14, "PDF Q&A (RAG)", "Ask: what does A* use to evaluate nodes?", lambda: c.post(f"/api/documents/{doc['id']}/ask/",
            {"question": "What does A* search use to evaluate nodes?"}, content_type="application/json"),
            lambda b: (b["found"] and any(ct["page"] == 3 for ct in b["citations"]), f"pages {[ct['page'] for ct in b.get('citations', [])]}"))
        run(15, "PDF Q&A (RAG)", "Ask something NOT in the notes (photosynthesis)", lambda: c.post(f"/api/documents/{doc['id']}/ask/",
            {"question": "Explain the process of photosynthesis in plants."}, content_type="application/json"),
            lambda b: (not b["found"] and not b["citations"], "correctly reported not found"))

        # ---------------- viva
        v = run(16, "AI viva", "Start a 3-question viva on agents", lambda: c.post("/api/viva/", {"subject_id": ai_sub.id,
            "topic_ids": [t_agents.id, topics["Structure of agents"].id], "questions": 3}, content_type="application/json"),
            lambda b: (len(b["turns"]) == 1 and len(b["turns"][0]["question"]) > 10, "first question asked"))
        run(17, "AI viva", "Answer viva question 1", lambda: c.post(f"/api/viva/{v.get('id')}/", {"answer":
            "An agent perceives its environment through sensors and acts through actuators; a rational agent maximises its performance measure."},
            content_type="application/json"), lambda b: (b["turns"][0]["score"] is not None and len(b["turns"]) == 2, f"score {b['turns'][0]['score']}/10"))

        # ---------------- doubt check, mock exam, rescue plan
        run(18, "Doubt-to-mastery", "Check understanding of the A* chat", lambda: c.post(f"/api/conversations/{conv['id']}/check/"),
            lambda b: (b["kind"] == "doubt" and len(b["questions"]) >= 1, f"{len(b.get('questions', []))} questions"))
        run(19, "Exam Hall mock", "Generate an 8-question, 30-minute mock exam", lambda: c.post("/api/quizzes/mock/", {
            "subject_id": ai_sub.id, "duration_min": 30, "count": 8}, content_type="application/json"),
            lambda b: (b["kind"] == "mock" and len(b["questions"]) >= 6 and any(q["type"] == "short" for q in b["questions"]), f"{len(b.get('questions', []))} questions"))
        run(20, "Exam Rescue", "Rescue plan: exam in 4 days, 3 h/day (no AI needed)", lambda: c.post("/api/plans/", {
            "subject_id": ai_sub.id, "exam_date": str(date.today() + timedelta(days=4)), "daily_hours": 3, "mode": "rescue"},
            content_type="application/json"),
            lambda b: (b["mode"] == "rescue" and all(d["minutes"] <= 180 for d in b["days"]), f"{sum(len(d['tasks']) for d in b['days'])} tasks, {len(b['uncovered'])} not covered"))

        # ---------------- outputs
        with open(OUT / "results.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
        (OUT / "outputs.md").write_text("\n".join(md), encoding="utf-8")
        timed = [r for r in rows if r["ai_calls"] and not r["cached"]]
        summary = {
            "date": str(date.today()), "provider": settings.AI_PROVIDER_LABEL, "model": settings.OPENAI_CHAT_MODEL, "tests": len(rows),
            "passed": sum(r["passed"] for r in rows),
            "pass_rate_percent": round(100 * sum(r["passed"] for r in rows) / len(rows), 1),
            "avg_seconds_ai_tests": round(sum(r["seconds"] for r in timed) / len(timed), 2) if timed else None,
            "max_seconds": max(r["seconds"] for r in rows),
            "total_tokens": sum(r["prompt_tokens"] + r["completion_tokens"] for r in rows),
            "total_cost_usd": round(sum(r["cost_usd"] for r in rows), 5),
            "cache_test_seconds": rows[3]["seconds"], "original_test_seconds": rows[0]["seconds"],
        }
        (OUT / "summary.json").write_text(json.dumps(summary, indent=2))
        self.stdout.write(self.style.SUCCESS("\n" + json.dumps(summary, indent=2)))
        try:
            graphs(rows)
            self.stdout.write(self.style.SUCCESS(f"Graphs saved in {OUT / 'graphs'}"))
        except ImportError:
            self.stdout.write(self.style.WARNING("Install matplotlib for graphs:  pip install matplotlib"))
        self.stdout.write(f"Results saved in {OUT}")


def graphs(rows):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    G = OUT / "graphs"
    feats = list(dict.fromkeys(r["feature"] for r in rows))
    palette = ["#6d5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6", "#64748b", "#ec4899", "#84cc16", "#f97316", "#3b82f6", "#22c55e"]
    color = {f: palette[i % len(palette)] for i, f in enumerate(feats)}
    plt.rcParams.update({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False})
    ids = [str(r["test"]) for r in rows]

    fig, ax = plt.subplots(figsize=(11, 4.6))
    ax.bar(ids, [r["seconds"] for r in rows], color=[color[r["feature"]] for r in rows])
    for f in feats:
        ax.bar(0, 0, color=color[f], label=f)
    ax.set(xlabel="Test input", ylabel="Response time (s)", title="Fig 1. Response time for each of the 20 test inputs")
    ax.legend(fontsize=7.5, ncol=4, frameon=False)
    fig.tight_layout(); fig.savefig(G / "1_response_time.png", dpi=160); plt.close(fig)

    fig, ax = plt.subplots(figsize=(11, 4.6))
    ax.bar(ids, [r["prompt_tokens"] for r in rows], color="#cbd5e1", label="Input tokens")
    ax.bar(ids, [r["completion_tokens"] for r in rows], bottom=[r["prompt_tokens"] for r in rows], color="#6d5cf6", label="Output tokens")
    ax.set(xlabel="Test input", ylabel="Tokens", title="Fig 2. Token usage per test (test 20 uses no AI; test 4 is served from cache)")
    ax.legend(frameon=False)
    fig.tight_layout(); fig.savefig(G / "2_tokens.png", dpi=160); plt.close(fig)

    fig, ax = plt.subplots(figsize=(9, 4.4))
    passed = [sum(1 for r in rows if r["feature"] == f and r["passed"]) for f in feats]
    total = [sum(1 for r in rows if r["feature"] == f) for f in feats]
    ax.barh(feats, passed, color="#10b981", label="Passed")
    ax.barh(feats, [t - p for t, p in zip(total, passed)], left=passed, color="#ef4444", label="Failed")
    ax.set(xlabel="Tests", title=f"Fig 3. Correctness: {sum(passed)}/20 tests passed")
    ax.legend(frameon=False); ax.invert_yaxis()
    fig.tight_layout(); fig.savefig(G / "3_pass_fail.png", dpi=160); plt.close(fig)

    fig, ax = plt.subplots(figsize=(7, 4.2))
    vals = [rows[0]["seconds"], rows[3]["seconds"]]
    toks = [rows[0]["prompt_tokens"] + rows[0]["completion_tokens"], rows[3]["prompt_tokens"] + rows[3]["completion_tokens"]]
    b = ax.bar(["First request\n(ChatGPT API)", "Identical request\n(response cache)"], vals, color=["#6d5cf6", "#10b981"])
    for rect, t in zip(b, toks):
        ax.text(rect.get_x() + rect.get_width() / 2, rect.get_height(), f"{t} tokens", ha="center", va="bottom")
    ax.set(ylabel="Seconds", title="Fig 4. Sustainability: the cache answers repeats with 0 tokens")
    fig.tight_layout(); fig.savefig(G / "4_cache_effect.png", dpi=160); plt.close(fig)

    fig, ax = plt.subplots(figsize=(9, 4.2))
    avg = {f: sum(r["seconds"] for r in rows if r["feature"] == f) / total[i] for i, f in enumerate(feats)}
    ax.barh(list(avg), list(avg.values()), color=[color[f] for f in avg])
    ax.set(xlabel="Average seconds", title="Fig 5. Average response time by feature"); ax.invert_yaxis()
    fig.tight_layout(); fig.savefig(G / "5_feature_latency.png", dpi=160); plt.close(fig)

    fig, ax = plt.subplots(figsize=(9, 4.2))
    cum, s = [], 0
    for r in rows:
        s += r["cost_usd"] * 1000
        cum.append(s)
    ax.plot(range(1, 21), cum, marker="o", color="#f59e0b")
    ax.set(xlabel="Test input", ylabel="Cumulative cost (US$ x 0.001)", title=f"Fig 6. Cumulative API cost over 20 inputs (total ${s / 1000:.4f})")
    fig.tight_layout(); fig.savefig(G / "6_cost.png", dpi=160); plt.close(fig)
