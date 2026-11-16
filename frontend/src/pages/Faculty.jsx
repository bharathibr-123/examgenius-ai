import { BookPlus, ClipboardCheck, Cpu, ExternalLink, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { Button, Card, ErrorBox, Field, LoadingCards, MasteryBar, PageHeader, StatCard } from "../components/ui";
import { api, useApi, useToast } from "../lib";

export default function Faculty() {
  const { data, loading, error, reload } = useApi("/faculty/overview/");
  const subjects = useApi("/subjects/public/");
  const toast = useToast();
  const [topic, setTopic] = useState({ subject: "", unit_number: 1, name: "", summary: "", importance: 3 });
  const [subj, setSubj] = useState({ code: "", name: "", short: "", semester: 5, modules: 5 });
  const [busy, setBusy] = useState(null);
  if (loading && !data) return <LoadingCards n={4} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const addTopic = async (e) => {
    e.preventDefault();
    setBusy("t");
    try { await api(`/faculty/subjects/${topic.subject}/topics/`, { method: "POST", body: topic }); toast.success("Topic added to the syllabus."); setTopic({ ...topic, name: "", summary: "" }); reload(); }
    catch (err) { toast.error(err.message); } finally { setBusy(null); }
  };
  const addSubject = async (e) => {
    e.preventDefault();
    setBusy("s");
    try { await api("/faculty/subjects/", { method: "POST", body: subj }); toast.success("Subject created."); setSubj({ code: "", name: "", short: "", semester: 5, modules: 5 }); reload(); subjects.reload(); }
    catch (err) { toast.error(err.message); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <PageHeader icon={ShieldCheck} title="Faculty Portal" subtitle={data.privacy_note}
        actions={<a href="/django-admin/" target="_blank" rel="noreferrer"><Button variant="secondary" icon={ExternalLink}>Content admin</Button></a>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Students" value={data.students} />
        <StatCard icon={ClipboardCheck} tone="green" label="Quizzes taken" value={data.quizzes_taken} />
        <StatCard icon={ClipboardCheck} tone="amber" label="Average quiz score" value={data.avg_quiz_score == null ? "—" : `${data.avg_quiz_score}%`} />
        <StatCard icon={Cpu} tone="blue" label="AI requests" value={data.ai_requests} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Subjects (aggregate)</h2>
          <div className="space-y-3">{data.subjects.map((s) => (
            <div key={s.id} className="text-sm">
              <div className="flex justify-between"><span><b>{s.short}</b> {s.name}</span><span className="text-xs text-slate-500">{s.enrolled} enrolled · {s.active_learners} active · {s.topics} topics</span></div>
              <div className="mt-1 flex items-center gap-2"><div className="flex-1"><MasteryBar value={s.avg_mastery || 0} /></div><span className="w-14 text-right text-xs">{s.avg_mastery == null ? "no data" : `${s.avg_mastery}%`}</span></div>
            </div>
          ))}</div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Topics students find hardest</h2>
          {data.hardest_topics.length ? (
            <ul className="space-y-2 text-sm">{data.hardest_topics.map((h, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-navy-800"><span>{h.topic} <span className="text-xs text-slate-500">({h.subject})</span></span><span className="text-xs">avg <b>{h.avg_mastery}%</b> · {h.students} student(s)</span></li>
            ))}</ul>
          ) : <p className="text-sm text-slate-500">Appears once students have 3+ answers on a topic.</p>}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><BookPlus className="h-4 w-4" />Add a topic to a syllabus</h2>
          <form onSubmit={addTopic} className="grid gap-3 sm:grid-cols-2">
            <Field label="Subject" id="ts"><select id="ts" className="input" value={topic.subject} onChange={(e) => setTopic({ ...topic, subject: e.target.value })} required><option value="">Choose…</option>{subjects.data?.subjects.map((s) => <option key={s.id} value={s.id}>{s.short} · {s.name}</option>)}</select></Field>
            <Field label="Module number" id="tm"><input id="tm" type="number" min="1" max="8" className="input" value={topic.unit_number} onChange={(e) => setTopic({ ...topic, unit_number: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Topic name" id="tn"><input id="tn" className="input" value={topic.name} onChange={(e) => setTopic({ ...topic, name: e.target.value })} required /></Field></div>
            <div className="sm:col-span-2"><Field label="Scope / summary" id="tsu"><input id="tsu" className="input" value={topic.summary} onChange={(e) => setTopic({ ...topic, summary: e.target.value })} /></Field></div>
            <Field label="Importance (1-5)" id="ti"><input id="ti" type="number" min="1" max="5" className="input" value={topic.importance} onChange={(e) => setTopic({ ...topic, importance: e.target.value })} /></Field>
            <div className="flex items-end"><Button type="submit" loading={busy === "t"} className="w-full">Add topic</Button></div>
          </form>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><BookPlus className="h-4 w-4" />Create a subject</h2>
          <form onSubmit={addSubject} className="grid gap-3 sm:grid-cols-2">
            <Field label="Code" id="sc"><input id="sc" className="input" value={subj.code} onChange={(e) => setSubj({ ...subj, code: e.target.value })} required /></Field>
            <Field label="Short name" id="ss"><input id="ss" className="input" value={subj.short} onChange={(e) => setSubj({ ...subj, short: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Subject name" id="sn"><input id="sn" className="input" value={subj.name} onChange={(e) => setSubj({ ...subj, name: e.target.value })} required /></Field></div>
            <Field label="Semester" id="sse"><input id="sse" type="number" min="1" max="8" className="input" value={subj.semester} onChange={(e) => setSubj({ ...subj, semester: e.target.value })} /></Field>
            <Field label="Modules" id="smo"><input id="smo" type="number" min="1" max="8" className="input" value={subj.modules} onChange={(e) => setSubj({ ...subj, modules: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Button type="submit" loading={busy === "s"} className="w-full">Create subject</Button></div>
          </form>
          <p className="mt-3 text-xs text-slate-500">Rename modules, edit topics, prerequisites and upload syllabus files in Content admin.</p>
        </Card>
      </div>
    </div>
  );
}
