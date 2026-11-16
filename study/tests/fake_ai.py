"""Deterministic stand-in for the OpenAI client - used ONLY by the automated test suite.
It lets the tests check our own logic (validation, grading, mastery, planner, RAG) without
network access or API cost. The real app never imports this module."""
import hashlib
import json
import re
from types import SimpleNamespace as NS

CALLS = []


def _resp(text, pt=120, ct=80):
    return NS(choices=[NS(message=NS(content=text))], usage=NS(prompt_tokens=pt, completion_tokens=ct))


def _quiz(prompt):
    n = int(re.search(r"Create (\d+) exam-practice", prompt).group(1))
    ids = [int(x) for x in re.findall(r"- id (\d+):", prompt)]
    types = [t.strip() for t in re.search(r"Allowed question types: ([a-z, ]+)\.", prompt).group(1).split(",")]
    qs = []
    for i in range(n):
        t = types[i % len(types)]
        tid = ids[i % len(ids)]
        base = {"type": t, "topic_id": tid, "explanation": "Because it is the definition.", "difficulty": "medium"}
        if t == "mcq":
            base.update(question=f"Which option is correct for item {i}?", options=["Alpha", "Beta", "Gamma", "Delta"], answer="Beta")
        elif t == "tf":
            base.update(question=f"Statement {i} is true.", options=["True", "False"], answer="True")
        elif t == "fill":
            base.update(question=f"The search that uses a FIFO queue is ____ search ({i}).", answer="breadth-first",
                        accept=["breadth first", "BFS"])
        else:
            base.update(question=f"Explain concept {i} briefly.", answer="Model answer text.", key_points=["point a", "point b"])
        qs.append(base)
    return {"questions": qs}


def _short(prompt):
    out = []
    for block in re.split(r"\n(?=\[id )", prompt):
        m = re.search(r"\[id (\d+)\] Question \(([\d.]+) marks\)", block)
        if not m:
            continue
        marks = float(m.group(2))
        ans = re.search(r"Student answer: (.*)", block).group(1)
        got = 0 if "(blank)" in ans else (marks if "correct" in ans.lower() else marks / 2 - 0.5 if marks > 1 else 0)
        out.append({"id": int(m.group(1)), "marks_awarded": max(0, got), "feedback": "Fake feedback.",
                    "missing_points": [] if got == marks else ["point b"]})
    return {"results": out}


class _Completions:
    def create(self, **kw):
        msgs = kw["messages"]
        CALLS.append(kw)
        prompt = msgs[-1]["content"]
        if "did not match the required JSON" in prompt:
            prompt = next(m["content"] for m in msgs if m["role"] == "user")
        if kw.get("response_format"):
            if "model question paper" in prompt:
                mods = [int(x) for x in re.findall(r"Module (\d+):", prompt)]
                tid = int(re.findall(r"\[id (\d+)\]", prompt)[0])
                body = {"modules": [{"module": m, "questions": [
                    {"number": 2 * m - 1, "parts": [{"part": "a", "text": f"Explain concept {m}a.", "marks": 8, "level": "L2", "topic_id": tid, "answer_outline": "Key points"},
                                                    {"part": "b", "text": f"Illustrate concept {m}b with a diagram.", "marks": 7, "level": "L3", "topic_id": tid}]},
                    {"number": 2 * m, "parts": [{"part": "a", "text": f"Describe alternative {m}.", "marks": 10, "level": "L2", "topic_id": 999999},
                                                {"part": "b", "text": f"Apply method {m} to a problem.", "marks": 10, "level": "L9"}]}]} for m in mods]}
            elif "exam-practice questions" in prompt:
                body = _quiz(prompt)
            elif '"results"' in prompt:
                body = _short(prompt)
            elif '"estimated_marks"' in prompt:
                marks = int(re.search(r"(\d+)-mark question", prompt).group(1))
                body = {"estimated_marks": marks * 0.6, "rubric": {"conceptual_correctness": 6, "keywords": 5,
                        "explanation_quality": 6, "structure": 7, "relevance": 8},
                        "strengths": ["Clear definition"], "missing_points": ["Example"], "keywords_found": ["agent"],
                        "keywords_missing": ["PEAS"], "improvements": ["Add an example"], "model_answer": "## Better answer\nText."}
            elif '"overview"' in prompt:
                body = {"overview": "Overview text.", "key_points": ["k1", "k2"], "definitions": [{"term": "T", "meaning": "M"}],
                        "formulas": [], "example": "Example.", "keywords": ["kw"], "exam_questions": [{"question": "Q?", "marks": 5}],
                        "flashcards": [{"front": "F", "back": "B"}], "common_mistakes": []}
            elif '"overall"' in prompt:
                body = {"overall": "Good viva.", "strengths": ["s"], "improve": ["i"]}
            elif '"next_question"' in prompt:
                ids = [int(x) for x in re.findall(r"id (\d+):", prompt)]
                started = "Student:" in prompt
                body = {"score": 7 if started else None, "feedback": "Good" if started else "",
                        "ideal_answer": "Ideal." if started else "", "next_question": "Explain the concept?",
                        "topic_id": ids[0]}
            elif '"found"' in prompt:
                found = "photosynthesis" not in prompt.lower()
                body = {"found": found, "answer": "From your notes: the answer." if found else "Not in notes.",
                        "sources": [1, 99] if found else []}
            elif '"summary"' in prompt:
                body = {"summary": "Doc summary.", "key_points": ["p"], "definitions": [], "formulas": [], "keywords": [],
                        "exam_questions": [], "flashcards": [{"front": "f", "back": "b"}]}
            else:
                body = {}
            return _resp(json.dumps(body))
        return _resp(f"**Tutor answer** to: {prompt[:60]} (history={len(msgs) - 2})")


class _Embeddings:
    def create(self, model, input):
        data = []
        for t in input:
            h = hashlib.sha256(t.lower().encode()).digest()
            vec = [b / 255 for b in h[:16]]
            for w in ("agent", "search", "heuristic", "page"):
                vec.append(1.0 if w in t.lower() else 0.0)
            data.append(NS(embedding=vec))
        return NS(data=data, usage=NS(prompt_tokens=10 * len(input)))


class FakeClient:
    def __init__(self):
        self.chat = NS(completions=_Completions())
        self.embeddings = _Embeddings()


def factory():
    return FakeClient()
