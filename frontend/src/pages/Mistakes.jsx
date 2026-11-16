import { CalendarClock, CheckCircle2, History, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, EmptyState, ErrorBox, LoadingCards, PageHeader, StatCard, Tabs } from "../components/ui";
import { api, fmtDate, useApi, useToast } from "../lib";

export default function Mistakes() {
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState("queue");
  const queue = useApi("/revision/queue/");
  const list = useApi(`/mistakes/?status=${tab === "resolved" ? "resolved" : "open"}`, [tab]);
  const [busy, setBusy] = useState(null);

  const revise = async (id) => {
    setBusy(id);
    try { const q = await api(`/mistakes/${id}/revise/`, { method: "POST" }); nav(`/quiz/${q.id}`); }
    catch (e) { toast.error(e.message); setBusy(null); }
  };
  const c = list.data?.counts;

  return (
    <div>
      <PageHeader icon={RotateCcw} art={["rocket", "star", "bulb"]} title="Mistake Memory & Revision Time Machine" subtitle="Every wrong answer is saved and comes back on a spaced-repetition schedule: 1 → 3 → 7 → 14 → 30 days. Get it right to move it forward; get it wrong and it returns tomorrow." />
      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard icon={CalendarClock} tone="red" label="Due today" value={c?.due ?? "—"} />
        <StatCard icon={History} tone="amber" label="Open mistakes" value={c?.open ?? "—"} />
        <StatCard icon={CheckCircle2} tone="green" label="Mastered" value={c?.resolved ?? "—"} />
      </div>
      <div className="mb-4"><Tabs value={tab} onChange={setTab} tabs={[{ value: "queue", label: "Today's revision queue" }, { value: "open", label: "All open mistakes" }, { value: "resolved", label: "Mastered" }]} /></div>
      {tab === "queue" ? (
        queue.loading ? <LoadingCards n={2} /> : queue.error ? <ErrorBox error={queue.error} /> : queue.data.queue.length ? (
          <div className="space-y-3">
            {queue.data.queue.map((it) => (
              <Card key={it.type + it.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                    <Badge className="bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">{it.topic}</Badge>
                    {it.type === "mistake" ? <Badge className="bg-slate-100 dark:bg-navy-800">Review #{it.step + 1}</Badge> : <Badge className="bg-amber-100 text-amber-800">Keep fresh</Badge>}
                    {it.overdue_days > 0 && <Badge className="bg-red-100 text-red-700">{it.overdue_days} day(s) overdue</Badge>}
                    <span className="text-slate-400">priority {it.priority}</span>
                  </div>
                  <div className="text-sm font-medium">{it.question}</div>
                </div>
                {it.type === "mistake"
                  ? <Button icon={RotateCcw} loading={busy === it.id} onClick={() => revise(it.id)}>Revise now</Button>
                  : <Button variant="secondary" icon={Sparkles} onClick={() => nav("/quiz", { state: { subject_id: it.subject_id, topic_ids: [it.topic_id] } })}>Quick quiz</Button>}
              </Card>
            ))}
          </div>
        ) : <Card><EmptyState icon={CheckCircle2} title="Nothing due today 🎉" text="Wrong answers from quizzes land here the next day. Come back tomorrow, or take a quiz." /></Card>
      ) : list.loading ? <LoadingCards n={2} /> : list.data?.mistakes.length ? (
        <div className="space-y-3">
          {list.data.mistakes.map((m) => (
            <Card key={m.id} className="p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <Badge className="bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">{m.subject} · {m.topic}</Badge>
                <span className="text-slate-500">Saved {fmtDate(m.created_at)}</span>
                {!m.resolved && <span className="text-slate-500">· next review {fmtDate(m.due_date)} (every {m.interval_days} d)</span>}
                {m.last_result && <Badge className={m.last_result === "correct" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>last: {m.last_result}</Badge>}
              </div>
              <div className="font-medium">{m.question}</div>
              <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                <div><span className="text-slate-500">You answered: </span><span className="font-semibold text-red-600 dark:text-red-300">{m.your_answer || "(blank)"}</span></div>
                <div><span className="text-slate-500">Correct: </span><span className="font-semibold text-emerald-700 dark:text-emerald-300">{m.type === "short" ? "see model answer" : m.correct_answer}</span></div>
              </div>
              {m.explanation && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{m.explanation}</p>}
              {!m.resolved && <div className="mt-3"><Button size="sm" variant="soft" icon={RotateCcw} loading={busy === m.id} onClick={() => revise(m.id)}>Revise now</Button></div>}
            </Card>
          ))}
        </div>
      ) : <Card><EmptyState icon={History} title={tab === "resolved" ? "Nothing mastered yet" : "No mistakes saved yet"} text="Answer quizzes - every wrong answer is stored here automatically." /></Card>}
    </div>
  );
}
