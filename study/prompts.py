"""Prompt templates. Student data included in prompts: name-free academic context only
(semester, branch, learning style, subject/topic, and the question itself)."""

MODES = {
    "beginner": "Explain for a complete beginner. Start from the very basics, use an everyday analogy, avoid jargon.",
    "simple": "Explain simply and briefly in plain language, in at most 8 short points.",
    "detailed": "Give a thorough, detailed explanation with reasoning, edge cases and a worked example.",
    "exam": ("Answer the way a high-scoring VTU university exam answer is written: definition, key points with "
             "headings, an example or diagram description, and a short conclusion."),
    "interview": "Answer as for a technical interview: crisp definition, intuition, trade-offs, a practical example, and 2 likely follow-up questions.",
}

STYLES = {
    "examples": "This student learns best through concrete examples - include at least one worked example.",
    "diagrams": ("This student learns best visually - include a small diagram as a ```mermaid``` code block "
                 "(use simple 'flowchart TD' syntax, short node labels in double quotes, no special characters)."),
    "steps": "This student learns best step by step - number every step clearly.",
    "theory": "This student prefers theory - give precise definitions and the underlying principles.",
    "practice": "This student learns by practising - end with 2 practice questions (answers hidden in a 'Answers' section).",
}

MARKS = {
    2: "Write a 2-mark answer: 2-4 lines, definition plus one key point.",
    5: "Write a 5-mark answer: about 150-200 words, definition, 4-5 key points, small example.",
    10: ("Write a 10-mark answer: about 350-450 words with headings - introduction/definition, detailed explanation "
         "in points, diagram description or example, advantages/applications, conclusion."),
}


def profile_context(user):
    p = getattr(user, "profile", None)
    if not p:
        return "Student: engineering undergraduate."
    return (f"Student: {p.degree} {p.branch}, year {p.year}, semester {p.semester}, {p.university}. "
            f"{STYLES.get(p.learning_style, '')}")


def tutor_system(user, subject=None, topic=None, mode="exam", simplify=False):
    parts = [
        "You are ExamGenius AI, a friendly, accurate personal tutor helping an engineering student prepare for university examinations.",
        profile_context(user),
        MODES.get(mode, MODES["exam"]),
    ]
    if subject:
        parts.append(f"Current subject: {subject.name} ({subject.code}).")
    if topic:
        parts.append(f"Current topic: {topic.name} - {topic.summary}")
    if simplify:
        parts.append("The student recently answered questions on this topic incorrectly - be extra clear and simple, check basics first.")
    parts.append("When a process, architecture or hierarchy is involved, or the student asks for a diagram, add a small "
                 "```mermaid``` diagram (simple 'flowchart TD' syntax, short labels in double quotes). ")
    parts.append("Use Markdown (headings, bullet points, **bold** key terms, code blocks for code). "
                 "If you are not sure about a fact, or the question is outside the subject, say so clearly instead of guessing.")
    return "\n".join(parts)


def notes_prompt(topic, style):
    depth = ("concise revision notes (key points only, 6-8 points)" if style == "short"
             else "detailed study notes (10-14 key points with explanations)")
    return (
        f"Create {depth} for the topic '{topic.name}' in the subject '{topic.subject.name}' "
        f"(module: {topic.unit.title}). Topic scope: {topic.summary}\n"
        "Return ONLY JSON with this structure:\n"
        '{"overview": "2-3 sentence overview", "key_points": ["..."], '
        '"definitions": [{"term": "...", "meaning": "..."}], "formulas": ["formula with meaning of symbols, or empty"], '
        '"example": "one worked example", "keywords": ["..."], '
        '"exam_questions": [{"question": "...", "marks": 2|5|10}], '
        '"flashcards": [{"front": "question", "back": "short answer"}], "common_mistakes": ["..."]}\n'
        "Give 4-6 exam_questions and 6-8 flashcards. Be factually precise.")


def quiz_prompt(subject, topics, n, types, difficulty_map, context=""):
    topic_lines = "\n".join(f"- id {t.id}: {t.name} ({t.summary}) -> difficulty {difficulty_map[t.id]}" for t in topics)
    type_text = ", ".join(types)
    return (
        f"Create {n} exam-practice questions for the subject '{subject.name}'.\n"
        f"Use ONLY these topics (spread questions across them, use the topic id given):\n{topic_lines}\n"
        f"Allowed question types: {type_text}. Mix the allowed types.\n"
        "Rules per type:\n"
        "- mcq: exactly 4 distinct options; 'answer' must be exactly one of the options (copy the text).\n"
        "- tf: options must be [\"True\", \"False\"]; answer is \"True\" or \"False\".\n"
        "- fill: the question contains '____' for the blank; 'answer' is 1-3 words; 'accept' lists other correct spellings/synonyms.\n"
        "- short: a 2-4 mark conceptual question; 'answer' is a model answer (3-5 sentences); 'key_points' lists 3-4 points the marker looks for.\n"
        "Each question must match the difficulty given for its topic. Explanations must say WHY the answer is correct.\n"
        + (f"\nBase the questions on this context:\n{context[:6000]}\n" if context else "")
        + 'Return ONLY JSON: {"questions": [{"type": "mcq|tf|fill|short", "topic_id": 0, "question": "...", '
          '"options": [], "answer": "...", "accept": [], "key_points": [], "explanation": "...", "difficulty": "easy|medium|hard"}]}')


def short_marking_prompt(items):
    lines = []
    for it in items:
        lines.append(
            f"[id {it['id']}] Question ({it['marks']} marks): {it['question']}\n"
            f"Model answer: {it['model']}\nKey points: {'; '.join(it['key_points'])}\n"
            f"Student answer: {it['response'] or '(blank)'}\n")
    return (
        "You are a fair university examiner. Mark each student answer against the model answer and key points. "
        "Award partial marks (steps of 0.5). Blank or irrelevant answers get 0. Do not exceed the maximum marks.\n\n"
        + "\n".join(lines)
        + '\nReturn ONLY JSON: {"results": [{"id": 0, "marks_awarded": 0, "feedback": "one or two sentences", "missing_points": ["..."]}]}')


def evaluation_prompt(question, marks, answer, subject=None):
    return (
        f"You are an experienced VTU examiner. Evaluate this student's answer to a {marks}-mark question"
        + (f" in {subject.name}" if subject else "") + ".\n"
        f"Question: {question}\n\nStudent answer:\n{answer}\n\n"
        "Assess conceptual correctness, important keywords, missing concepts, explanation quality, structure and relevance. "
        f"estimated_marks must be between 0 and {marks} in steps of 0.5. Each rubric score is 0-10. "
        f"model_answer must be a better answer of the right length for {marks} marks, in Markdown.\n"
        'Return ONLY JSON: {"estimated_marks": 0, "rubric": {"conceptual_correctness": 0, "keywords": 0, '
        '"explanation_quality": 0, "structure": 0, "relevance": 0}, "strengths": [], "missing_points": [], '
        '"keywords_found": [], "keywords_missing": [], "improvements": [], "model_answer": "..."}')


def doc_summary_prompt(title, text, style):
    depth = "short revision notes" if style == "short" else "detailed notes"
    return (
        f"Create {depth} from this study document titled '{title}'. Use ONLY the document content.\n\n"
        f"DOCUMENT:\n{text}\n\n"
        'Return ONLY JSON: {"summary": "...", "key_points": [], "definitions": [{"term": "", "meaning": ""}], '
        '"formulas": [], "keywords": [], "exam_questions": [{"question": "", "marks": 5}], '
        '"flashcards": [{"front": "", "back": ""}]}')


def doc_answer_prompt(question, sources):
    blocks = "\n\n".join(f"[Source {i}] (page {c['page']})\n{c['text']}" for i, c in enumerate(sources, start=1))
    return (
        "Answer the student's question using ONLY the sources below from their uploaded notes. "
        "Cite the source numbers you used. If the sources do not contain the answer, set found=false and say "
        "clearly that the uploaded notes do not cover it (you may add one sentence of general guidance, labelled as not from the notes).\n\n"
        f"{blocks}\n\nQuestion: {question}\n\n"
        'Return ONLY JSON: {"found": true, "answer": "Markdown answer", "sources": [1, 2]}')


def viva_prompt(subject, topics, history, question_no, total):
    topic_lines = "; ".join(f"id {t.id}: {t.name}" for t in topics)
    convo = "\n".join(f"Q{i + 1} (topic {h['topic_id']}): {h['question']}\nStudent: {h['answer']}" for i, h in enumerate(history))
    last = history[-1] if history else None
    task = (
        f"Evaluate the student's latest answer (to Q{len(history)}) - score 0-10, short feedback, and a brief ideal answer. "
        if last else "This is the start of the viva. Leave score empty. ")
    nxt = (f"Then ask question {question_no} of {total}." if question_no <= total
           else "This was the last question; leave next_question empty.")
    return (
        f"You are a friendly but rigorous external examiner conducting an oral viva in {subject.name}. "
        f"Topics: {topic_lines}.\n{convo}\n\n{task}{nxt} "
        "Ask one clear conceptual question at a time, increasing depth if the student does well, simpler if they struggle. "
        "Set topic_id to the topic of the NEXT question.\n"
        'Return ONLY JSON: {"score": null, "feedback": "", "ideal_answer": "", "next_question": "", "topic_id": 0}')


def viva_summary_prompt(subject, history):
    convo = "\n".join(f"Q: {h['question']}\nA: {h['answer']}\nScore: {h.get('score')}/10" for h in history)
    return (f"Summarise this {subject.name} viva performance for the student.\n{convo}\n"
            'Return ONLY JSON: {"overall": "2-3 sentences", "strengths": [], "improve": []}')


def paper_prompt(subject, units):
    lines = []
    for u in units:
        lines.append(f"Module {u.number}: {u.title} - topics: " + "; ".join(f"[id {t.id}] {t.name}" for t in u.topics.all()))
    syllabus = "\n".join(lines)
    return (
        f"Create a VTU (Visvesvaraya Technological University) style semester-end model question paper for "
        f"'{subject.name}' ({subject.code}).\n\nSYLLABUS:\n{syllabus}\n\n"
        "Format rules (VTU 2022 scheme): for EACH module give TWO alternative full questions (the student answers one). "
        "Number them continuously: Module 1 -> Q1 and Q2, Module 2 -> Q3 and Q4, and so on. Each full question is "
        "20 marks split into 2 or 3 parts (a, b, c) whose marks add up to EXACTLY 20 (e.g. 8+6+6 or 10+10). "
        "Use only topics of that module and set topic_id to the topic each part is from. Mix Bloom's levels "
        "(L1 remember, L2 understand, L3 apply, L4 analyse) and write the level as 'L1'..'L4'. Include at least one "
        "problem/numerical or 'with a neat diagram' part where the subject allows. answer_outline = 2-3 key points "
        "an examiner expects.\n"
        'Return ONLY JSON: {"modules": [{"module": 1, "questions": [{"number": 1, "parts": [{"part": "a", "text": "...", '
        '"marks": 8, "level": "L2", "topic_id": 0, "answer_outline": "..."}]}, {"number": 2, "parts": [...]}]}]}')
