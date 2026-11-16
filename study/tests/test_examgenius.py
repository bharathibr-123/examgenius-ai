"""ExamGenius AI - automated test suite (the 25 test cases from the project specification + extras).

Run:  python manage.py test study
OpenAI is replaced by a deterministic fake client (study/tests/fake_ai.py), so these tests check
OUR logic - validation, grading, mastery, planning, RAG, security - without network or cost.
"""
import io
from datetime import date, timedelta

import pymupdf as fitz
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from academics.models import Enrollment, Subject, Topic
from study import ai, engine, planner
from study.models import (AICache, AIUsageLog, Answer, Conversation, Document, Mistake, Question, Quiz, StudyPlan,
                          StudyTask, TopicMastery)
from study.tests import fake_ai

FAKE = override_settings(AI_CLIENT_FACTORY="study.tests.fake_ai.factory")

PASSWORD = "Str0ng!Passw0rd"


def make_pdf(pages):
    doc = fitz.open()
    for text in pages:
        p = doc.new_page()
        p.insert_text((72, 72), text, fontsize=11)
    buf = io.BytesIO(doc.tobytes())
    return SimpleUploadedFile("notes.pdf", buf.getvalue(), content_type="application/pdf")


@FAKE
class Base(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", verbosity=0)
        cls.ai_subject = Subject.objects.get(code="BCS515B")

    def register(self, email="asha@example.com", client=None, **extra):
        c = client or APIClient()
        data = {"email": email, "full_name": "Asha Rao", "password": PASSWORD, "college": "ATME", "semester": 5, "year": 3,
                "learning_style": "examples", "subjects": [{"subject_id": self.ai_subject.id,
                                                            "exam_date": str(date.today() + timedelta(days=10))}]}
        data.update(extra)
        r = c.post("/api/auth/register/", data, format="json")
        return c, r

    def setUp(self):
        cache.clear()  # reset rate-limit counters between tests
        fake_ai.CALLS.clear()
        self.client, r = self.register()
        assert r.status_code == 201, r.content
        self.user = User.objects.get(email="asha@example.com")
        self.topics = list(Topic.objects.filter(unit__subject=self.ai_subject))

    def quiz(self, types=("mcq",), count=4, topic_ids=None, difficulty="medium"):
        r = self.client.post("/api/quizzes/", {"subject_id": self.ai_subject.id, "count": count, "types": list(types),
                                               "difficulty": difficulty,
                                               "topic_ids": topic_ids or [self.topics[0].id]}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()

    def answer_all(self, quiz, correct=True, confidence=None):
        answers = []
        for q in quiz["questions"]:
            if q["type"] == "mcq":
                resp = "Beta" if correct else "Alpha"
            elif q["type"] == "tf":
                resp = "True" if correct else "False"
            elif q["type"] == "fill":
                resp = "BFS" if correct else "depth"
            else:
                resp = "this is correct" if correct else "no idea"
            answers.append({"question_id": q["id"], "response": resp, "confidence": confidence})
        r = self.client.post(f"/api/quizzes/{quiz['id']}/submit/", {"answers": answers}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()


class AuthTests(Base):
    def test_01_registration_creates_profile_and_enrollment(self):
        u = self.user
        self.assertEqual(u.profile.semester, 5)
        self.assertTrue(Enrollment.objects.filter(user=u, subject=self.ai_subject).exists())
        self.assertNotEqual(u.password, PASSWORD)  # hashed
        self.assertTrue(u.password.startswith(("pbkdf2_", "argon2", "bcrypt", "scrypt")))

    def test_02_login(self):
        c = APIClient()
        r = c.post("/api/auth/login/", {"email": "asha@example.com", "password": PASSWORD}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(c.get("/api/auth/me/").json()["authenticated"])

    def test_03_invalid_login(self):
        r = APIClient().post("/api/auth/login/", {"email": "asha@example.com", "password": "wrong"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("Incorrect", r.json()["detail"])

    def test_04_logout(self):
        self.client.post("/api/auth/logout/")
        self.assertFalse(self.client.get("/api/auth/me/").json()["authenticated"])
        self.assertEqual(self.client.get("/api/dashboard/").status_code, 403)

    def test_05_password_validation(self):
        _, r = self.register(email="weak@example.com", password="12345")
        self.assertEqual(r.status_code, 400)
        self.assertIn("password", r.json()["errors"])
        _, r = self.register(email="not-an-email")
        self.assertIn("email", r.json()["errors"])
        _, r = self.register(email="asha@example.com")
        self.assertIn("already exists", r.json()["errors"]["email"])

    def test_06_student_data_isolation(self):
        quiz = self.quiz()
        conv = self.client.post("/api/conversations/", {"subject_id": self.ai_subject.id}, format="json").json()
        doc = self.client.post("/api/documents/", {"file": make_pdf(["An agent perceives its environment."]),
                                                   "subject_id": self.ai_subject.id}, format="multipart").json()
        other, r = self.register(email="ravi@example.com")
        self.assertEqual(r.status_code, 201)
        for url in (f"/api/quizzes/{quiz['id']}/", f"/api/conversations/{conv['id']}/", f"/api/documents/{doc['id']}/"):
            self.assertEqual(other.get(url).status_code, 404, url)
        self.assertEqual(other.get(f"/api/documents/{doc['id']}/file/").status_code, 404)
        self.assertEqual(other.post(f"/api/quizzes/{quiz['id']}/submit/", {"answers": []}, format="json").status_code, 404)
        self.assertEqual(other.get("/api/conversations/").json()["conversations"], [])
        self.assertEqual(other.get("/api/documents/").json()["documents"], [])


class DocumentTests(Base):
    def upload(self, pages=None):
        pages = pages or ["Intelligent agents perceive the environment through sensors.",
                          "A* search uses a heuristic h(n) and path cost g(n).",
                          "Breadth-first search expands the shallowest node first."]
        r = self.client.post("/api/documents/", {"file": make_pdf(pages), "subject_id": self.ai_subject.id}, format="multipart")
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()

    def test_07_pdf_upload(self):
        d = self.upload()
        self.assertEqual(d["pages"], 3)
        self.assertEqual(d["status"], "ready")
        self.assertEqual(d["retrieval"], "embedding")
        self.assertEqual(self.client.get(d["url"]).status_code, 200)

    def test_08_invalid_file_upload(self):
        bad = SimpleUploadedFile("notes.pdf", b"hello this is not a pdf", content_type="application/pdf")
        r = self.client.post("/api/documents/", {"file": bad, "subject_id": self.ai_subject.id}, format="multipart")
        self.assertEqual(r.status_code, 400)
        txt = SimpleUploadedFile("notes.txt", b"%PDF-fake", content_type="text/plain")
        r = self.client.post("/api/documents/", {"file": txt, "subject_id": self.ai_subject.id}, format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(Document.objects.count(), 0)

    def test_09_pdf_text_extraction(self):
        d = self.upload()
        page = self.client.get(f"/api/documents/{d['id']}/page/2/").json()
        self.assertIn("heuristic", page["text"])

    def test_12_pdf_grounded_answer_and_13_page_citations(self):
        d = self.upload()
        r = self.client.post(f"/api/documents/{d['id']}/ask/", {"question": "What does A* search use?"}, format="json").json()
        self.assertTrue(r["found"])
        pages = [c["page"] for c in r["citations"]]
        self.assertEqual(len(pages), 1)  # fake cited sources [1, 99]; 99 does not exist and must be dropped
        self.assertTrue(1 <= pages[0] <= 3)
        self.assertEqual(r["citations"][0]["file"], d["title"])
        # A question the notes do not cover is reported honestly
        r = self.client.post(f"/api/documents/{d['id']}/ask/", {"question": "Explain photosynthesis in plants"}, format="json").json()
        self.assertFalse(r["found"])
        self.assertEqual(r["citations"], [])

    def test_document_summary_and_delete(self):
        d = self.upload()
        r = self.client.post(f"/api/documents/{d['id']}/summary/", {"style": "short"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("short", r.json()["summary"])
        self.assertEqual(self.client.delete(f"/api/documents/{d['id']}/").status_code, 200)
        self.assertFalse(Document.objects.exists())


class TutorTests(Base):
    def test_10_ai_doubt_solving(self):
        conv = self.client.post("/api/conversations/", {"subject_id": self.ai_subject.id, "mode": "exam"}, format="json").json()
        r = self.client.post(f"/api/conversations/{conv['id']}/messages/", {"content": "What is an agent?", "marks": 5}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("Tutor answer", r.json()["message"]["content"])
        system = fake_ai.CALLS[-1]["messages"][0]["content"]
        self.assertIn("Artificial Intelligence", system)
        self.assertIn("semester 5", system)
        self.assertIn("5-mark", fake_ai.CALLS[-1]["messages"][-1]["content"])

    def test_11_follow_up_questions_keep_history(self):
        conv = self.client.post("/api/conversations/", {"subject_id": self.ai_subject.id}, format="json").json()
        self.client.post(f"/api/conversations/{conv['id']}/messages/", {"content": "What is BFS?"}, format="json")
        self.client.post(f"/api/conversations/{conv['id']}/messages/", {"content": "Give an example of it"}, format="json")
        msgs = fake_ai.CALLS[-1]["messages"]
        self.assertEqual([m["role"] for m in msgs], ["system", "user", "assistant", "user"])
        self.assertEqual(len(self.client.get(f"/api/conversations/{conv['id']}/").json()["messages"]), 4)

    def test_doubt_to_mastery_journey(self):
        conv = self.client.post("/api/conversations/", {"topic_id": self.topics[1].id}, format="json").json()
        self.client.post(f"/api/conversations/{conv['id']}/messages/", {"content": "Explain PEAS"}, format="json")
        r = self.client.post(f"/api/conversations/{conv['id']}/check/")
        self.assertEqual(r.status_code, 201, r.content)
        quiz = r.json()
        self.assertEqual(quiz["kind"], "doubt")
        res = self.answer_all(quiz, correct=True)
        self.assertEqual(res["percent"], 100)
        self.assertTrue(TopicMastery.objects.filter(user=self.user, topic=self.topics[1]).exists())

    def test_topic_notes_cached(self):
        t = self.topics[0]
        r1 = self.client.post(f"/api/topics/{t.id}/notes/", {"style": "short"}, format="json")
        self.assertEqual(r1.status_code, 200)
        n = len(fake_ai.CALLS)
        r2 = self.client.post(f"/api/topics/{t.id}/notes/", {"style": "short"}, format="json")
        self.assertEqual(len(fake_ai.CALLS), n)  # served from the database, no new AI call
        self.assertEqual(r1.json()["notes"], r2.json()["notes"])

    def test_viva_flow(self):
        r = self.client.post("/api/viva/", {"subject_id": self.ai_subject.id, "questions": 3}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        v = r.json()
        for _ in range(3):
            v = self.client.post(f"/api/viva/{v['id']}/", {"answer": "An agent senses and acts."}, format="json").json()
        self.assertTrue(v["finished"])
        self.assertEqual(v["max_score"], 30)
        self.assertEqual(v["score"], 21)
        self.assertEqual(v["summary"]["overall"], "Good viva.")


class QuizTests(Base):
    def test_14_quiz_generation_all_types(self):
        quiz = self.quiz(types=["mcq", "tf", "fill", "short"], count=8, topic_ids=[t.id for t in self.topics[:3]])
        self.assertEqual(len(quiz["questions"]), 8)
        self.assertEqual({q["type"] for q in quiz["questions"]}, {"mcq", "tf", "fill", "short"})
        self.assertNotIn("answer", quiz["questions"][0])  # answers hidden before submission
        self.assertTrue(all(q["topic_id"] in {t.id for t in self.topics[:3]} for q in quiz["questions"]))

    def test_15_quiz_scoring(self):
        quiz = self.quiz(types=["mcq", "tf", "fill"], count=6)
        res = self.answer_all(quiz, correct=True)
        self.assertEqual(res["score"], 6)
        self.assertEqual(res["percent"], 100)
        self.assertEqual(res["feedback"]["topic_accuracy"][0]["percent"], 100)
        quiz = self.quiz(types=["mcq", "tf", "fill"], count=6)
        res = self.answer_all(quiz, correct=False)
        self.assertEqual(res["score"], 0)
        self.assertTrue(all("answer" in q and "explanation" in q for q in res["questions"]))
        self.assertEqual(self.client.post(f"/api/quizzes/{quiz['id']}/submit/", {"answers": []}, format="json").status_code, 400)

    def test_fill_in_grading_tolerates_variants(self):
        self.assertTrue(engine.grade_objective("fill", "Breadth First", "breadth-first", ["breadth first"]))
        self.assertTrue(engine.grade_objective("fill", "the BFS", "breadth-first", ["BFS"]))
        self.assertFalse(engine.grade_objective("fill", "", "x"))
        self.assertFalse(engine.grade_objective("mcq", "Alpha", "Beta"))

    def test_16_descriptive_answer_evaluation(self):
        r = self.client.post("/api/evaluate/", {"question": "Explain the structure of agents.", "marks": 10,
                                                "answer": "Agents have sensors and actuators and an agent program.",
                                                "topic_id": self.topics[3].id}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        body = r.json()
        self.assertEqual(body["estimated_marks"], 6.0)
        self.assertEqual(body["max_marks"], 10)
        self.assertIn("not official", body["disclaimer"])
        self.assertTrue(TopicMastery.objects.filter(user=self.user, topic=self.topics[3]).exists())
        self.assertEqual(self.client.post("/api/evaluate/", {"question": "Q?", "marks": 7, "answer": "x"}, format="json").status_code, 400)

    def test_17_knowledge_gap_detection(self):
        t = self.topics[0]
        for _ in range(2):
            self.answer_all(self.quiz(count=3, topic_ids=[t.id]), correct=False)
        gaps = self.client.get("/api/gaps/").json()
        self.assertEqual(gaps["weak"][0]["topic_id"], t.id)
        self.assertEqual(gaps["weak"][0]["score"], 0)
        self.assertTrue(any(r["topic_id"] == t.id for r in gaps["repeated_mistakes"]))

    def test_mastery_formula_recency_weighted(self):
        t = self.topics[0]
        self.answer_all(self.quiz(count=3, topic_ids=[t.id]), correct=False)
        self.answer_all(self.quiz(count=3, topic_ids=[t.id]), correct=True)
        m = TopicMastery.objects.get(user=self.user, topic=t)
        # newest 3 correct (w=1, .85, .7225) vs older 3 wrong (.614, .522, .4437)
        expected = 100 * (1 + .85 + .7225) / (1 + .85 + .7225 + .614125 + .52200625 + .4437053125)
        self.assertAlmostEqual(m.score, round(expected, 1), places=1)
        self.assertEqual(m.attempts, 6)

    def test_adaptive_difficulty(self):
        t = self.topics[0]
        self.answer_all(self.quiz(count=3, topic_ids=[t.id]), correct=True)
        self.assertEqual(TopicMastery.objects.get(user=self.user, topic=t).level, "medium")
        self.answer_all(self.quiz(count=2, topic_ids=[t.id]), correct=False)
        tm = TopicMastery.objects.get(user=self.user, topic=t)
        self.assertEqual(tm.level, "easy")
        self.assertTrue(tm.simplify_next)
        quiz = self.quiz(count=2, topic_ids=[t.id], difficulty="adaptive")
        self.assertIn("difficulty easy", fake_ai.CALLS[-1]["messages"][-1]["content"])
        self.assertEqual(quiz["questions"][0]["difficulty"], "easy")

    def test_confidence_analyzer(self):
        self.answer_all(self.quiz(count=3), correct=False, confidence=3)
        c = self.client.get("/api/analytics/").json()["confidence"]
        self.assertEqual(c["overconfident"], 3)
        sure = next(x for x in c["levels"] if x["level"] == 3)
        self.assertEqual(sure["accuracy"], 0)

    def test_21_mistake_memory_and_22_revision_scheduling(self):
        self.answer_all(self.quiz(count=2), correct=False)
        mistakes = self.client.get("/api/mistakes/").json()
        self.assertEqual(mistakes["counts"]["open"], 2)
        m = Mistake.objects.filter(user=self.user).first()
        self.assertEqual(m.due_date, date.today() + timedelta(days=1))
        self.assertEqual(m.your_answer, "Alpha")
        self.assertEqual(m.correct_answer, "Beta")
        Mistake.objects.filter(id=m.id).update(due_date=date.today())
        self.assertEqual(len(self.client.get("/api/revision/queue/").json()["queue"]), 1)
        rq = self.client.post(f"/api/mistakes/{m.id}/revise/").json()
        res = self.answer_all(rq, correct=True)
        self.assertTrue(res["feedback"]["revision"]["correct"])
        m.refresh_from_db()
        self.assertEqual((m.step, m.due_date), (1, date.today() + timedelta(days=3)))
        rq = self.client.post(f"/api/mistakes/{m.id}/revise/").json()
        self.answer_all(rq, correct=False)
        m.refresh_from_db()
        self.assertEqual((m.step, m.due_date), (0, date.today() + timedelta(days=1)))
        self.assertEqual(Mistake.objects.filter(user=self.user).count(), 2)  # revisions don't duplicate mistakes

    def test_mock_exam(self):
        r = self.client.post("/api/quizzes/mock/", {"subject_id": self.ai_subject.id, "duration_min": 20, "count": 6}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        quiz = r.json()
        self.assertEqual(quiz["kind"], "mock")
        self.assertEqual(quiz["duration_min"], 20)
        self.assertTrue(any(q["type"] == "short" and q["marks"] == 5 for q in quiz["questions"]))
        res = self.answer_all(quiz, correct=True)
        self.assertEqual(res["percent"], 100)
        self.assertFalse(res["feedback"]["submitted_late"])


class PlannerTests(Base):
    def test_18_study_plan_generation(self):
        exam = date.today() + timedelta(days=10)
        r = self.client.post("/api/plans/", {"subject_id": self.ai_subject.id, "exam_date": str(exam), "daily_hours": 3}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        plan = r.json()
        for day in plan["days"]:
            self.assertLessEqual(day["minutes"], 180)
            self.assertLess(day["date"], str(exam))
        kinds = {t["kind"] for d in plan["days"] for t in d["tasks"]}
        self.assertTrue({"study", "quiz", "break", "mock", "revise"} <= kinds)
        studied = sum(1 for d in plan["days"] for t in d["tasks"] if t["kind"] == "study")
        self.assertEqual(studied + len(plan["uncovered"]), len(self.topics))
        task = plan["days"][0]["tasks"][0]
        self.assertEqual(self.client.patch(f"/api/tasks/{task['id']}/", {"status": "done"}, format="json").json()["status"], "done")
        self.assertEqual(self.client.post("/api/plans/", {"subject_id": self.ai_subject.id, "exam_date": str(date.today()),
                                                          "daily_hours": 3}, format="json").status_code, 400)

    def test_19_exam_readiness_calculation(self):
        e = Enrollment.objects.get(user=self.user, subject=self.ai_subject)
        r0 = engine.readiness(self.user, e)
        self.assertEqual(r0["score"], 0)
        t = self.topics[0]
        self.answer_all(self.quiz(count=3, topic_ids=[t.id]), correct=True)
        r = engine.readiness(self.user, e)
        n = len(self.topics)
        M, C = 100 / n, 100 / n  # one topic at 100%, covered
        expected = (0.35 * M + 0.20 * C) / 0.55  # X, V, P unavailable -> weights shared out
        self.assertAlmostEqual(r["score"], round(expected, 1), places=1)
        self.assertIn("not a prediction", r["disclaimer"])
        self.assertEqual(r["days_left"], 10)

    def test_20_exam_rescue_mode(self):
        weak = self.topics[5]
        for _ in range(2):
            self.answer_all(self.quiz(count=3, topic_ids=[weak.id]), correct=False)
        exam = date.today() + timedelta(days=3)
        plan = self.client.post("/api/plans/", {"subject_id": self.ai_subject.id, "exam_date": str(exam),
                                                "daily_hours": 2, "mode": "rescue"}, format="json").json()
        self.assertEqual(plan["mode"], "rescue")
        first_study = next(t for d in plan["days"] for t in d["tasks"] if t["kind"] in ("study", "revise"))
        self.assertEqual(first_study["topic_id"], weak.id)  # weakest high-importance topic first
        self.assertTrue(plan["uncovered"])  # 2 h x 3 days can't cover 20 topics - reported honestly
        preview = self.client.get(f"/api/plans/rescue-preview/?subject_id={self.ai_subject.id}").json()
        self.assertEqual(preview["topics"][0]["topic_id"], weak.id)
        # recalculation after a failed quiz on a planned topic
        other = next(t["topic_id"] for d in plan["days"] for t in d["tasks"] if t["kind"] == "study" and t["topic_id"] != weak.id)
        res = self.answer_all(self.quiz(count=2, topic_ids=[other]), correct=False)
        self.assertTrue(res["feedback"]["plan_updates"] or res["feedback"]["events"])

    def test_study_recovery(self):
        plan = planner.generate_plan(self.user, self.ai_subject, date.today() + timedelta(days=6), 3, start=date.today() - timedelta(days=2))
        missed = plan.tasks.filter(date__lt=date.today()).exclude(kind="break").count()
        self.assertGreater(missed, 0)
        changes = planner.recover(plan)
        self.assertEqual(plan.tasks.filter(status="missed").exclude(kind="break").count(), missed)
        moved = plan.tasks.filter(rescheduled_from__isnull=False).count()
        self.assertEqual(moved + sum("dropped" in c for c in changes), missed)
        cap = 180
        for d in {t.date for t in plan.tasks.filter(date__gte=date.today())}:
            self.assertLessEqual(sum(plan.tasks.filter(date=d).exclude(status="skipped").values_list("minutes", flat=True)), cap)


class PlatformTests(Base):
    def test_23_faculty_permissions(self):
        self.assertEqual(self.client.get("/api/faculty/overview/").status_code, 403)
        fac = APIClient()
        fac.post("/api/auth/login/", {"email": "faculty@demo.examgenius", "password": "ExamGenius@2026"}, format="json")
        r = fac.get("/api/faculty/overview/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("Aggregate", r.json()["privacy_note"])
        conv = self.client.post("/api/conversations/", {}, format="json").json()
        self.assertEqual(fac.get(f"/api/conversations/{conv['id']}/").status_code, 404)  # no access to private chats
        r = fac.post(f"/api/faculty/subjects/{self.ai_subject.id}/topics/", {"name": "Heuristic design", "unit_number": 3}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.client.post(f"/api/faculty/subjects/{self.ai_subject.id}/topics/", {"name": "X topic", "unit_number": 1},
                                          format="json").status_code, 403)

    @override_settings(AI_CLIENT_FACTORY=None, AI_API_KEY="", AI_KEY_ENV="OPENAI_API_KEY", AI_PROVIDER="openai")
    def test_24_api_failure_handling(self):
        conv = self.client.post("/api/conversations/", {}, format="json").json()
        r = self.client.post(f"/api/conversations/{conv['id']}/messages/", {"content": "hi"}, format="json")
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json()["ai_error"], "not_configured")
        self.assertIn("OPENAI_API_KEY", r.json()["detail"])
        self.assertEqual(Conversation.objects.get(id=conv["id"]).messages.count(), 0)  # nothing fake saved
        self.assertFalse(self.client.get("/api/ai/status/").json()["configured"])

    def test_json_parsing_tolerates_code_fences(self):
        self.assertEqual(ai._parse_json('```json\n{"a": 1}\n```'), {"a": 1})
        self.assertEqual(ai._parse_json('Here you go: {"a": 2} hope it helps'), {"a": 2})

    def test_24b_openai_errors_are_mapped(self):
        class AuthenticationError(Exception): pass
        class RateLimitError(Exception): pass
        self.assertEqual(ai._map_exception(AuthenticationError("bad key")).code, "auth")
        self.assertEqual(ai._map_exception(RateLimitError("You exceeded your current quota")).code, "quota")
        self.assertEqual(ai._map_exception(RateLimitError("slow down")).code, "rate")

    def test_25_account_data_deletion(self):
        self.answer_all(self.quiz(count=2), correct=False)
        self.client.post("/api/documents/", {"file": make_pdf(["agent text"]), "subject_id": self.ai_subject.id}, format="multipart")
        uid = self.user.id
        self.assertEqual(self.client.post("/api/auth/delete-account/", {"password": "wrong"}, format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/auth/delete-account/", {"password": PASSWORD}, format="json").status_code, 200)
        self.assertFalse(User.objects.filter(id=uid).exists())
        for model in (Quiz, Mistake, Document, TopicMastery, StudyPlan):
            self.assertFalse(model.objects.filter(user_id=uid).exists(), model.__name__)
        self.assertFalse(Answer.objects.filter(question__quiz__user_id=uid).exists())

    def test_privacy_partial_deletion(self):
        self.client.post("/api/conversations/", {}, format="json")
        self.answer_all(self.quiz(count=2), correct=False)
        self.client.post("/api/privacy/", {"what": "conversations"}, format="json")
        self.assertFalse(Conversation.objects.filter(user=self.user).exists())
        self.client.post("/api/privacy/", {"what": "history"}, format="json")
        self.assertFalse(Quiz.objects.filter(user=self.user).exists())
        self.assertFalse(Mistake.objects.filter(user=self.user).exists())

    def test_ai_cache_and_usage_log(self):
        conv = self.client.post("/api/conversations/", {"subject_id": self.ai_subject.id}, format="json").json()
        conv2 = self.client.post("/api/conversations/", {"subject_id": self.ai_subject.id}, format="json").json()
        self.client.post(f"/api/conversations/{conv['id']}/messages/", {"content": "Define rationality"}, format="json")
        n = len(fake_ai.CALLS)
        self.client.post(f"/api/conversations/{conv2['id']}/messages/", {"content": "Define rationality"}, format="json")
        self.assertEqual(len(fake_ai.CALLS), n)  # identical request answered from cache
        self.assertTrue(AIUsageLog.objects.filter(user=self.user, cached=True).exists())
        self.assertTrue(AICache.objects.exists())

    def test_dashboard_and_analytics_use_real_data(self):
        d = self.client.get("/api/dashboard/").json()
        self.assertEqual(d["stats"]["quizzes"], 0)
        self.assertIsNone(d["stats"]["accuracy"])
        self.answer_all(self.quiz(count=4), correct=True)
        d = self.client.get("/api/dashboard/").json()
        self.assertEqual(d["stats"]["quizzes"], 1)
        self.assertEqual(d["stats"]["accuracy"], 100)
        self.assertGreaterEqual(d["stats"]["streak"], 1)
        a = self.client.get("/api/analytics/").json()
        self.assertEqual(a["overall"]["answers"], 4)
        self.assertEqual(a["trend"][-1]["accuracy"], 100)
        self.assertEqual(self.client.get("/api/learning-dna/").status_code, 200)
        self.assertEqual(self.client.get(f"/api/subjects/{self.ai_subject.id}/concept-map/").status_code, 200)

    def test_frontend_routes_served(self):
        r = APIClient().get("/dashboard")
        self.assertEqual(r.status_code, 200)
        self.assertIn("csrftoken", r.cookies)


class NewFeatureTests(Base):
    def test_question_paper_generator(self):
        r = self.client.post("/api/papers/", {"subject_id": self.ai_subject.id}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        p = r.json()
        self.assertEqual(len(p["modules"]), 5)
        self.assertEqual(p["max_marks"], 100)
        numbers = [q["number"] for m in p["modules"] for q in m["questions"]]
        self.assertEqual(numbers, list(range(1, 11)))
        for m in p["modules"]:
            for q in m["questions"]:
                self.assertEqual(sum(pt["marks"] for pt in q["parts"]), 20)  # 8+7 rescaled to 20
                self.assertEqual([pt["part"] for pt in q["parts"]], ["a", "b"][:len(q["parts"])])
        self.assertEqual(p["modules"][0]["questions"][1]["parts"][1]["level"], "L2")  # invalid L9 normalised
        self.assertEqual(p["modules"][0]["questions"][1]["parts"][0]["topic"], "")  # unknown topic id dropped
        self.assertEqual(len(self.client.get("/api/papers/").json()["papers"]), 1)
        other, _ = self.register(email="x@example.com")
        self.assertEqual(other.get(f"/api/papers/{p['id']}/").status_code, 404)

    def test_focus_timer_completes_task_and_counts_time(self):
        plan = self.client.post("/api/plans/", {"subject_id": self.ai_subject.id, "exam_date": str(date.today() + timedelta(days=5)),
                                                "daily_hours": 3}, format="json").json()
        task = plan["days"][0]["tasks"][0]
        r = self.client.post("/api/focus/", {"task_id": task["id"], "minutes": 45}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(StudyTask.objects.get(id=task["id"]).status, "done")
        self.client.post("/api/focus/", {"label": "Free study", "minutes": 25}, format="json")
        f = self.client.get("/api/focus/").json()
        self.assertEqual(f["today_minutes"], 70)
        self.assertEqual(self.client.post("/api/focus/", {"minutes": 0}, format="json").status_code, 400)
        a = self.client.get("/api/analytics/").json()
        self.assertGreaterEqual(sum(s["minutes"] for s in a["study_time"]), 70)

    def test_achievements_from_real_data(self):
        a = self.client.get("/api/achievements/").json()
        self.assertEqual(a["earned"], 0)
        self.answer_all(self.quiz(count=3), correct=True)
        a = {x["id"]: x for x in self.client.get("/api/achievements/").json()["achievements"]}
        self.assertTrue(a["first_steps"]["earned"])
        self.assertTrue(a["perfect"]["earned"])
        self.assertFalse(a["quiz_master"]["earned"])
        self.assertEqual(a["quiz_master"]["progress"], 1)

    def test_password_reset_flow(self):
        from django.core import mail
        import re as _re
        c = APIClient()
        r = c.post("/api/auth/password-reset/", {"email": "nobody@example.com"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)
        r = c.post("/api/auth/password-reset/", {"email": "asha@example.com"}, format="json")
        self.assertEqual(len(mail.outbox), 1)
        link = _re.search(r"uid=([^&\s]+)&token=(\S+)", mail.outbox[0].body)
        uid, token = link.group(1), link.group(2)
        self.assertEqual(c.post("/api/auth/password-reset/confirm/", {"uid": uid, "token": "bad", "new_password": "N3w!Passw0rd"},
                                format="json").status_code, 400)
        self.assertEqual(c.post("/api/auth/password-reset/confirm/", {"uid": uid, "token": token, "new_password": "N3w!Passw0rd"},
                                format="json").status_code, 200)
        self.assertEqual(c.post("/api/auth/login/", {"email": "asha@example.com", "password": "N3w!Passw0rd"}, format="json").status_code, 200)
        self.assertEqual(c.post("/api/auth/password-reset/confirm/", {"uid": uid, "token": token, "new_password": "An0ther!Pass"},
                                format="json").status_code, 400)  # token is single-use
