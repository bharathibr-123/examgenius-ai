import { AlertCircle, Clock, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AIBanner, Button, Card, EmptyState, ErrorBox, Field, PageHeader, SelectSubject } from "../components/ui";
import { api, fmtDateTime, useApi } from "../lib";

export default function ExamHall() {
  const nav = useNavigate();
  const subjects = useApi("/subjects/?mine=1");
  const history = useApi("/quizzes/history/?kind=mock");
  const status = useApi("/ai/status/");
  const [subjectId, setSubjectId] = useState(null);
  const [duration, setDuration] = useState(30);
  const [count, setCount] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (!subjectId && subjects.data?.subjects?.length) setSubjectId(subjects.data.subjects[0].id); }, [subjects.data, subjectId]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const q = await api("/quizzes/mock/", { method: "POST", body: { subject_id: subjectId, duration_min: duration, count } });
      nav(`/quiz/${q.id}`, { state: { exam: true } });
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader icon={Timer} art={["calc", "cap", "star"]} title="Exam Hall Simulator" subtitle="A realistic timed mock exam: mixed objective and 5-mark descriptive questions, no hints, detailed feedback after you submit." />
      <AIBanner configured={status.data?.configured} />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="space-y-5 p-6">
          <Field label="Subject" id="ms"><SelectSubject id="ms" subjects={subjects.data?.subjects} value={subjectId} onChange={setSubjectId} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Duration" id="dur"><select id="dur" className="input" value={duration} onChange={(e) => setDuration(+e.target.value)}>{[15, 30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} minutes</option>)}</select></Field>
            <Field label="Questions" id="cnt"><select id="cnt" className="input" value={count} onChange={(e) => setCount(+e.target.value)}>{[5, 8, 10, 12, 15].map((d) => <option key={d} value={d}>{d} questions</option>)}</select></Field>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-navy-800/60">
            <div className="mb-2 flex items-center gap-2 font-semibold"><AlertCircle className="h-4 w-4 text-brand-500" />Exam rules</div>
            <ul className="list-disc space-y-1 pl-5 text-slate-600 dark:text-slate-300">
              <li>The timer starts as soon as the paper is generated and auto-submits at zero.</li>
              <li>No AI hints, tutor or notes during the exam - navigation and flagging only.</li>
              <li>Questions favour high-importance topics and match your current level per topic.</li>
              <li>Descriptive answers are marked by AI against a rubric after submission (a practice estimate).</li>
            </ul>
          </div>
          <ErrorBox error={error} />
          <Button size="lg" className="w-full" icon={Clock} loading={busy} disabled={!subjectId} onClick={start}>Generate paper and start exam</Button>
          {busy && <p className="text-center text-xs text-slate-500">Preparing your question paper… (20-40 seconds)</p>}
        </Card>
        <Card className="p-6">
          <h2 className="mb-3 font-semibold">Past mock exams</h2>
          {history.data?.quizzes.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-navy-800">
              {history.data.quizzes.map((q) => (
                <li key={q.id}><Link to={`/quiz/${q.id}`} className="flex items-center justify-between py-2.5 hover:opacity-80">
                  <div><div className="text-sm font-medium">{q.title}</div><div className="text-xs text-slate-500">{fmtDateTime(q.submitted_at)} · {q.score}/{q.max_score} marks</div></div>
                  <span className="font-display text-lg font-bold">{Math.round(q.percent)}%</span>
                </Link></li>
              ))}
            </ul>
          ) : <EmptyState icon={Timer} title="No mock exams yet" text="Your latest mock exam score feeds into the Exam Readiness score." />}
        </Card>
      </div>
    </div>
  );
}
