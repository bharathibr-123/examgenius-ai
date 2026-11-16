import { CheckCircle2, GraduationCap, Lightbulb, MinusCircle, Sparkles } from "lucide-react";
import { useState } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { AIBanner, Badge, Button, Card, ErrorBox, Field, Markdown, PageHeader, ProgressRing, SelectSubject } from "../components/ui";
import { api, fmtDateTime, useApi } from "../lib";
import { MicButton } from "../components/extras";
import { Genie } from "../components/art";

export default function Evaluator() {
  const subjects = useApi("/subjects/?mine=1");
  const history = useApi("/evaluate/");
  const status = useApi("/ai/status/");
  const [form, setForm] = useState({ question: "", marks: 5, answer: "", subject_id: null, topic_id: null });
  const detail = useApi(form.subject_id ? `/subjects/${form.subject_id}/` : null, [form.subject_id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [res, setRes] = useState(null);
  const words = form.answer.trim() ? form.answer.trim().split(/\s+/).length : 0;
  const target = { 2: "40-60", 5: "150-200", 10: "350-450" }[form.marks];

  const submit = async () => {
    setBusy(true);
    setError(null);
    try { setRes(await api("/evaluate/", { method: "POST", body: form })); history.reload(); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (e) { setError(e); } finally { setBusy(false); }
  };
  const rubric = res ? [
    { k: "Concepts", v: res.rubric.conceptual_correctness }, { k: "Keywords", v: res.rubric.keywords },
    { k: "Explanation", v: res.rubric.explanation_quality }, { k: "Structure", v: res.rubric.structure }, { k: "Relevance", v: res.rubric.relevance },
  ] : [];

  return (
    <div>
      <PageHeader icon={GraduationCap} art={["pencil", "book", "star"]} title="AI Answer Evaluator" subtitle="Practise university-style descriptive answers. Get estimated marks, strengths, missing points and a better model answer." />
      <AIBanner configured={status.data?.configured} />
      {res && (
        <Card className="mb-6 overflow-hidden">
          <div className="grid gap-6 p-6 md:grid-cols-[auto_1fr_1fr]">
            <div className="text-center"><ProgressRing value={(100 * res.estimated_marks) / res.max_marks} label={`${res.estimated_marks}/${res.max_marks}`} sub="estimated marks" size={130} />
              <Genie mood={res.estimated_marks / res.max_marks >= 0.7 ? "celebrate" : res.estimated_marks / res.max_marks >= 0.4 ? "happy" : "think"} size={64} className="mx-auto mt-2" /></div>
            <div className="h-56"><ResponsiveContainer><RadarChart data={rubric} outerRadius="72%"><PolarGrid /><PolarAngleAxis dataKey="k" tick={{ fontSize: 11 }} /><PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} /><Radar dataKey="v" stroke="#6d5cf6" fill="#6d5cf6" fillOpacity={0.35} /></RadarChart></ResponsiveContainer></div>
            <div className="space-y-3 text-sm">
              <div><div className="mb-1 font-semibold text-emerald-700 dark:text-emerald-300">Strengths</div>{res.strengths.map((s, i) => <div key={i} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{s}</div>)}</div>
              <div><div className="mb-1 font-semibold text-red-700 dark:text-red-300">Missing points</div>{res.missing_points.map((s, i) => <div key={i} className="flex gap-2"><MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />{s}</div>)}</div>
            </div>
          </div>
          <div className="grid gap-6 border-t border-slate-200 p-6 md:grid-cols-2 dark:border-navy-700">
            <div className="space-y-3 text-sm">
              <div><b>Keywords used:</b> <span className="inline-flex flex-wrap gap-1">{res.keywords_found.map((k) => <Badge key={k} className="bg-emerald-100 text-emerald-700">{k}</Badge>)}</span></div>
              <div><b>Keywords missing:</b> <span className="inline-flex flex-wrap gap-1">{res.keywords_missing.map((k) => <Badge key={k} className="bg-red-100 text-red-700">{k}</Badge>)}</span></div>
              <div><div className="mb-1 font-semibold">How to improve</div>{res.improvements.map((s, i) => <div key={i} className="flex gap-2"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />{s}</div>)}</div>
              {res.events?.map((e, i) => <div key={i} className="rounded-lg bg-brand-50 p-2 text-brand-900 dark:bg-brand-500/10 dark:text-brand-100">{e}</div>)}
              <p className="text-xs text-slate-500">{res.disclaimer}</p>
            </div>
            <div><div className="mb-2 font-semibold">A better answer</div><div className="max-h-96 overflow-y-auto rounded-xl bg-slate-50 p-4 dark:bg-navy-800/60"><Markdown>{res.model_answer}</Markdown></div></div>
          </div>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Subject (optional)" id="es"><SelectSubject id="es" allowAll subjects={subjects.data?.subjects} value={form.subject_id} onChange={(v) => setForm({ ...form, subject_id: v, topic_id: null })} /></Field>
            <Field label="Topic (optional - updates mastery)" id="et">
              <select id="et" className="input" value={form.topic_id || ""} disabled={!form.subject_id} onChange={(e) => setForm({ ...form, topic_id: e.target.value ? +e.target.value : null })}>
                <option value="">None</option>{detail.data?.units.flatMap((u) => u.topics).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Exam question" id="eq"><textarea id="eq" className="input min-h-[70px]" placeholder="e.g. Explain the structure of a utility-based agent with a neat diagram." value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} /></Field>
          <div>
            <span className="label">Marks</span>
            <div className="flex gap-2">{[2, 5, 10].map((m) => <button key={m} onClick={() => setForm({ ...form, marks: m })} className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 ${form.marks === m ? "gradient-brand text-white ring-transparent" : "ring-slate-300 dark:ring-navy-700"}`}>{m} marks</button>)}</div>
          </div>
          <Field label="Your answer" id="ea" hint={`${words} words · a ${form.marks}-mark answer is usually about ${target} words · 🎤 you can also dictate`}>
            <div className="flex items-start gap-2">
              <textarea id="ea" className="input min-h-[240px]" placeholder="Write your answer exactly as you would in the exam…" value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} />
              <MicButton onText={(t) => setForm((f) => ({ ...f, answer: (f.answer ? f.answer + " " : "") + t }))} />
            </div>
          </Field>
          <ErrorBox error={error} />
          <Button size="lg" className="w-full" icon={Sparkles} loading={busy} onClick={submit}>Evaluate my answer</Button>
        </Card>
        <Card className="p-6">
          <h2 className="mb-3 font-semibold">Recent evaluations</h2>
          {history.data?.evaluations.length ? (
            <ul className="divide-y divide-slate-100 text-sm dark:divide-navy-800">{history.data.evaluations.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5"><div className="min-w-0"><div className="truncate">{e.question}</div><div className="text-xs text-slate-500">{e.subject || "General"} · {fmtDateTime(e.created_at)}</div></div><b>{e.estimated}/{e.marks}</b></li>
            ))}</ul>
          ) : <p className="text-sm text-slate-500">Your evaluated answers appear here.</p>}
        </Card>
      </div>
    </div>
  );
}
