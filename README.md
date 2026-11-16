# ExamGenius AI — Your Intelligent Academic Success Partner

**BCS515B Artificial Intelligence assignment · Group 14 · ATME College of Engineering, Mysuru**
*Task: "Using ChatGPT, develop an AI-powered personal study assistant that helps students prepare for examinations."*

ExamGenius AI is a full-stack web app (Django REST API + React) built on the **official OpenAI Python SDK**. It runs on the OpenAI (ChatGPT) API, ChatGPT models via GitHub Models (free), or Google Gemini (free), all through the same OpenAI-compatible interface.
ChatGPT generates explanations, notes, questions and feedback. ExamGenius's own Python engine then measures
the student (topic mastery, knowledge gaps, readiness), schedules their study (planner, Exam Rescue,
spaced repetition) and adapts the difficulty. Every chart uses real stored data.

---

## 1. Run it on Windows (VS Code)

### What you need (one time)
| Need | How |
|---|---|
| **Python 3.12 or newer** (3.10+ works) | python.org → Download → during install tick **"Add python.exe to PATH"** |
| **One AI key** (free options available) | **Gemini (free):** aistudio.google.com/apikey · **GitHub Models (free, ChatGPT models):** a GitHub token · **OpenAI (paid):** platform.openai.com - see section 1b |
| VS Code | You already have it |

> **Node.js is NOT needed.** The React frontend is already built and included (`backend/frontend_dist`).

### Steps
1. **Extract** `examgenius-ai.zip` (right-click → Extract All).
2. In VS Code: **File → Open Folder… →** choose the extracted `examgenius-ai` folder.
3. Open a terminal: **Terminal → New Terminal** (PowerShell).
4. Run the one-time setup:
   ```powershell
   .\setup.bat
   ```
   This creates a virtual environment, installs packages, creates the database and loads 6 subjects plus demo accounts.
5. **Add your AI key:** in VS Code open `backend\.env`. Fill in **one** key and save (Ctrl+S). For the free Gemini key:
   ```
   AI_PROVIDER=gemini
   GEMINI_API_KEY=AIzaSy...your-real-key...
   ```
   (No quotes, no spaces.) Then check that it works:
   ```powershell
   cd backend
   .\venv\Scripts\Activate.ps1
   python manage.py check_ai
   ```
   You should see `OK ... Your AI setup works`. If not, the message tells you what to fix.
6. Start the app:
   ```powershell
   .\start.bat
   ```
   The browser opens **http://127.0.0.1:8000**. Keep the terminal open while using the app; press **Ctrl+C** to stop.

Next time, just run `.\start.bat`.

### Same thing, command by command (if you prefer)
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1          # if blocked: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned   (then retry)
pip install -r requirements.txt
copy .env.example .env               # then paste your key into backend\.env
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

### 1b. Which AI key should I use?
| Option | Cost | Models | How to get the key | `.env` lines |
|---|---|---|---|---|
| **Google Gemini** | Free tier (limited requests per minute and per day) | `gemini-flash-latest` | aistudio.google.com/apikey → *Create API key* | `AI_PROVIDER=gemini` and `GEMINI_API_KEY=...` |
| **GitHub Models** | Free (about 15 requests/min, 150/day) | **ChatGPT gpt-4o-mini** | github.com → Settings → Developer settings → Personal access tokens → *Fine-grained token* → Permissions: **Models: Read-only** | `AI_PROVIDER=github` and `GITHUB_TOKEN=github_pat_...` |
| **OpenAI** | Paid (min US$5 credit) | ChatGPT gpt-4o-mini | platform.openai.com/api-keys + Billing | `AI_PROVIDER=openai` and `OPENAI_API_KEY=sk-...` |

All three use the same OpenAI-compatible code path (`backend/study/ai.py`), so every feature works with any of them.
Switch any time by editing `.env` and restarting the server. To use a different model, set `AI_CHAT_MODEL=`
(`python manage.py check_ai` lists the models your key can use). On free tiers, if you click very fast you may see
"limit reached - wait a minute"; that's the provider's limit, not a bug.

### Accounts
- **Create your own account** with the *Get started* button (choose semester, subjects and exam dates).
- DEMO student: `student@demo.examgenius` · DEMO faculty: `faculty@demo.examgenius` · password `ExamGenius@2026`

---

## 2. Testing (assignment requirement: at least 20 sample inputs)

### a) 20 real ChatGPT inputs → CSV + graphs for the report
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python manage.py run_evaluation
```
Runs 20 inputs (tutor, follow-up, 10-mark answer, cache repeat, notes, 3 quizzes, AI marking, 2 answer
evaluations, PDF summary, 2 PDF questions with page citations, viva, doubt check, mock exam, Exam Rescue) through
the real API, checks each output automatically and writes to `backend\evaluation_results\`:
`results.csv`, `outputs.md` (every AI answer), `summary.json` and **6 graphs** in `graphs\`.
It uses a separate account, so your data is untouched. Cost: free with Gemini/GitHub (it pauses a few seconds
between tests to stay within free limits, so it takes about 3-4 minutes), a few cents with OpenAI.

### b) Automated test suite (43 tests, no API cost)
```powershell
python manage.py test study
```
Covers the 25 specification test cases: registration, login, invalid login, logout, password validation,
**student data isolation**, PDF upload, invalid upload, text extraction, doubt solving, follow-ups, PDF-grounded
answers, page citations, quiz generation, scoring, descriptive evaluation, knowledge gaps, study plan, readiness
formula, Exam Rescue, Mistake Memory, spaced repetition, faculty permissions, API-failure handling and account
deletion. It also covers adaptive difficulty, confidence analysis, viva, mock exam, recovery and caching.
OpenAI is replaced by a fake client **only inside these tests**; the real app never uses it.

---

## 3. Features

| Area | What works |
|---|---|
| Accounts | Register (name, email, password, college, university, degree, branch, year, semester, USN, learning style, subjects + exam dates), login, logout, change password, profile edit, delete account |
| Subjects | 6 demo subjects (AI BCS515B, ML, DL, Research Methodology & IPR, DBMS, CN): 5 modules each, 95 topics with importance and prerequisites. Add or remove subjects, set exam dates |
| AI Personal Tutor | Chat with history; Beginner / Simple / Detailed / Exam / Interview modes; 2, 5 and 10-mark answers; personalised by semester, subject, topic and learning style; simpler explanations after repeated mistakes |
| Topic notes (no upload needed) | Short or detailed AI notes per topic: definitions, formulas, example, keywords, exam questions, flip flashcards, common mistakes (saved, so no repeat cost) |
| Smart PDF Notes | PDF upload (validated: type, size, pages), PyMuPDF page extraction, preview, summaries, flashcards, **RAG Q&A with file + page citations**, honest "not in your notes", quiz from a PDF |
| Quiz Generator | Subject → modules/topics, 3–15 questions, easy/medium/hard/**adaptive**, MCQ / True-False / Fill-in / Short answer; Python marks objective answers, AI marks short answers against a rubric; review with explanations and topic-wise accuracy |
| Answer Evaluator | 2/5/10-mark descriptive answers: estimated marks, rubric radar (concepts, keywords, explanation, structure, relevance), strengths, missing points, a better model answer, labelled "practice estimate" |
| Exam Hall Simulator | Timed mock paper (auto-submit), question palette and flags, no hints, AI feedback after submission |
| AI Viva Examiner | Adaptive oral-exam practice (typed): each answer scored /10 with feedback, plus a final summary |
| Knowledge Gap Detector | Topic mastery, weak topics, repeated mistakes, prerequisite gaps, topics needing revision |
| Adaptive Learning Engine | 3 correct in a row → harder; 2 wrong → easier + simpler explanation; 3 mistakes in 7 days → targeted revision task |
| Mistake Memory + Revision Time Machine | Every wrong answer saved; spaced repetition 1 → 3 → 7 → 14 → 30 days; daily priority queue |
| Confidence vs Knowledge | Guessing / Unsure / Sure on every question; over- and under-confidence analysis and chart |
| Study Planner | Day-wise plan within your daily hours: study, quiz, breaks, revision, mock; tick off tasks; recalculate |
| **Exam Rescue Mode** | Priority-ranked emergency plan; re-plans after every quiz; lists honestly what doesn't fit |
| Study Recovery | Missed tasks are automatically rescheduled into free time before the exam |
| Exam Readiness Analyzer | Transparent formula, per-subject breakdown, next actions, days left |
| Doubt → Mastery Journey | "Check my understanding" in the tutor turns a chat into 2 questions that update mastery |
| Concept Dependency Map | Visual prerequisite graph coloured by your mastery |
| Personal Learning DNA | Chosen preferences plus observed stats (best question type, pace, calibration, difficult topics) |
| Analytics | Accuracy trend, subject and unit performance, topic mastery, confidence, study time, question types, AI usage and cost |
| Faculty portal | Aggregate statistics only (no private chats or documents), add subjects and topics, content admin (`/django-admin/`) |
| Privacy | What is sent to OpenAI, delete chats / documents / history / account |
| **Genie the mascot** | An original cartoon study owl-bot with moods (waving, thinking, celebrating…) on the landing, login, dashboard, empty states, results and focus mode; daily study tips in the sidebar; cartoon doodle border around every page |
| **Voice tutor** | 🎤 speak your doubts, viva answers and evaluator answers (browser speech recognition, Indian English); 🔊 "Listen" reads AI answers and viva questions aloud; viva Voice Mode |
| **VTU Model Question Paper Generator** | Full semester-end paper: 5 modules × 2 alternative questions, 20 marks each (a/b/c parts), Bloom's levels L1–L6, optional examiner answer outlines, USN boxes. **Download as PDF** |
| **PDF revision packs** | One-click printable / downloadable PDF of any topic's notes or PDF summary, with cut-out flashcards |
| **Focus Mode (Pomodoro)** | 15/25/45-minute or task-length focus timer with progress ring; logs real study time, ticks off the plan task, confetti on completion |
| **Achievements & levels** | 15 badges earned from real activity (streaks, mastery, revisions, viva, mock exam, focus time…), XP and levels, confetti when a badge unlocks |
| **Diagrams in answers** | The tutor draws flowcharts (Mermaid) for processes and architectures |
| **Forgot password** | Secure single-use reset link (printed in the server terminal in the local demo) |
| **Command palette** | Press **Ctrl + K** to jump to any page or ask the tutor instantly |
| UI | Landing page, responsive (sidebar on desktop, bottom bar on mobile), light/dark mode, toasts, skeletons, empty states, confirmation dialogs |

## 4. How the scores work (all plain Python, no AI cost)

- **Topic mastery** = 100 × Σ(w·s)/Σw over the last 10 answers, where w = 0.85^age × difficulty weight (easy 1, medium 1.5, hard 2) and s = marks fraction. Fewer than 3 answers → "New". Below 40 weak, 40–69 developing, 70+ strong.
- **Readiness** R = 0.35 M (mastery) + 0.20 C (coverage) + 0.15 X (latest mock) + 0.15 V (revision completion) + 0.15 P (plan adherence). Missing parts share their weight. It is an estimate, not a prediction.
- **Rescue priority** = importance/5 × (1 − mastery/100) × b (b = 1.2 for prerequisites of weak topics). Blocks: 45 min study → 15 min quiz → 10 min break; last ~20% of days for final revision and a mock exam.
- **Spaced repetition**: 1, 3, 7, 14, 30 days; correct → next step, wrong → back to 1 day.

## 5. AI sustainability and performance
Response cache (identical requests cost 0 tokens) · small default model (`gpt-4o-mini`, configurable) · token caps
on every call · notes and summaries stored and reused · objective grading, mastery, readiness and scheduling
in Python · chat memory limited to 8 messages · PDFs limited to 10 MB / 60 pages · every call logged
(tokens, latency, cost) and shown in Analytics.

## 6. Security
Passwords hashed (PBKDF2) · session auth with CSRF protection · every query filtered by the logged-in user
(data isolation) · PDFs served only to their owner · rate limits (login, registration, AI) · input and file
validation · Django ORM (no SQL injection) · React escaping (XSS) · API key only in `backend/.env`, never sent
to the browser · `.env` is git-ignored · HTTPS-ready settings when `DJANGO_DEBUG=False`.

## 7. Troubleshooting
| Problem | Fix |
|---|---|
| `python` is not recognised | Reinstall Python and tick "Add to PATH", or use `py` instead of `python` |
| `Activate.ps1 cannot be loaded` | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or just use `setup.bat` / `start.bat` |
| Yellow banner "AI is not configured" | Paste your key in `backend\.env`, save, stop the server (Ctrl+C), run `start.bat` again |
| "... rejected the API key" | The key is wrong, has spaces, or is still placeholder text. Copy it again |
| OpenAI "no remaining credit" | Add credit at platform.openai.com → Billing, or switch to Gemini / GitHub (section 1b) |
| "free-tier limit reached" (Gemini / GitHub) | Wait a minute (per-minute limit) or until tomorrow (daily limit) |
| "Model is not available" | Run `python manage.py check_ai`, pick a listed model and set `AI_CHAT_MODEL=` in `.env` |
| Two keys filled in `.env` | Set `AI_PROVIDER=gemini` (or `github` / `openai`) to choose which one is used |
| Port 8000 already in use | `python manage.py runserver 8001` and open http://127.0.0.1:8001 |
| 🎤 mic button not visible | Voice input needs Chrome or Edge, and microphone permission (click the lock icon in the address bar → allow Microphone) |
| "Download PDF" | The browser's print dialog opens - choose **Save as PDF** as the printer |
| Forgot password email | In the local demo no real email is sent - the reset link is printed in the terminal running the server |
| Changing the UI code | Needs Node.js 20+: `cd frontend`, `npm install`, `npm run build` (or `npm run dev` for live editing at :5173) |

## 8. Project structure
```
examgenius-ai/
├─ setup.bat, start.bat          one-click setup / start (Windows)
├─ backend/                      Django project
│  ├─ config/                    settings, urls (serves the React app)
│  ├─ accounts/                  users, profiles, auth, account deletion
│  ├─ academics/                 subjects, modules, topics, prerequisites, faculty API, seed data
│  ├─ study/                     everything else:
│  │  ├─ ai.py                   the ONLY OpenAI client: cache, usage log, JSON validation, error mapping
│  │  ├─ prompts.py, schemas.py  prompt templates and Pydantic output schemas
│  │  ├─ engine.py               mastery, adaptive rules, mistakes, spaced repetition, gaps, readiness
│  │  ├─ planner.py              study plan, Exam Rescue, recovery
│  │  ├─ rag.py                  PDF extraction, chunking, embeddings, retrieval
│  │  ├─ quizlib.py              quiz generation and grading
│  │  ├─ views_*.py, urls.py     REST API
│  │  ├─ views_extra.py          question papers, focus sessions, achievements
│  │  ├─ tests/                  43 automated tests
│  │  └─ management/commands/run_evaluation.py   20-input evaluation + graphs
│  └─ frontend_dist/             built React app
└─ frontend/                     React 19 + Vite + Tailwind 4 + Recharts source
```
Demo syllabus data is labelled DEMO; verify topics against your official VTU syllabus (faculty can edit them in the admin).
