import { Activity, BarChart3, Brain, Clock, Cpu, Target, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Button, Card, EmptyState, ErrorBox, LoadingCards, MasteryBar, PageHeader, ProgressRing, StatCard, StatusBadge, Tabs } from "../components/ui";
import { fmtDate, useApi, useTheme } from "../lib";

function ChartCard({ title, icon: Icon, children, empty, note }) {
  return (
    <Card className="p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">{Icon && <Icon className="h-4 w-4 text-brand-500" />}{title}</h2>
      {note && <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{note}</p>}
      {empty ? <p className="py-10 text-center text-sm text-slate-500">{empty}</p> : <div className="h-64">{children}</div>}
    </Card>
  );
}

function Readiness() {
  const { data, loading } = useApi("/readiness/");
  if (loading || !data) return <div className="skeleton h-48" />;
  if (!data.readiness.length) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data.readiness.map((r) => (
        <Card key={r.subject_id} className="p-5">
          <div className="flex flex-wrap items-center gap-5">
            <ProgressRing value={r.score} size={110} sub={r.band} />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">{r.subject}</h3>
              <p className="text-xs text-slate-500">{r.days_left != null ? `${r.days_left} days to exam` : "No exam date set"}{r.hours_per_day_needed ? ` · needs ~${r.hours_per_day_needed} h/day for pending topics` : ""}</p>
              <div className="mt-3 space-y-1.5">
                {r.components.map((c) => (
                  <div key={c.symbol} className="flex items-center gap-2 text-xs">
                    <span className="w-36 truncate">{c.name} <span className="text-slate-400">({c.symbol}, {Math.round(c.weight * 100)}%)</span></span>
                    {c.value == null ? <span className="text-slate-400">no data yet - weight shared out</span> : <><div className="flex-1"><MasteryBar value={c.value} /></div><span className="w-10 text-right font-semibold">{Math.round(c.value)}</span></>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {r.actions.length > 0 && <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">{r.actions.map((a, i) => <li key={i}>{a}</li>)}</ul>}
          <p className="mt-3 text-[11px] text-slate-500">R = 0.35M + 0.20C + 0.15X + 0.15V + 0.15P · {r.disclaimer}</p>
        </Card>
      ))}
    </div>
  );
}

export default function Analytics() {
  const { data, loading, error, reload } = useApi("/analytics/");
  const { dark } = useTheme();
  const [sub, setSub] = useState(0);
  if (loading && !data) return <LoadingCards n={6} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const d = data;
  const axis = { fontSize: 11, fill: dark ? "#94a3b8" : "#64748b" };
  const grid = dark ? "#232c45" : "#e2e8f0";
  const tip = { contentStyle: { background: dark ? "#121a2e" : "#fff", border: `1px solid ${grid}`, borderRadius: 12, fontSize: 12 } };
  const noData = d.overall.answers === 0;
  const subj = d.subjects[sub];
  const colorFor = (v) => (v >= 70 ? "#10b981" : v >= 40 ? "#f59e0b" : "#ef4444");

  return (
    <div className="space-y-6">
      <PageHeader icon={BarChart3} art={["calc", "atom", "star"]} title="Performance Analytics" subtitle="Every chart is calculated from your real, stored activity - nothing here is sample data." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Target} tone="green" label="Overall accuracy (30 d)" value={d.overall.accuracy == null ? "—" : `${d.overall.accuracy}%`} sub={`${d.overall.answers} answers`} />
        <StatCard icon={Brain} tone="brand" label="Strong / weak topics" value={`${d.overall.strong} / ${d.overall.weak}`} sub="3+ answers each" />
        <StatCard icon={Clock} tone="blue" label="Study time (30 d)" value={`${Math.round(d.overall.study_minutes / 6) / 10} h`} sub={`${d.overall.tasks_done} plan tasks done`} />
        <StatCard icon={Cpu} tone="amber" label="AI requests" value={d.ai_usage.calls} sub={`${d.ai_usage.cache_hits} served from cache`} />
      </div>
      <Readiness />
      {noData ? (
        <Card><EmptyState icon={BarChart3} title="No performance data yet" text="Take a quiz, a mock exam or a viva - your charts will be built from your real answers." action={<Link to="/quiz"><Button>Take your first quiz</Button></Link>} /></Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Accuracy trend" icon={TrendingUp} note="Daily score including partial marks for descriptive answers." empty={!d.trend.length && "No answers in the last 30 days."}>
              <ResponsiveContainer><LineChart data={d.trend}><CartesianGrid stroke={grid} strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={fmtDate} tick={axis} /><YAxis domain={[0, 100]} tick={axis} unit="%" /><Tooltip {...tip} labelFormatter={fmtDate} /><Line type="monotone" dataKey="accuracy" stroke="#6d5cf6" strokeWidth={3} dot={{ r: 4 }} name="Accuracy %" /></LineChart></ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Subject-wise performance" icon={BarChart3} empty={!d.subjects.length && "Add subjects to compare."}>
              <ResponsiveContainer><BarChart data={d.subjects}><CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="subject" tick={axis} /><YAxis domain={[0, 100]} tick={axis} /><Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="avg_quiz" name="Avg quiz %" fill="#6d5cf6" radius={[6, 6, 0, 0]} /><Bar dataKey="mastery" name="Mastery %" fill="#38bdf8" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
            </ChartCard>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">Unit-wise mastery</h2>
                {d.subjects.length > 1 && <Tabs value={sub} onChange={setSub} tabs={d.subjects.map((s, i) => ({ value: i, label: s.subject }))} />}
              </div>
              {subj && <div className="h-64"><ResponsiveContainer><RadarChart data={subj.units} outerRadius="72%"><PolarGrid stroke={grid} /><PolarAngleAxis dataKey="unit" tick={axis} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} /><Tooltip {...tip} formatter={(v, n, p) => [`${v}%`, p.payload.title]} /><Radar dataKey="mastery" stroke="#a855f7" fill="#a855f7" fillOpacity={0.35} /></RadarChart></ResponsiveContainer></div>}
            </Card>
            <ChartCard title="Confidence vs knowledge" icon={Activity}
              note={`Accuracy at each confidence level. Overconfident (Sure but wrong): ${d.confidence.overconfident} · Underconfident (Guessing but right): ${d.confidence.underconfident}`}
              empty={!d.confidence.levels.some((l) => l.answers) && "Pick a confidence level when answering quiz questions to see this."}>
              <ResponsiveContainer><BarChart data={d.confidence.levels}><CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="confidence" tick={axis} /><YAxis domain={[0, 100]} tick={axis} unit="%" /><Tooltip {...tip} formatter={(v, n, p) => [v == null ? "no data" : `${v}% of ${p.payload.answers}`, "Accuracy"]} /><Bar dataKey="accuracy" radius={[6, 6, 0, 0]}>{d.confidence.levels.map((l, i) => <Cell key={i} fill={["#94a3b8", "#f59e0b", "#6d5cf6"][i]} />)}</Bar></BarChart></ResponsiveContainer>
            </ChartCard>
          </div>
          {d.confidence.overconfident_topics.length > 0 && (
            <Card className="p-5 text-sm"><b>Overconfidence alert:</b> you were "Sure" but wrong on {d.confidence.overconfident_topics.map((t) => `${t.topic} (${t.count})`).join(", ")}. These need revision more than they feel like they do.</Card>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Study time per day" icon={Clock} note="Completed plan tasks + time spent in quizzes." empty={!d.study_time.length && "Complete plan tasks or quizzes to log study time."}>
              <ResponsiveContainer><BarChart data={d.study_time}><CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tickFormatter={fmtDate} tick={axis} /><YAxis tick={axis} unit="m" /><Tooltip {...tip} labelFormatter={fmtDate} /><Bar dataKey="minutes" fill="#10b981" radius={[6, 6, 0, 0]} name="Minutes" /></BarChart></ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Accuracy by question type" icon={Target} empty={!d.question_types.some((q) => q.answers) && "No answers yet."}>
              <ResponsiveContainer><BarChart data={d.question_types.filter((q) => q.answers)} layout="vertical"><CartesianGrid stroke={grid} strokeDasharray="3 3" horizontal={false} /><XAxis type="number" domain={[0, 100]} tick={axis} unit="%" /><YAxis type="category" dataKey="type" tick={axis} width={110} /><Tooltip {...tip} /><Bar dataKey="accuracy" radius={[0, 6, 6, 0]} name="Accuracy %">{d.question_types.filter((q) => q.answers).map((q, i) => <Cell key={i} fill={colorFor(q.accuracy)} />)}</Bar></BarChart></ResponsiveContainer>
            </ChartCard>
          </div>
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Topic mastery (Knowledge Gap Detector)</h2>
            <p className="mb-3 text-xs text-slate-500">Mastery = recency- and difficulty-weighted score of your last 10 answers per topic (newer answers weigh more, hard questions count double). Fewer than 3 answers = "New".</p>
            <div className="grid gap-x-8 gap-y-2.5 md:grid-cols-2">
              {d.mastery.map((m) => (
                <div key={m.topic_id} className="flex items-center gap-3 text-sm">
                  <div className="w-48 min-w-0"><div className="truncate font-medium">{m.topic}</div><div className="text-[11px] text-slate-500">{m.subject} · {m.attempts} ans · {m.level}</div></div>
                  <div className="flex-1"><MasteryBar value={m.score} status={m.status} /></div>
                  <span className="w-10 text-right font-semibold">{Math.round(m.score)}</span><StatusBadge status={m.status} />
                </div>
              ))}
            </div>
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-3 font-semibold">Recent attempts</h2>
              <ul className="divide-y divide-slate-100 text-sm dark:divide-navy-800">{d.history.map((h) => (
                <li key={h.id}><Link to={h.kind === "viva" ? `/viva/${h.id}` : `/quiz/${h.id}`} className="flex justify-between py-2 hover:opacity-80"><span className="truncate">{h.title} <span className="text-xs text-slate-400">({h.kind})</span></span><b style={{ color: colorFor(h.percent) }}>{Math.round(h.percent)}%</b></Link></li>
              ))}</ul>
            </Card>
            <Card className="p-5 text-sm">
              <h2 className="mb-3 font-semibold">AI usage & sustainability</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-navy-800"><div className="text-xs text-slate-500">Tokens (in / out)</div><b>{d.ai_usage.prompt_tokens.toLocaleString()} / {d.ai_usage.completion_tokens.toLocaleString()}</b></div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-navy-800"><div className="text-xs text-slate-500">Estimated cost</div><b>${d.ai_usage.est_cost_usd}</b></div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-navy-800"><div className="text-xs text-slate-500">Cache hits (0 tokens)</div><b>{d.ai_usage.cache_hits}</b></div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-navy-800"><div className="text-xs text-slate-500">Failed requests</div><b>{d.ai_usage.failed}</b></div>
              </div>
              <p className="mt-3 text-xs text-slate-500">Scoring, mastery, readiness, scheduling and objective grading run in plain Python with no AI cost. ChatGPT is only called to generate or evaluate content.</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{d.ai_usage.by_feature.map((f) => <span key={f.feature} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs dark:bg-navy-800">{f.feature}: {f.calls}</span>)}</div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
