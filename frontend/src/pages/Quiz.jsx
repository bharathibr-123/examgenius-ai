import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, Clock, Flag, Lightbulb, RotateCcw, Send, Sparkles, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorBox, Field, LoadingCards, PageHeader, SelectSubject } from "../components/ui";
import { api, fmtDateTime, useApi, useToast } from "../lib";
import { Genie } from "../components/art";
import { fireConfetti } from "../components/extras";

const TYPES = [["mcq", "Multiple choice"], ["tf", "True / False"], ["fill", "Fill in the blanks"], ["short", "Short answer"]];
const CONF = [[1, "Guessing"], [2, "Unsure"], [3, "Sure"]];

export function TopicPicker({ subjectId, value, onChange }) {
  const { data, loading } = useApi(subjectId ? `/subjects/${subjectId}/` : null, [subjectId]);
  if (!subjectId) return <p className="text-sm text-slate-500">Choose a subject first.</p>;
  if (loading || !data) return <div className="skeleton h-24" />;
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-navy-700">
      {data.units.map((u) => {
        const ids = u.topics.map((t) => t.id);
        const all = ids.every((i) => value.includes(i));
        return (
          <div key={u.id}>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="accent-brand-600" checked={all}
                onChange={() => onChange(all ? value.filter((x) => !ids.includes(x)) : [...new Set([...value, ...ids])])} />
              Module {u.number}: {u.title}
            </label>
            <div className="mt-1.5 flex flex-wrap gap-1.5 pl-6">
              {u.topics.map((t) => (
                <button key={t.id} type="button" onClick={() => toggle(t.id)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition ${value.includes(t.id) ? "bg-brand-600 text-white ring-brand-600" : "ring-slate-300 hover:bg-slate-50 dark:ring-navy-700 dark:hover:bg-navy-800"}`}>
                  {t.name}{t.status === "weak" ? " ⚠" : ""}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function QuizSetup() {
  const loc = useLocation();
  const nav = useNavigate();
  const toast = useToast();
  const subjects = useApi("/subjects/?mine=1");
  const history = useApi("/quizzes/history/");
  const [subjectId, setSubjectId] = useState(loc.state?.subject_id || null);
  const [topicIds, setTopicIds] = useState(loc.state?.topic_ids || []);
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("adaptive");
  const [types, setTypes] = useState(["mcq", "tf", "fill"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (!subjectId && subjects.data?.subjects?.length) setSubjectId(subjects.data.subjects[0].id); }, [subjects.data, subjectId]);

  const start = async () => {
    if (!topicIds.length) return toast.error("Choose at least one topic.");
    if (!types.length) return toast.error("Choose at least one question type.");
    setLoading(true);
    setError(null);
    try {
      const q = await api("/quizzes/", { method: "POST", body: { subject_id: subjectId, topic_ids: topicIds, count, difficulty, types } });
      nav(`/quiz/${q.id}`);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader icon={ClipboardCheck} art={["pencil", "star", "bulb"]} title="AI Quiz Generator" subtitle="ChatGPT writes the questions; ExamGenius validates them, marks your answers and updates your mastery." />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="space-y-5 p-6">
          <Field label="Subject" id="subj"><SelectSubject id="subj" subjects={subjects.data?.subjects} value={subjectId} onChange={(v) => { setSubjectId(v); setTopicIds([]); }} /></Field>
          <div><span className="label">Units and topics</span><TopicPicker subjectId={subjectId} value={topicIds} onChange={setTopicIds} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Number of questions: ${count}`} id="count"><input id="count" type="range" min="3" max="15" value={count} onChange={(e) => setCount(+e.target.value)} className="w-full accent-brand-600" /></Field>
            <Field label="Difficulty" id="diff" hint={difficulty === "adaptive" ? "Uses each topic's level from your past performance." : undefined}>
              <select id="diff" className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="adaptive">Adaptive (recommended)</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
              </select>
            </Field>
          </div>
          <div>
            <span className="label">Question types</span>
            <div className="flex flex-wrap gap-2">
              {TYPES.map(([v, l]) => (
                <button key={v} type="button" onClick={() => setTypes(types.includes(v) ? types.filter((x) => x !== v) : [...types, v])}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ${types.includes(v) ? "gradient-brand text-white ring-transparent" : "ring-slate-300 dark:ring-navy-700"}`}>{l}</button>
              ))}
            </div>
          </div>
          <ErrorBox error={error} />
          <Button size="lg" className="w-full" icon={Sparkles} loading={loading} onClick={start} disabled={!subjectId}>Generate quiz</Button>
          {loading && <p className="text-center text-xs text-slate-500">ChatGPT is writing {count} questions… (10-30 seconds)</p>}
        </Card>
        <Card className="p-6">
          <h2 className="mb-3 font-semibold">Quiz history</h2>
          {history.loading ? <div className="skeleton h-40" /> : history.data?.quizzes.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-navy-800">
              {history.data.quizzes.slice(0, 12).map((q) => (
                <li key={q.id}>
                  <Link to={`/quiz/${q.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                    <div className="min-w-0"><div className="truncate text-sm font-medium">{q.title}</div><div className="text-xs text-slate-500">{q.kind} · {fmtDateTime(q.submitted_at)}</div></div>
                    <span className={`font-display text-lg font-bold ${q.percent >= 70 ? "text-emerald-600" : q.percent >= 40 ? "text-amber-600" : "text-red-600"}`}>{Math.round(q.percent)}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No quizzes yet" text="Your attempts and scores will be listed here." />}
        </Card>
      </div>
    </div>
  );
}

function Timer({ quiz, onExpire }) {
  const end = useMemo(() => new Date(quiz.started_at).getTime() + quiz.duration_min * 60000, [quiz]);
  const [left, setLeft] = useState(end - Date.now());
  const fired = useRef(false);
  useEffect(() => {
    const t = setInterval(() => {
      const l = end - Date.now();
      setLeft(l);
      if (l <= 0 && !fired.current) { fired.current = true; onExpire(); }
    }, 500);
    return () => clearInterval(t);
  }, [end, onExpire]);
  const s = Math.max(0, Math.floor(left / 1000));
  const warn = s < 120;
  return (
    <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-lg font-bold ${warn ? "animate-pulse bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" : "bg-slate-100 dark:bg-navy-800"}`} aria-live="off">
      <Clock className="h-5 w-5" />{String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}
    </div>
  );
}

export function QuizRunner({ quiz, onSubmitted, compact }) {
  const toast = useToast();
  const exam = quiz.kind === "mock";
  const askConfidence = !exam && quiz.kind !== "revision";
  const [i, setI] = useState(0);
  const [ans, setAns] = useState({});
  const [flag, setFlag] = useState({});
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const qs = quiz.questions;
  const q = qs[i];
  const a = ans[q.id] || {};
  const set = (patch) => setAns({ ...ans, [q.id]: { ...a, ...patch } });
  const answered = qs.filter((x) => (ans[x.id]?.response || "").trim()).length;

  const submit = async (auto) => {
    setBusy(true);
    try {
      const r = await api(`/quizzes/${quiz.id}/submit/`, {
        method: "POST", body: { answers: qs.map((x) => ({ question_id: x.id, response: ans[x.id]?.response || "", confidence: ans[x.id]?.confidence || null })) },
      });
      if (auto) toast.info("Time is up - your exam was submitted automatically.");
      onSubmitted(r);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };
  const submitRef = useRef(submit);
  submitRef.current = submit;

  return (
    <div className={compact ? "" : "mx-auto max-w-3xl"}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{exam ? "Exam Hall - no hints, no tutor" : quiz.kind === "doubt" ? "Doubt check" : quiz.kind === "revision" ? "Mistake revision" : "Practice quiz"}</div>
          {!compact && <h1 className="text-xl font-bold">{quiz.title}</h1>}
        </div>
        {exam && quiz.duration_min && <Timer quiz={quiz} onExpire={() => submitRef.current(true)} />}
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {qs.map((x, k) => (
          <button key={x.id} onClick={() => setI(k)} aria-label={`Question ${k + 1}`}
            className={`h-8 w-8 rounded-lg text-xs font-bold ring-1 transition ${k === i ? "gradient-brand text-white ring-transparent" : (ans[x.id]?.response || "").trim() ? "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/30" : "ring-slate-300 dark:ring-navy-700"} ${flag[x.id] ? "outline-2 outline-amber-400" : ""}`}>{k + 1}</button>
        ))}
      </div>
      <Card className="p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <Badge className="bg-slate-100 dark:bg-navy-800">Q{i + 1} of {qs.length}</Badge>
          <Badge className="bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">{q.topic}</Badge>
          <Badge className="bg-slate-100 dark:bg-navy-800">{q.marks} mark{q.marks > 1 ? "s" : ""}</Badge>
          {!exam && <Badge className="bg-slate-100 capitalize dark:bg-navy-800">{q.difficulty}</Badge>}
        </div>
        <h2 className="text-lg font-semibold leading-snug">{q.text}</h2>
        <div className="mt-5">
          {q.type === "mcq" || q.type === "tf" ? (
            <div className="space-y-2">
              {q.options.map((o, k) => (
                <button key={o} onClick={() => set({ response: o })}
                  className={`flex w-full items-center gap-3 rounded-xl p-3.5 text-left text-sm ring-1 transition ${a.response === o ? "bg-brand-50 font-semibold ring-2 ring-brand-500 dark:bg-brand-500/15" : "ring-slate-200 hover:bg-slate-50 dark:ring-navy-700 dark:hover:bg-navy-800"}`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${a.response === o ? "gradient-brand text-white" : "bg-slate-100 dark:bg-navy-800"}`}>{q.type === "tf" ? o[0] : "ABCD"[k]}</span>{o}
                </button>
              ))}
            </div>
          ) : q.type === "fill" ? (
            <input className="input text-base" placeholder="Type the missing word(s)" value={a.response || ""} onChange={(e) => set({ response: e.target.value })} aria-label="Your answer" />
          ) : (
            <textarea className="input min-h-[150px] text-base" placeholder="Write your answer in your own words…" value={a.response || ""} onChange={(e) => set({ response: e.target.value })} aria-label="Your answer" />
          )}
        </div>
        {askConfidence && (
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">How confident are you?</span>
            {CONF.map(([v, l]) => (
              <button key={v} onClick={() => set({ confidence: v })}
                className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${a.confidence === v ? "bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900" : "ring-slate-300 dark:ring-navy-700"}`}>{l}</button>
            ))}
          </div>
        )}
        <div className="mt-6 flex items-center justify-between gap-2">
          <Button variant="ghost" icon={ArrowLeft} disabled={i === 0} onClick={() => setI(i - 1)}>Previous</Button>
          <div className="flex gap-2">
            {exam && <Button variant="ghost" icon={Flag} onClick={() => setFlag({ ...flag, [q.id]: !flag[q.id] })}>{flag[q.id] ? "Unflag" : "Flag"}</Button>}
            {i < qs.length - 1 ? <Button onClick={() => setI(i + 1)}>Next <ArrowRight className="h-4 w-4" /></Button>
              : <Button icon={Send} onClick={() => setConfirm(true)}>Submit</Button>}
          </div>
        </div>
      </Card>
      <p className="mt-3 text-center text-xs text-slate-500">{answered}/{qs.length} answered{qs.some((x) => x.type === "short") ? " · short answers are marked by AI against a rubric" : ""}</p>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => submit(false)} loading={busy} title="Submit your answers?"
        text={answered < qs.length ? `You have answered ${answered} of ${qs.length} questions. Unanswered questions score zero.` : "You can't change answers after submitting."} confirmLabel="Submit" />
    </div>
  );
}

export function QuizReview({ quiz, compact }) {
  const fb = quiz.feedback || {};
  const pct = Math.round(quiz.percent);
  useEffect(() => {
    const k = `eg-cel-${quiz.id}`;
    try { if (pct >= 80 && !sessionStorage.getItem(k)) { sessionStorage.setItem(k, "1"); fireConfetti(); } } catch { /* ignore */ }
  }, [quiz.id, pct]);
  return (
    <div className={compact ? "" : "mx-auto max-w-3xl"}>
      <Card className="mb-5 overflow-hidden">
        <div className={`p-6 text-white ${pct >= 70 ? "bg-gradient-to-r from-emerald-500 to-teal-600" : pct >= 40 ? "bg-gradient-to-r from-amber-500 to-orange-600" : "bg-gradient-to-r from-rose-500 to-red-600"}`}>
          <div className="text-sm font-medium text-white/85">{quiz.kind === "mock" ? "Mock exam result" : "Your result"}{!compact && ` · ${quiz.title}`}</div>
          <div className="flex items-center justify-between gap-4">
            <div className="mt-1 flex items-end gap-3"><span className="font-display text-5xl font-extrabold">{pct}%</span><span className="mb-1.5 text-white/90">{quiz.score} / {quiz.max_score} marks</span></div>
            <div className="flex items-center gap-2"><span className="hidden max-w-[180px] text-right text-sm font-semibold text-white/95 sm:block">{pct >= 80 ? "Brilliant work! 🎉" : pct >= 50 ? "Good effort - review the misses below." : "Every mistake is a lesson. They're saved for revision!"}</span>
              <Genie mood={pct >= 80 ? "celebrate" : pct >= 50 ? "happy" : "cheer"} size={74} /></div>
          </div>
          {fb.time_taken_sec != null && <div className="mt-1 text-sm text-white/85">Time taken: {Math.floor(fb.time_taken_sec / 60)} min {fb.time_taken_sec % 60} s{fb.submitted_late ? " (after time limit)" : ""}</div>}
        </div>
        <div className="space-y-3 p-5 text-sm">
          {fb.revision && <div className={`rounded-xl p-3 font-medium ${fb.revision.correct ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200" : "bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"}`}>{fb.revision.message}</div>}
          {fb.topic_accuracy?.length > 0 && (
            <div>
              <div className="mb-2 font-semibold">Topic-wise accuracy</div>
              <div className="space-y-1.5">{fb.topic_accuracy.map((t) => (
                <div key={t.topic_id} className="flex items-center gap-3"><span className="w-56 truncate">{t.topic}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-800"><div className={`h-full ${t.percent >= 70 ? "bg-emerald-500" : t.percent >= 40 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.max(2, t.percent)}%` }} /></div>
                  <span className="w-12 text-right font-semibold">{Math.round(t.percent)}%</span></div>
              ))}</div>
            </div>
          )}
          {[...(fb.events || []), ...(fb.plan_updates || [])].map((e, k) => (
            <div key={k} className="flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-brand-900 dark:bg-brand-500/10 dark:text-brand-100"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />{e}</div>
          ))}
          {quiz.questions.some((q) => !q.is_correct) && quiz.kind !== "revision" && (
            <p className="text-slate-600 dark:text-slate-400">Wrong answers were saved to <Link to="/mistakes" className="font-semibold text-brand-600 dark:text-brand-300">Mistake Memory</Link> and come back tomorrow for revision.</p>
          )}
        </div>
      </Card>
      <div className="space-y-3">
        {quiz.questions.map((q, k) => (
          <Card key={q.id} className="p-5">
            <div className="flex items-start gap-3">
              {q.is_correct ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />}
              <div className="flex-1">
                <div className="mb-1 text-xs text-slate-500">Q{k + 1} · {q.topic} · {q.marks_awarded}/{q.marks} marks{q.confidence ? ` · you were "${CONF.find((c) => c[0] === q.confidence)[1]}"` : ""}</div>
                <div className="font-medium">{q.text}</div>
                <div className="mt-2 grid gap-1 text-sm">
                  <div><span className="text-slate-500">Your answer: </span><span className={q.is_correct ? "font-semibold text-emerald-700 dark:text-emerald-300" : "font-semibold text-red-700 dark:text-red-300"}>{q.response || "(no answer)"}</span></div>
                  {!q.is_correct && q.type !== "short" && <div><span className="text-slate-500">Correct answer: </span><span className="font-semibold">{q.answer}</span></div>}
                  {q.type === "short" && <div className="mt-1 rounded-lg bg-slate-50 p-3 dark:bg-navy-800"><div className="text-xs font-semibold text-slate-500">Model answer</div>{q.answer}</div>}
                  {q.feedback && <div className="text-slate-600 dark:text-slate-300"><span className="text-slate-500">Examiner feedback: </span>{q.feedback}</div>}
                  {q.explanation && <div className="text-slate-600 dark:text-slate-300"><span className="text-slate-500">Why: </span>{q.explanation}</div>}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function QuizPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, loading, error, setData, reload } = useApi(`/quizzes/${id}/`, [id]);
  if (loading && !data) return <LoadingCards n={2} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (data.submitted_at) {
    return (
      <div>
        <div className="mx-auto mb-4 flex max-w-3xl flex-wrap justify-between gap-2">
          <Button variant="ghost" icon={ArrowLeft} onClick={() => nav(data.kind === "mock" ? "/exam-hall" : data.kind === "revision" ? "/mistakes" : "/quiz")}>Back</Button>
          {data.kind === "revision" ? <Link to="/mistakes"><Button variant="secondary" icon={RotateCcw}>Next revision</Button></Link>
            : <Link to="/quiz" state={{ subject_id: data.subject_id, topic_ids: [...new Set(data.questions.map((q) => q.topic_id))] }}><Button variant="secondary" icon={RotateCcw}>New quiz on these topics</Button></Link>}
        </div>
        <QuizReview quiz={data} />
      </div>
    );
  }
  return <QuizRunner quiz={data} onSubmitted={(r) => { setData(r); window.scrollTo(0, 0); }} />;
}
