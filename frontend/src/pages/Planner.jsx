import { CalendarCheck, CheckCircle2, Circle, Clock, Coffee, History, LifeBuoy, RefreshCw, SkipForward, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorBox, Field, LoadingCards, MasteryBar, Modal, PageHeader, SelectSubject, Tabs } from "../components/ui";
import { api, useApi, useAuth, useToast } from "../lib";
import { useFocus } from "../components/extras";
import { Hourglass } from "lucide-react";

const KIND = {
  study: { cls: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200", label: "Study" },
  revise: { cls: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200", label: "Revise" },
  quiz: { cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200", label: "Quiz" },
  break: { cls: "bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300", label: "Break" },
  mock: { cls: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200", label: "Mock exam" },
};

function CreatePlan({ onCreated, initialSubject, initialMode }) {
  const { user } = useAuth();
  const toast = useToast();
  const subjects = useApi("/subjects/?mine=1");
  const [subjectId, setSubjectId] = useState(initialSubject || null);
  const [mode, setMode] = useState(initialMode || "normal");
  const [examDate, setExamDate] = useState("");
  const [hours, setHours] = useState(user?.profile?.daily_hours || 4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const preview = useApi(mode === "rescue" && subjectId ? `/plans/rescue-preview/?subject_id=${subjectId}` : null, [mode, subjectId]);
  useEffect(() => { if (!subjectId && subjects.data?.subjects?.length) setSubjectId(subjects.data.subjects[0].id); }, [subjects.data, subjectId]);
  useEffect(() => {
    const s = subjects.data?.subjects.find((x) => x.id === subjectId);
    if (s?.exam_date) setExamDate(s.exam_date);
  }, [subjectId, subjects.data]);
  const min = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const p = await api("/plans/", { method: "POST", body: { subject_id: subjectId, exam_date: examDate, daily_hours: hours, mode } });
      toast.success(mode === "rescue" ? "Exam Rescue plan ready. You've got this!" : "Study plan created.");
      onCreated(p);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <Tabs value={mode} onChange={setMode} tabs={[{ value: "normal", label: "Regular study plan" }, { value: "rescue", label: "🚨 Exam Rescue Mode" }]} />
      {mode === "rescue" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <b>Exam Rescue Mode</b> ranks every topic by <code>importance/5 × (1 − mastery/100) × b</code>, where b = 1.2 if the topic is a prerequisite of a weak topic. It then fits the highest-priority topics into your hours (45 min study → 15 min quiz → 10 min break) and keeps the last ~20% of days for final revision and a mock exam. It re-plans after every quiz: below 50% adds a re-study block, 80%+ frees up time. Topics that don't fit are listed honestly. It can't promise a score.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Subject" id="ps"><SelectSubject id="ps" subjects={subjects.data?.subjects} value={subjectId} onChange={setSubjectId} /></Field>
        <Field label="Exam date" id="pd"><input id="pd" type="date" min={min} className="input" value={examDate} onChange={(e) => setExamDate(e.target.value)} /></Field>
        <Field label="Study hours per day" id="ph"><input id="ph" type="number" min="0.5" max="14" step="0.5" className="input" value={hours} onChange={(e) => setHours(e.target.value)} /></Field>
      </div>
      {mode === "rescue" && preview.data && (
        <div>
          <div className="mb-2 text-sm font-semibold">Priority ranking from your current mastery</div>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-navy-700">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500 dark:bg-navy-800"><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Topic</th><th className="p-2">Imp.</th><th className="p-2">Mastery</th><th className="p-2">Priority</th></tr></thead>
              <tbody>{preview.data.topics.map((t, i) => (
                <tr key={t.topic_id} className="border-t border-slate-100 dark:border-navy-800">
                  <td className="p-2 text-slate-400">{i + 1}</td><td className="p-2">{t.topic} {t.weak && <Badge className="bg-red-100 text-red-700">weak</Badge>}{t.done && <Badge className="bg-emerald-100 text-emerald-700">done</Badge>}</td>
                  <td className="p-2 text-center">{t.importance}</td><td className="p-2 text-center">{t.mastery}%</td><td className="p-2 text-center font-semibold">{t.priority}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </div>
      )}
      <ErrorBox error={error} />
      <Button size="lg" className="w-full" icon={mode === "rescue" ? LifeBuoy : CalendarCheck} loading={busy} disabled={!subjectId || !examDate} onClick={create}>
        {mode === "rescue" ? "Generate emergency plan" : "Generate study plan"}
      </Button>
    </div>
  );
}

function PlanView({ plan, onChange, onDelete }) {
  const toast = useToast();
  const focus = useFocus();
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  const setStatus = async (t, status) => {
    onChange({ ...plan, days: plan.days.map((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, status } : x)) })) });
    try { await api(`/tasks/${t.id}/`, { method: "PATCH", body: { status } }); }
    catch (e) { toast.error(e.message); }
  };
  const recalc = async () => {
    setBusy(true);
    try { onChange(await api(`/plans/${plan.id}/recalculate/`, { method: "POST" })); toast.success("Plan recalculated from your latest mastery."); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const remove = async () => { await api(`/plans/${plan.id}/`, { method: "DELETE" }); onDelete(); toast.success("Plan deleted."); };
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">{plan.subject}</h2>
            {plan.mode === "rescue" ? <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"><LifeBuoy className="h-3 w-3" />Rescue mode</Badge> : <Badge className="bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">Study plan</Badge>}
          </div>
          <p className="text-sm text-slate-500">Exam on {new Date(plan.exam_date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · {plan.days_left} days left · {plan.daily_hours} h/day</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" icon={RefreshCw} loading={busy} onClick={recalc}>Recalculate</Button>
          <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDel(true)} aria-label="Delete plan" />
        </div>
      </div>
      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs"><span>{plan.progress.done}/{plan.progress.total} tasks done{plan.progress.missed ? ` · ${plan.progress.missed} missed (rescheduled)` : ""}</span><span className="font-semibold">{plan.progress.percent}%</span></div>
        <MasteryBar value={plan.progress.percent} status="strong" />
      </div>
      {plan.recovery_changes?.length > 0 && (
        <div className="mb-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-500/10 dark:text-blue-100">
          <b>Study Recovery:</b> you missed some tasks, so ExamGenius rescheduled them.<ul className="mt-1 list-disc pl-5">{plan.recovery_changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
      {plan.uncovered?.length > 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
          <div className="flex items-center gap-2 font-semibold"><TriangleAlert className="h-4 w-4" />Not covered in the time available (lowest priority):</div>
          <div className="mt-1">{plan.uncovered.map((u) => u.topic).join(" · ")}</div>
        </div>
      )}
      <div className="space-y-4">
        {plan.days.map((d) => (
          <div key={d.date} className={`rounded-xl p-3 ring-1 ${d.date === today ? "bg-brand-50/60 ring-brand-300 dark:bg-brand-500/10 dark:ring-brand-500/40" : d.date < today ? "opacity-70 ring-slate-200 dark:ring-navy-700" : "ring-slate-200 dark:ring-navy-700"}`}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <b>{d.date === today ? "Today · " : ""}{new Date(d.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</b>
              <span className="text-xs text-slate-500"><Clock className="mr-1 inline h-3 w-3" />{Math.round(d.minutes / 6) / 10} h</span>
            </div>
            <ul className="space-y-1.5">
              {d.tasks.map((t) => (
                <li key={t.id} className={`flex items-center gap-2.5 text-sm ${t.status === "skipped" ? "opacity-50" : ""}`}>
                  {t.kind === "break" ? <Coffee className="h-4 w-4 text-slate-400" /> : (
                    <button onClick={() => setStatus(t, t.status === "done" ? "pending" : "done")} disabled={t.status === "missed" || t.status === "skipped"} aria-label="Toggle done">
                      {t.status === "done" ? <CheckCircle2 className="h-[18px] w-[18px] text-emerald-500" /> : <Circle className="h-[18px] w-[18px] text-slate-300 dark:text-slate-600" />}
                    </button>
                  )}
                  <Badge className={KIND[t.kind].cls}>{KIND[t.kind].label}</Badge>
                  <span className={`flex-1 ${t.status === "done" ? "text-slate-400 line-through" : ""}`}>{t.title}{t.rescheduled_from && <span className="ml-1 text-xs text-blue-600">(moved)</span>}</span>
                  {t.status === "missed" && <Badge className="bg-red-100 text-red-700">missed</Badge>}
                  {t.status === "skipped" && <Badge className="bg-slate-100 text-slate-500"><SkipForward className="h-3 w-3" />not needed</Badge>}
                  <span className="w-12 text-right text-xs text-slate-500">{t.minutes}m</span>
                  {t.kind === "quiz" && t.topic_id && t.status === "pending" && <Link to="/quiz" state={{ subject_id: plan.subject_id, topic_ids: [t.topic_id] }} className="text-xs font-semibold text-brand-600 dark:text-brand-300">Start</Link>}
                  {t.kind === "mock" && t.status === "pending" && <Link to="/exam-hall" className="text-xs font-semibold text-brand-600 dark:text-brand-300">Start</Link>}
                  {(t.kind === "study" || t.kind === "revise") && t.status === "pending" && (
                    <button onClick={() => focus.start({ minutes: t.minutes, label: t.title, task_id: t.id, onDone: () => onChange({ ...plan, days: plan.days.map((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, status: "done" } : x)) })) }) })}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-300" title="Focus timer for this task"><Hourglass className="h-3.5 w-3.5" />Focus</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {plan.notes?.length > 0 && (
        <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold text-slate-600 dark:text-slate-300"><History className="mr-1 inline h-4 w-4" />Plan change log</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600 dark:text-slate-400">{plan.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></details>
      )}
      <ConfirmDialog open={del} onClose={() => setDel(false)} onConfirm={remove} danger title="Delete this plan?" text="All its tasks will be removed. Your quiz history and mastery are kept." confirmLabel="Delete plan" />
    </Card>
  );
}

export default function Planner() {
  const loc = useLocation();
  const { data, loading, error, reload, setData } = useApi("/plans/");
  const [open, setOpen] = useState(!!loc.state?.rescue || !!loc.state?.subject_id);
  if (loading && !data) return <LoadingCards n={2} />;
  return (
    <div>
      <PageHeader icon={CalendarCheck} art={["calc", "bulb", "rocket"]} title="Study Planner & Exam Rescue" subtitle="Deterministic scheduling that respects your daily hours, adapts after quizzes and reschedules missed tasks automatically."
        actions={<><Button icon={CalendarCheck} onClick={() => setOpen("normal")}>New plan</Button><Button variant="danger" icon={LifeBuoy} onClick={() => setOpen("rescue")}>Exam Rescue</Button></>} />
      <ErrorBox error={error} onRetry={reload} />
      {data?.plans.length ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {data.plans.map((p) => (
            <PlanView key={p.id} plan={p} onChange={(np) => setData((d) => ({ plans: d.plans.map((x) => (x.id === p.id ? np : x)) }))} onDelete={reload} />
          ))}
        </div>
      ) : <Card><EmptyState icon={CalendarCheck} title="No study plans yet" text="Create a plan for a subject and its exam date. If the exam is close, use Exam Rescue Mode." action={<Button onClick={() => setOpen("normal")}>Create my first plan</Button>} /></Card>}
      <Modal open={!!open} onClose={() => setOpen(false)} title="Create a plan" wide>
        <CreatePlan initialSubject={loc.state?.rescue || loc.state?.subject_id} initialMode={open === "rescue" || loc.state?.rescue ? "rescue" : "normal"}
          onCreated={() => { setOpen(false); reload(); }} />
      </Modal>
    </div>
  );
}
