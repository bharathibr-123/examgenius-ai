import { Bot, CheckCircle2, Mic, Send, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AIBanner, Badge, Button, Card, EmptyState, ErrorBox, Field, PageHeader, ProgressRing, SelectSubject } from "../components/ui";
import { api, fmtDateTime, useApi, useToast } from "../lib";
import { TopicPicker } from "./Quiz";
import { MicButton, SpeakButton, speak, fireConfetti } from "../components/extras";
import { Genie } from "../components/art";

function Setup() {
  const nav = useNavigate();
  const subjects = useApi("/subjects/?mine=1");
  const sessions = useApi("/viva/");
  const status = useApi("/ai/status/");
  const [subjectId, setSubjectId] = useState(null);
  const [topicIds, setTopicIds] = useState([]);
  const [n, setN] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (!subjectId && subjects.data?.subjects?.length) setSubjectId(subjects.data.subjects[0].id); }, [subjects.data, subjectId]);
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const v = await api("/viva/", { method: "POST", body: { subject_id: subjectId, topic_ids: topicIds, questions: n } });
      nav(`/viva/${v.id}`);
    } catch (e) { setError(e); setBusy(false); }
  };
  return (
    <div>
      <PageHeader icon={Mic} title="AI Viva Examiner" art={["bulb", "cap", "star"]} subtitle="Practise oral exams - type or speak. The examiner asks one question at a time (it can read them aloud), scores each answer out of 10 and adapts the next question." />
      <AIBanner configured={status.data?.configured} />
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card className="space-y-5 p-6">
          <Field label="Subject" id="vs"><SelectSubject id="vs" subjects={subjects.data?.subjects} value={subjectId} onChange={(v) => { setSubjectId(v); setTopicIds([]); }} /></Field>
          <div><span className="label">Topics (optional - leave empty for the most important topics)</span><TopicPicker subjectId={subjectId} value={topicIds} onChange={setTopicIds} /></div>
          <Field label="Number of questions" id="vn"><select id="vn" className="input" value={n} onChange={(e) => setN(+e.target.value)}>{[3, 4, 5, 6, 8].map((x) => <option key={x}>{x}</option>)}</select></Field>
          <ErrorBox error={error} />
          <Button size="lg" className="w-full" icon={Mic} loading={busy} disabled={!subjectId} onClick={start}>Start viva</Button>
          <p className="text-xs text-slate-500">Typed answers in this version. Each score updates your topic mastery.</p>
        </Card>
        <Card className="p-6">
          <h2 className="mb-3 font-semibold">Previous vivas</h2>
          {sessions.data?.sessions.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-navy-800">{sessions.data.sessions.map((s) => (
              <li key={s.id}><Link to={`/viva/${s.id}`} className="flex justify-between py-2.5 text-sm hover:opacity-80"><span>{s.title} · {fmtDateTime(s.created_at)}</span><b>{s.submitted_at ? `${Math.round(s.percent)}%` : "in progress"}</b></Link></li>
            ))}</ul>
          ) : <EmptyState icon={Mic} title="No vivas yet" />}
        </Card>
      </div>
    </div>
  );
}

function Session({ id }) {
  const toast = useToast();
  const { data, setData, loading, error, reload } = useApi(`/viva/${id}/`, [id]);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [data?.turns?.length, busy]);
  const lastQ = data?.turns?.length ? data.turns[data.turns.length - 1] : null;
  useEffect(() => { if (voice && lastQ && lastQ.answer == null) speak(lastQ.question); }, [voice, lastQ?.question_id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (data?.finished && data.max_score && data.score / data.max_score >= 0.7) fireConfetti(); }, [data?.finished]); // eslint-disable-line react-hooks/exhaustive-deps
  if (loading && !data) return <div className="skeleton h-96" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const send = async (e) => {
    e.preventDefault();
    if (!answer.trim()) return;
    setBusy(true);
    try { setData(await api(`/viva/${id}/`, { method: "POST", body: { answer } })); setAnswer(""); }
    catch (e2) { toast.error(e2.message); } finally { setBusy(false); }
  };
  const answered = data.turns.filter((t) => t.answer != null).length;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Viva · {data.subject}</div><h1 className="text-xl font-bold">Question {Math.min(answered + 1, data.total)} of {data.total}</h1></div>
        <div className="flex gap-2">
          {window.speechSynthesis && <Button variant={voice ? "primary" : "secondary"} size="sm" onClick={() => { setVoice(!voice); if (voice) window.speechSynthesis.cancel(); }}>{voice ? "🔊 Voice mode on" : "🔈 Voice mode"}</Button>}
          <Link to="/viva"><Button variant="ghost" size="sm">All vivas</Button></Link>
        </div>
      </div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-800"><div className="gradient-brand h-full transition-all" style={{ width: `${(answered / data.total) * 100}%` }} /></div>
      <Card className="space-y-5 p-5">
        {data.turns.map((t, i) => (
          <div key={t.question_id} className="space-y-3">
            <div className="flex gap-3"><div className="gradient-brand grid h-8 w-8 shrink-0 place-items-center rounded-full text-white"><Bot className="h-4 w-4" /></div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-navy-800/60"><div className="mb-1 text-xs text-slate-500">Q{i + 1} · {t.topic}</div><div className="font-medium">{t.question}</div><div className="-mb-1 mt-1 flex justify-end"><SpeakButton text={t.question} /></div></div></div>
            {t.answer != null && (
              <>
                <div className="flex flex-row-reverse gap-3"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 dark:bg-navy-800"><User className="h-4 w-4" /></div>
                  <div className="max-w-[85%] rounded-2xl bg-brand-600 px-4 py-3 text-sm text-white">{t.answer}</div></div>
                <div className="ml-11 rounded-xl border border-slate-200 p-3 text-sm dark:border-navy-700">
                  <Badge className={t.score >= 7 ? "bg-emerald-100 text-emerald-700" : t.score >= 5 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700"}>{t.score}/10</Badge>
                  <p className="mt-1.5">{t.feedback}</p>
                  {t.ideal_answer && <p className="mt-1.5 text-slate-600 dark:text-slate-300"><b>Ideal answer:</b> {t.ideal_answer}</p>}
                </div>
              </>
            )}
          </div>
        ))}
        {busy && <div className="skeleton ml-11 h-14 w-2/3" />}
        <div ref={endRef} />
        {!data.finished ? (
          <form onSubmit={send} className="flex items-end gap-2 border-t border-slate-200 pt-4 dark:border-navy-700">
            <textarea className="input min-h-[80px]" placeholder="Type or 🎤 speak your answer as you would in the viva…" value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label="Your answer" />
            <MicButton onText={(t) => setAnswer((x) => (x ? x + " " : "") + t)} />
            <Button type="submit" icon={Send} loading={busy} disabled={!answer.trim()}>Answer</Button>
          </form>
        ) : (
          <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-blue-50 p-5 dark:from-brand-500/10 dark:to-blue-500/10">
            <div className="flex flex-wrap items-center gap-5">
              <Genie mood={data.max_score && data.score / data.max_score >= 0.6 ? "celebrate" : "cheer"} size={84} />
              <ProgressRing value={data.max_score ? (100 * data.score) / data.max_score : 0} size={100} sub="viva score" />
              <div className="flex-1">
                <h3 className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-emerald-500" />Viva complete - {data.score}/{data.max_score}</h3>
                <p className="mt-1 text-sm">{data.summary?.overall}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
              <div><b>Strengths</b><ul className="mt-1 list-disc pl-5">{data.summary?.strengths?.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
              <div><b>Improve</b><ul className="mt-1 list-disc pl-5">{data.summary?.improve?.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function Viva() {
  const { id } = useParams();
  return id ? <Session id={id} /> : <Setup />;
}
