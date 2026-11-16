import { Dna, Gauge, Save, Target, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Button, Card, ErrorBox, Field, LoadingCards, PageHeader, StatCard } from "../components/ui";
import { api, useApi, useAuth, useToast } from "../lib";

const STYLES = [["examples", "Examples"], ["diagrams", "Diagrams"], ["steps", "Step-by-step"], ["theory", "Theory"], ["practice", "Practice questions"]];
const MODES = [["beginner", "Beginner"], ["simple", "Simple"], ["detailed", "Detailed"], ["exam", "Exam preparation"], ["interview", "Interview preparation"]];
const TIMES = [["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"], ["night", "Night"]];

export default function LearningDNA() {
  const { data, loading, error, reload } = useApi("/learning-dna/");
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [p, setP] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) setP({ full_name: user.full_name, ...user.profile }); }, [user]);
  if ((loading && !data) || !p) return <LoadingCards n={4} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const o = data.observed;
  const save = async () => {
    setBusy(true);
    try { const r = await api("/auth/profile/", { method: "PATCH", body: p }); setUser(r.user); toast.success("Profile updated - the tutor will use your new preferences."); reload(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });

  return (
    <div className="space-y-6">
      <PageHeader icon={Dna} art={["atom", "heart", "bulb"]} title="Personal Learning DNA" subtitle="Your chosen preferences plus what your study activity shows. The AI tutor uses these to personalise every answer." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Target} tone="green" label="Best question type" value={o.best_question_type || "—"} sub="needs 3+ answers per type" />
        <StatCard icon={Zap} tone="amber" label="Learning pace" value={o.pace ? `${o.pace}` : "—"} sub={`answers per active day · ${o.active_days} days`} />
        <StatCard icon={Gauge} tone="brand" label="Confidence calibration" value={<span className="text-base">{o.calibration}</span>} />
        <StatCard icon={Dna} tone="blue" label="Favourite tutor mode" value={<span className="capitalize">{o.favourite_tutor_mode || "—"}</span>} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 font-semibold">What your activity shows</h2>
          <div className="space-y-2 text-sm">
            {o.question_types.map((q) => (
              <div key={q.code} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-navy-800"><span>{q.type}</span><span>{q.answers ? <b>{q.accuracy}%</b> : <span className="text-slate-400">no answers</span>} <span className="text-xs text-slate-500">({q.answers})</span></span></div>
            ))}
          </div>
          <h3 className="mb-2 mt-5 text-sm font-semibold">Frequently difficult topics</h3>
          {o.difficult_topics.length ? <div className="flex flex-wrap gap-1.5">{o.difficult_topics.map((t) => <Badge key={t.topic} className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">{t.topic} · {t.score}%</Badge>)}</div>
            : <p className="text-sm text-slate-500">Appears after 3+ answers on a topic.</p>}
          <p className="mt-5 text-xs text-slate-500">{data.note}</p>
        </Card>
        <Card className="space-y-4 p-6">
          <h2 className="font-semibold">Your profile & preferences</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" id="fn"><input id="fn" className="input" value={p.full_name} onChange={set("full_name")} /></Field>
            <Field label="USN" id="usn"><input id="usn" className="input" value={p.usn} onChange={set("usn")} /></Field>
            <Field label="College" id="col"><input id="col" className="input" value={p.college} onChange={set("college")} /></Field>
            <Field label="Branch" id="br"><input id="br" className="input" value={p.branch} onChange={set("branch")} /></Field>
            <Field label="Year" id="yr"><select id="yr" className="input" value={p.year} onChange={set("year")}>{[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}</select></Field>
            <Field label="Semester" id="sem"><select id="sem" className="input" value={p.semester} onChange={set("semester")}>{[1, 2, 3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>Semester {s}</option>)}</select></Field>
            <Field label="Learning style" id="ls"><select id="ls" className="input" value={p.learning_style} onChange={set("learning_style")}>{STYLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label="Default tutor mode" id="dm"><select id="dm" className="input" value={p.default_mode} onChange={set("default_mode")}>{MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label="Preferred study time" id="pt"><select id="pt" className="input" value={p.preferred_time} onChange={set("preferred_time")}>{TIMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label="Study hours per day" id="dh"><input id="dh" type="number" min="0.5" max="14" step="0.5" className="input" value={p.daily_hours} onChange={set("daily_hours")} /></Field>
          </div>
          <Button icon={Save} loading={busy} onClick={save}>Save profile</Button>
        </Card>
      </div>
    </div>
  );
}
