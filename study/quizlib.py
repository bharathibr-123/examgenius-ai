"""Quiz building (AI generates, Python validates) and grading (Python for objective, AI rubric for short)."""
from __future__ import annotations

from django.utils import timezone

from . import ai, engine, planner, prompts
from .models import Answer, Question, Quiz
from .schemas import QuizOut, ShortMarksOut

TYPE_MARKS = {"mcq": 1, "tf": 1, "fill": 1, "short": 3}


def build_quiz(user, subject, topics, n, types, difficulty, kind="practice", context="", title=None,
               duration=None, short_marks=None):
    topics = list(topics)
    if not topics:
        raise ValueError("Choose at least one topic.")
    types = [t for t in types if t in TYPE_MARKS] or ["mcq"]
    if difficulty == "adaptive":
        dmap = {t.id: engine.topic_level(user, t) for t in topics}
    else:
        dmap = {t.id: difficulty for t in topics}
    out: QuizOut = ai.chat(user, f"quiz_{kind}", [
        {"role": "system", "content": "You write accurate university exam questions and reply only with JSON."},
        {"role": "user", "content": prompts.quiz_prompt(subject, topics, n, types, dmap, context)},
    ], schema=QuizOut, max_tokens=min(400 + 260 * n, 6000), temperature=0.6, cache=False)

    allowed = {t.id: t for t in topics}
    valid = []
    for item in out.questions:
        if item.type not in types:
            continue
        topic = allowed.get(item.topic_id) or topics[len(valid) % len(topics)]
        opts, ans = item.options, item.answer.strip()
        if item.type == "mcq":
            if len(opts) != 4 or len(set(o.lower() for o in opts)) != 4:
                continue
            match = next((o for o in opts if o.strip().lower() == ans.lower()), None)
            if match is None and len(ans) == 1 and ans.upper() in "ABCD":
                match = opts["ABCD".index(ans.upper())]
            if match is None:
                continue
            ans = match
        elif item.type == "tf":
            opts = ["True", "False"]
            if ans.lower() not in ("true", "false"):
                continue
            ans = ans.capitalize()
        elif item.type == "fill":
            opts = []
            if "____" not in item.question and "___" not in item.question:
                item.question = item.question.rstrip(". ") + ": ____"
        elif item.type == "short":
            opts = []
            if not item.key_points:
                item.key_points = [ans[:120]]
        valid.append((item, topic, opts, ans))
        if len(valid) >= n:
            break
    if not valid:
        raise ai.AIError("bad_output", "no valid questions after validation")

    quiz = Quiz.objects.create(
        user=user, subject=subject, kind=kind, difficulty=difficulty, duration_min=duration,
        title=title or f"{subject.short}: {', '.join(t.name for t in topics[:2])}{'…' if len(topics) > 2 else ''}",
        started_at=timezone.now())
    for i, (item, topic, opts, ans) in enumerate(valid):
        marks = TYPE_MARKS[item.type]
        if item.type == "short" and short_marks:
            marks = short_marks
        Question.objects.create(quiz=quiz, topic=topic, qtype=item.type, text=item.question.strip(), options=opts,
                                answer=ans, accept=item.accept[:6], key_points=item.key_points[:6], marks=marks,
                                explanation=item.explanation, difficulty=dmap.get(topic.id, item.difficulty), order=i)
    return quiz


def serialize_quiz(quiz: Quiz, reveal=False):
    qs = []
    for q in quiz.questions.select_related("topic"):
        row = {"id": q.id, "type": q.qtype, "text": q.text, "options": q.options, "marks": q.marks,
               "topic": q.topic.name if q.topic else "", "topic_id": q.topic_id, "difficulty": q.difficulty}
        a = getattr(q, "student_answer", None) if quiz.submitted_at else None
        if reveal and quiz.submitted_at:
            row.update({"answer": q.answer, "explanation": q.explanation, "key_points": q.key_points,
                        "response": a.response if a else "", "is_correct": a.is_correct if a else False,
                        "marks_awarded": a.marks_awarded if a else 0, "feedback": a.feedback if a else "",
                        "confidence": a.confidence if a else None})
        qs.append(row)
    return {"id": quiz.id, "title": quiz.title, "kind": quiz.kind, "difficulty": quiz.difficulty,
            "subject": quiz.subject.name if quiz.subject else "", "subject_id": quiz.subject_id,
            "duration_min": quiz.duration_min, "started_at": quiz.started_at, "submitted_at": quiz.submitted_at,
            "score": quiz.score, "max_score": quiz.max_score, "percent": quiz.percent,
            "feedback": quiz.feedback, "questions": qs}


def grade_quiz(user, quiz: Quiz, responses: dict):
    """responses: {question_id: {"response": str, "confidence": 1-3|None}}"""
    questions = list(quiz.questions.select_related("topic"))
    shorts = [q for q in questions if q.qtype == "short"]
    short_results = {}
    if shorts:
        items = [{"id": q.id, "marks": q.marks, "question": q.text, "model": q.answer, "key_points": q.key_points,
                  "response": str(responses.get(q.id, {}).get("response", ""))[:3000]} for q in shorts]
        if all(not it["response"].strip() for it in items):
            short_results = {it["id"]: (0.0, "No answer given.") for it in items}
        else:
            marked: ShortMarksOut = ai.chat(user, "short_marking", [
                {"role": "system", "content": "You are a fair, consistent examiner. Reply only with JSON."},
                {"role": "user", "content": prompts.short_marking_prompt(items)}],
                schema=ShortMarksOut, max_tokens=300 + 150 * len(items), temperature=0.0)
            for r in marked.results:
                short_results[r.id] = (r.marks_awarded, r.feedback + (
                    (" Missing: " + "; ".join(r.missing_points)) if r.missing_points else ""))

    events, topic_tot = [], {}
    score = max_score = 0.0
    for q in questions:
        r = responses.get(q.id, {})
        resp = str(r.get("response", ""))[:3000]
        conf = r.get("confidence")
        conf = int(conf) if str(conf) in ("1", "2", "3") else None
        if q.qtype == "short":
            awarded, fb = short_results.get(q.id, (0.0, "Not marked."))
            awarded = max(0.0, min(float(q.marks), round(awarded * 2) / 2))
            correct = awarded >= 0.5 * q.marks
        else:
            correct = engine.grade_objective(q.qtype, resp, q.answer, q.accept)
            awarded, fb = (q.marks if correct else 0.0), ""
        ans = Answer.objects.create(question=q, response=resp, confidence=conf, is_correct=correct,
                                    marks_awarded=awarded, feedback=fb)
        score += awarded
        max_score += q.marks
        if q.topic_id:
            t = topic_tot.setdefault(q.topic_id, {"topic": q.topic.name, "got": 0.0, "max": 0.0})
            t["got"] += awarded
            t["max"] += q.marks
        events += engine.record_answer_effects(user, ans)

    quiz.score, quiz.max_score, quiz.submitted_at = score, max_score, timezone.now()
    topic_pct = {tid: 100 * v["got"] / v["max"] for tid, v in topic_tot.items() if v["max"]}
    plan_msgs = planner.after_quiz(user, topic_pct) if quiz.kind in ("practice", "mock", "doubt") else []
    late = bool(quiz.duration_min and quiz.started_at and
                (quiz.submitted_at - quiz.started_at).total_seconds() > quiz.duration_min * 60 + 120)
    quiz.feedback = {
        **(quiz.feedback or {}),
        "topic_accuracy": [{"topic_id": k, "topic": v["topic"], "percent": round(100 * v["got"] / v["max"], 1)}
                           for k, v in topic_tot.items() if v["max"]],
        "events": events, "plan_updates": plan_msgs, "submitted_late": late,
        "time_taken_sec": int((quiz.submitted_at - quiz.started_at).total_seconds()) if quiz.started_at else None,
    }
    quiz.save()
    engine.log_activity(user, quiz.kind, f"{quiz.get_kind_display()}: {quiz.title} - {quiz.percent}%", f"/quiz/{quiz.id}")
    return quiz
