"""Pydantic schemas: every JSON reply from the AI is validated before it is stored or shown."""
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class QuizItem(BaseModel):
    type: Literal["mcq", "tf", "fill", "short"]
    topic_id: int
    question: str = Field(min_length=5)
    options: list[str] = []
    answer: str = Field(min_length=1)
    accept: list[str] = []
    key_points: list[str] = []
    explanation: str = ""
    difficulty: Literal["easy", "medium", "hard"] = "medium"

    @field_validator("options")
    @classmethod
    def strip_opts(cls, v):
        return [str(o).strip() for o in v if str(o).strip()]


class QuizOut(BaseModel):
    questions: list[QuizItem] = Field(min_length=1)


class ShortMark(BaseModel):
    id: int
    marks_awarded: float = Field(ge=0)
    feedback: str = ""
    missing_points: list[str] = []


class ShortMarksOut(BaseModel):
    results: list[ShortMark]


class EvalRubric(BaseModel):
    conceptual_correctness: int = Field(ge=0, le=10)
    keywords: int = Field(ge=0, le=10)
    explanation_quality: int = Field(ge=0, le=10)
    structure: int = Field(ge=0, le=10)
    relevance: int = Field(ge=0, le=10)


class EvaluationOut(BaseModel):
    estimated_marks: float = Field(ge=0)
    rubric: EvalRubric
    strengths: list[str] = []
    missing_points: list[str] = []
    keywords_found: list[str] = []
    keywords_missing: list[str] = []
    improvements: list[str] = []
    model_answer: str = ""


class Definition(BaseModel):
    term: str
    meaning: str


class ExamQ(BaseModel):
    question: str
    marks: int = 5


class Card(BaseModel):
    front: str
    back: str


class NotesOut(BaseModel):
    overview: str
    key_points: list[str] = Field(min_length=1)
    definitions: list[Definition] = []
    formulas: list[str] = []
    example: str = ""
    keywords: list[str] = []
    exam_questions: list[ExamQ] = []
    flashcards: list[Card] = []
    common_mistakes: list[str] = []


class DocSummaryOut(BaseModel):
    summary: str
    key_points: list[str] = []
    definitions: list[Definition] = []
    formulas: list[str] = []
    keywords: list[str] = []
    exam_questions: list[ExamQ] = []
    flashcards: list[Card] = []


class DocAnswerOut(BaseModel):
    found: bool
    answer: str
    sources: list[int] = []


class VivaTurnOut(BaseModel):
    score: float | None = Field(default=None, ge=0, le=10)
    feedback: str = ""
    ideal_answer: str = ""
    next_question: str = ""
    topic_id: int | None = None


class VivaSummaryOut(BaseModel):
    overall: str
    strengths: list[str] = []
    improve: list[str] = []


class PaperPart(BaseModel):
    part: str
    text: str = Field(min_length=5)
    marks: int = Field(ge=1, le=20)
    level: str = "L2"
    topic_id: int | None = None
    answer_outline: str = ""


class PaperQuestion(BaseModel):
    number: int
    parts: list[PaperPart] = Field(min_length=1)


class PaperModule(BaseModel):
    module: int
    questions: list[PaperQuestion] = Field(min_length=2, max_length=2)


class PaperOut(BaseModel):
    modules: list[PaperModule] = Field(min_length=1)
