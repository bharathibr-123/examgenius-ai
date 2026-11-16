import { CalendarCheck, Flame, History, Hourglass, Library, Lock, MessageCircleQuestion, Mic, PenLine, Rocket, RotateCcw, Star, Target, Timer, Trophy, Zap } from "lucide-react";

const Icons = { CalendarCheck, Flame, History, Hourglass, Library, MessageCircleQuestion, Mic, PenLine, Rocket, RotateCcw, Star, Target, Timer, Trophy, Zap };
import { useEffect } from "react";
import { Genie } from "../components/art";
import { fireConfetti } from "../components/extras";
import { Card, ErrorBox, LoadingCards, PageHeader } from "../components/ui";
import { useApi, useToast } from "../lib";

/* Celebrate achievements the student hasn't seen yet (remembered per browser). */
export function useNewAchievements(list) {
  const toast = useToast();
  useEffect(() => {
    if (!list) return;
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem("eg-badges") || "[]"); } catch { /* storage unavailable */ }
    const earned = list.filter((a) => a.earned).map((a) => a.id);
    const fresh = earned.filter((id) => !seen.includes(id));
    if (fresh.length && seen.length + fresh.length > 0) {
      const first = list.find((a) => a.id === fresh[0]);
      fireConfetti();
      toast.success(`🏆 Achievement unlocked: ${first.title}${fresh.length > 1 ? ` (+${fresh.length - 1} more)` : ""}`);
    }
    try { localStorage.setItem("eg-badges", JSON.stringify(earned)); } catch { /* ignore */ }
  }, [list, toast]);
}

export function Badge3D({ a, small }) {
  const Icon = Icons[a.icon] || Trophy;
  const pct = Math.round((100 * a.progress) / a.goal);
  return (
    <div className={`group relative flex flex-col items-center text-center ${small ? "w-20" : ""}`} title={`${a.title}: ${a.description}`}>
      <div className={`relative grid place-items-center rounded-full transition group-hover:scale-105 ${small ? "h-14 w-14" : "h-20 w-20"} ${a.earned
        ? "bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500 shadow-lg shadow-amber-500/30 ring-4 ring-amber-200 dark:ring-amber-500/30"
        : "bg-slate-100 ring-4 ring-slate-200 dark:bg-navy-800 dark:ring-navy-700"}`}>
        <Icon className={`${small ? "h-6 w-6" : "h-9 w-9"} ${a.earned ? "text-white drop-shadow" : "text-slate-400"}`} />
        {!a.earned && <Lock className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-white p-1 text-slate-500 shadow dark:bg-navy-900" />}
      </div>
      <div className={`mt-2 font-semibold leading-tight ${small ? "text-[11px]" : "text-sm"}`}>{a.title}</div>
      {!small && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{a.description}</div>}
      {!small && !a.earned && (
        <div className="mt-2 w-24"><div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-navy-800"><div className="gradient-brand h-full" style={{ width: `${pct}%` }} /></div><div className="mt-0.5 text-[10px] text-slate-500">{a.progress}/{a.goal}</div></div>
      )}
    </div>
  );
}

export default function Achievements() {
  const { data, loading, error, reload } = useApi("/achievements/");
  useNewAchievements(data?.achievements);
  if (loading && !data) return <LoadingCards n={3} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const pct = Math.round((100 * data.earned) / data.total);
  return (
    <div>
      <PageHeader icon={Trophy} title="Achievements" art={["star", "rocket", "cap"]} subtitle="Badges are earned from your real study activity - quizzes, streaks, mastery, revision and focus time." />
      <Card className="relative mb-6 overflow-hidden p-6">
        <div className="bg-dots absolute inset-0 opacity-70" />
        <div className="relative flex flex-wrap items-center gap-6">
          <Genie mood={data.earned ? "celebrate" : "happy"} size={110} className="animate-bob" />
          <div className="min-w-[220px] flex-1">
            <div className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-300">Level {data.level} learner</div>
            <div className="font-display text-3xl font-extrabold">{data.earned} / {data.total} badges</div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-800"><div className="gradient-brand h-full transition-all duration-700" style={{ width: `${pct}%` }} /></div>
            <p className="mt-2 text-sm text-slate-500">{data.earned === data.total ? "Legend! Every badge unlocked." : "Every badge is a real study habit. Keep going!"}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 px-5 py-3 text-center dark:bg-amber-500/10"><div className="text-xs font-semibold text-amber-700 dark:text-amber-300">XP</div><div className="font-display text-2xl font-extrabold text-amber-600">{data.xp}</div></div>
        </div>
      </Card>
      <Card className="p-6">
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {[...data.achievements].sort((a, b) => b.earned - a.earned).map((a) => <Badge3D key={a.id} a={a} />)}
        </div>
      </Card>
    </div>
  );
}
