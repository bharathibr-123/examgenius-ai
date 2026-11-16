import {
  AlertTriangle, ArrowRight, BookOpen, Bot, CalendarCheck, CheckCircle2, Circle, ClipboardCheck, Flame, LifeBuoy,
  RotateCcw, Target, Timer, TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { AIBanner, Button, Card, EmptyState, ErrorBox, LoadingCards, MasteryBar, ProgressRing, StatCard } from "../components/ui";
import { api, fmtDate, fmtDateTime, SUBJECT_COLORS, useApi, useToast } from "../lib";
import { Genie } from "../components/art";
import { useFocus } from "../components/extras";
import { Badge3D, useNewAchievements } from "./Achievements";
import { Hourglass, Trophy } from "lucide-react";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Dashboard() {
  const { data, loading, error, reload, setData } = useApi("/dashboard/");
  const ach = useApi("/achievements/");
  useNewAchievements(ach.data?.achievements);
  const toast = useToast();
  const focus = useFocus();

  const toggleTask = async (t) => {
    const status = t.status === "done" ? "pending" : "done";
    setData((d) => ({ ...d, today_tasks: d.today_tasks.map((x) => (x.id === t.id ? { ...x, status } : x)) }));
    try {
      await api(`/tasks/${t.id}/`, { method: "PATCH", body: { status } });
      if (status === "done") toast.success("Nice! Task completed.");
    } catch (e) {
      toast.error(e.message);
      reload();
    }
  };

  if (loading && !data) return <LoadingCards n={6} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const d = data;
  const ne = d.next_exam;
  const doneToday = d.today_tasks.filter((t) => t.status === "done").length;

  return (
    <div className="space-y-6">
      <AIBanner configured={d.ai.configured} />
      {/* hero */}
      <div className="gradient-brand relative overflow-hidden rounded-3xl p-6 text-white sm:p-8">
        <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 right-40 h-44 w-44 rounded-full bg-white/10" />
        <div className="relative grid items-center gap-6 md:grid-cols-[auto_1fr_auto]">
          <Genie mood="wave" size={118} className="hidden animate-bob drop-shadow-xl md:block" />
          <div>
            <p className="text-sm font-medium text-white/80">{greeting()},</p>
            <h1 className="text-3xl font-bold">{d.user.name} 👋</h1>
            {ne ? (
              <p className="mt-2 max-w-xl text-white/90">
                <b>{ne.subject}</b> exam in <b>{ne.days_left} day{ne.days_left === 1 ? "" : "s"}</b> ({fmtDate(ne.exam_date)}).{" "}
                {ne.actions[0] || "Keep going!"}
              </p>
            ) : (
              <p className="mt-2 text-white/90">Add exam dates to your subjects to unlock countdowns, readiness and Exam Rescue Mode.</p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/quiz" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"><ClipboardCheck className="h-4 w-4" />Take a quiz</Link>
              <Link to="/tutor" className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold ring-1 ring-white/30 hover:bg-white/25"><Bot className="h-4 w-4" />Ask the tutor</Link>
              {ne && ne.days_left <= 7 && (
                <Link to="/planner" state={{ rescue: ne.subject_id }} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-amber-950 hover:bg-amber-300"><LifeBuoy className="h-4 w-4" />Exam Rescue Mode</Link>
              )}
            </div>
          </div>
          {ne && (
            <div className="flex items-center gap-5 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur">
              <div className="text-center">
                <div className="font-display text-5xl font-extrabold leading-none">{ne.days_left}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/80">days left</div>
              </div>
              <div className="h-14 w-px bg-white/25" />
              <div>
                <div className="text-xs text-white/80">{ne.short} readiness</div>
                <div className="font-display text-3xl font-bold">{Math.round(ne.score)}%</div>
                <div className="text-xs font-semibold text-white/90">{ne.band}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Flame} tone="amber" label="Study streak" value={`${d.stats.streak} day${d.stats.streak === 1 ? "" : "s"}`} sub="Days with study activity" />
        <StatCard icon={Target} tone="green" label="Objective accuracy" value={d.stats.accuracy == null ? "—" : `${d.stats.accuracy}%`} sub={`${d.stats.answers} answers so far`} />
        <StatCard icon={ClipboardCheck} tone="brand" label="Quizzes completed" value={d.stats.quizzes} sub={`${d.stats.topics_practised} topics practised`} />
        <StatCard icon={RotateCcw} tone={d.revision_due ? "red" : "blue"} label="Revision due" value={d.revision_due} sub="Mistake Memory queue" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* readiness */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Overall exam readiness</h2>
            <Link to="/analytics" className="text-xs font-semibold text-brand-600 dark:text-brand-300">Details</Link>
          </div>
          <div className="flex items-center gap-5">
            <ProgressRing value={d.overall_readiness} size={124} sub="readiness" />
            <div className="flex-1 space-y-2 text-sm">
              {d.subjects.length ? d.subjects.map((s) => (
                <div key={s.id}>
                  <div className="flex justify-between text-xs"><span className="font-semibold">{s.short}</span><span>{Math.round(s.readiness)}%</span></div>
                  <MasteryBar value={s.readiness} />
                </div>
              )) : <p className="text-slate-500">No subjects yet.</p>}
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">Estimated preparation indicator - not a prediction of university marks.</p>
        </Card>

        {/* today's tasks */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Today's study tasks</h2>
            <span className="text-xs font-semibold text-slate-500">{doneToday}/{d.today_tasks.length} done</span>
          </div>
          {d.today_tasks.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-navy-800">
              {d.today_tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <button onClick={() => toggleTask(t)} aria-label={t.status === "done" ? "Mark not done" : "Mark done"} className="text-brand-600 dark:text-brand-300">
                    {t.status === "done" ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5 text-slate-300 dark:text-slate-600" />}
                  </button>
                  <div className={`flex-1 text-sm ${t.status === "done" ? "text-slate-400 line-through" : ""}`}>{t.title}</div>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold dark:bg-navy-800">{t.subject}</span>
                  <span className="w-14 text-right text-xs text-slate-500">{t.minutes} min</span>
                  {t.kind === "quiz" && t.topic_id && t.status !== "done" && (
                    <Link to="/quiz" state={{ subject_id: t.subject_id, topic_ids: [t.topic_id] }} className="text-xs font-semibold text-brand-600 dark:text-brand-300">Start</Link>
                  )}
                  {t.kind === "mock" && t.status !== "done" && <Link to="/exam-hall" className="text-xs font-semibold text-brand-600 dark:text-brand-300">Start</Link>}
                  {(t.kind === "study" || t.kind === "revise") && t.status !== "done" && (
                    <button onClick={() => focus.start({ minutes: t.minutes, label: t.title, task_id: t.id, onDone: reload })} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-300" title="Start a focus timer for this task"><Hourglass className="h-3.5 w-3.5" />Focus</button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CalendarCheck} title="No plan for today yet" text="Create a study plan and today's tasks will appear here."
              action={<Link to="/planner"><Button icon={CalendarCheck}>Create a study plan</Button></Link>} />
          )}
        </Card>
      </div>

      {/* achievements */}
      {ach.data && (
        <Card className="relative overflow-hidden p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold"><Trophy className="h-4 w-4 text-amber-500" />Achievements <span className="text-sm font-normal text-slate-500">· Level {ach.data.level} · {ach.data.earned}/{ach.data.total} badges</span></h2>
            <Link to="/achievements" className="text-xs font-semibold text-brand-600 dark:text-brand-300">View all</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {[...ach.data.achievements].sort((a, b) => b.earned - a.earned || b.progress / b.goal - a.progress / a.goal).slice(0, 8).map((a) => <Badge3D key={a.id} a={a} small />)}
          </div>
        </Card>
      )}

      {/* subjects */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your subjects</h2>
          <Link to="/subjects" className="text-sm font-semibold text-brand-600 dark:text-brand-300">Manage</Link>
        </div>
        {d.subjects.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {d.subjects.map((s) => (
              <Link key={s.id} to={`/subjects/${s.id}`} className="card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className={`h-1.5 bg-gradient-to-r ${SUBJECT_COLORS[s.color] || SUBJECT_COLORS.indigo}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div><div className="text-xs font-semibold text-slate-500">{s.code}</div><div className="font-semibold">{s.name}</div></div>
                    {s.days_left != null && <span className={`rounded-lg px-2 py-1 text-xs font-bold ${s.days_left <= 7 ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" : "bg-slate-100 dark:bg-navy-800"}`}>{s.days_left}d</span>}
                  </div>
                  <div className="mt-4 flex justify-between text-xs text-slate-500"><span>Mastery</span><span className="font-semibold text-slate-700 dark:text-slate-200">{s.mastery}%</span></div>
                  <MasteryBar value={s.mastery} className="mt-1" />
                  <div className="mt-3 flex justify-between text-xs text-slate-500">
                    <span>{s.practised}/{s.topics} topics practised</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-brand-600 opacity-0 transition group-hover:opacity-100 dark:text-brand-300">Open <ArrowRight className="h-3 w-3" /></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Card><EmptyState icon={BookOpen} title="Pick your subjects" text="Choose subjects to get personalised quizzes, notes and plans." action={<Link to="/subjects"><Button>Browse subjects</Button></Link>} /></Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-amber-500" />Weak-topic alerts</h2>
          {d.weak_topics.length || d.repeated_mistakes.length || d.prerequisite_gaps.length ? (
            <ul className="space-y-2.5 text-sm">
              {d.weak_topics.map((w) => (
                <li key={"w" + w.topic_id} className="flex items-center justify-between gap-3 rounded-xl bg-red-50 px-3 py-2.5 dark:bg-red-500/10">
                  <span><b>{w.topic}</b> <span className="text-slate-500">({w.subject})</span> - mastery {w.score}%</span>
                  <Link to="/quiz" state={{ subject_id: w.subject_id, topic_ids: [w.topic_id] }} className="shrink-0 text-xs font-semibold text-red-700 dark:text-red-300">Practise</Link>
                </li>
              ))}
              {d.repeated_mistakes.map((r) => (
                <li key={"r" + r.topic_id} className="rounded-xl bg-amber-50 px-3 py-2.5 dark:bg-amber-500/10"><b>{r.topic}</b>: {r.mistakes} repeated mistakes in 14 days.</li>
              ))}
              {d.prerequisite_gaps.map((p, i) => (
                <li key={"p" + i} className="rounded-xl bg-blue-50 px-3 py-2.5 dark:bg-blue-500/10">Before <b>{p.topic}</b>, strengthen the prerequisite <b>{p.prerequisite}</b>.</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">No weak topics detected yet. Alerts appear after 3+ answers on a topic score under 40%.</p>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4 text-brand-500" />Recent activity</h2>
          {d.recent.length ? (
            <ul className="space-y-2">
              {d.recent.map((a, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  <div className="flex-1">{a.link ? <Link to={a.link} className="hover:underline">{a.text}</Link> : a.text}</div>
                  <span className="shrink-0 text-xs text-slate-400">{fmtDateTime(a.at)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">Your study activity will appear here.</p>}
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: "/exam-hall", icon: Timer, t: "Exam Hall", d: "Timed mock exam" },
          { to: "/evaluator", icon: ClipboardCheck, t: "Answer Evaluator", d: "Mark your 5/10-mark answer" },
          { to: "/mistakes", icon: RotateCcw, t: "Revision queue", d: `${d.revision_due} due today` },
          { to: "/planner", icon: CalendarCheck, t: "Study planner", d: "Plan until your exam" },
        ].map(({ to, icon: Icon, t, d: dd }) => (
          <Link key={to} to={to} className="card flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"><Icon className="h-5 w-5" /></div>
            <div><div className="text-sm font-semibold">{t}</div><div className="text-xs text-slate-500">{dd}</div></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
