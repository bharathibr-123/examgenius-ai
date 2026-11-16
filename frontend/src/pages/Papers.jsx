import { ArrowLeft, Eye, EyeOff, FileQuestion, Printer, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AIBanner, Button, Card, ConfirmDialog, EmptyState, ErrorBox, Field, LoadingCards, PageHeader, SelectSubject } from "../components/ui";
import { api, fmtDateTime, useApi, useToast } from "../lib";

const LEVELS = { L1: "Remember", L2: "Understand", L3: "Apply", L4: "Analyse", L5: "Evaluate", L6: "Create" };

function Setup() {
  const nav = useNavigate();
  const subjects = useApi("/subjects/?mine=1");
  const list = useApi("/papers/");
  const status = useApi("/ai/status/");
  const [subjectId, setSubjectId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (!subjectId && subjects.data?.subjects?.length) setSubjectId(subjects.data.subjects[0].id); }, [subjects.data, subjectId]);
  const gen = async () => {
    setBusy(true);
    setError(null);
    try { const p = await api("/papers/", { method: "POST", body: { subject_id: subjectId } }); nav(`/papers/${p.id}`); }
    catch (e) { setError(e); setBusy(false); }
  };
  return (
    <div>
      <PageHeader icon={FileQuestion} title="Model Question Paper Generator" art={["cap", "pencil", "star"]}
        subtitle="Generate a full VTU-style semester-end paper (5 modules · 2 choices each · 100 marks) with Bloom's levels and examiner answer outlines. Download it as PDF and practise under exam conditions." />
      <AIBanner configured={status.data?.configured} />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card className="space-y-5 p-6">
          <Field label="Subject" id="ps"><SelectSubject id="ps" subjects={subjects.data?.subjects} value={subjectId} onChange={setSubjectId} /></Field>
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-navy-800/60 dark:text-slate-300">
            <b className="text-slate-800 dark:text-white">Paper format (VTU 2022 scheme):</b> Q1/Q2 from Module 1, Q3/Q4 from Module 2 … Q9/Q10 from Module 5.
            Each full question is 20 marks split into parts (a, b, c). Students answer one full question per module.
          </div>
          <ErrorBox error={error} />
          <Button size="lg" className="w-full" icon={Sparkles} loading={busy} disabled={!subjectId} onClick={gen}>Generate model paper</Button>
          {busy && <p className="text-center text-xs text-slate-500">Setting your question paper… (15-40 seconds)</p>}
        </Card>
        <Card className="p-6">
          <h2 className="mb-3 font-semibold">Your papers</h2>
          {list.data?.papers.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-navy-800">{list.data.papers.map((p) => (
              <li key={p.id}><Link to={`/papers/${p.id}`} className="flex items-center justify-between py-2.5 text-sm hover:opacity-80">
                <span><b>{p.code}</b> {p.subject}</span><span className="text-xs text-slate-500">{fmtDateTime(p.created_at)}</span></Link></li>
            ))}</ul>
          ) : <EmptyState icon={FileQuestion} title="No papers yet" text="Generate your first model paper - it's saved here for later." />}
        </Card>
      </div>
    </div>
  );
}

function Paper({ id }) {
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, error } = useApi(`/papers/${id}/`, [id]);
  const [key, setKey] = useState(false);
  const [del, setDel] = useState(false);
  if (loading) return <LoadingCards n={2} />;
  if (error) return <ErrorBox error={error} />;
  const remove = async () => { await api(`/papers/${id}/`, { method: "DELETE" }); toast.success("Paper deleted."); nav("/papers"); };
  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link to="/papers" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white"><ArrowLeft className="h-4 w-4" />All papers</Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={key ? EyeOff : Eye} onClick={() => setKey(!key)}>{key ? "Hide" : "Show"} answer outlines</Button>
          <Button icon={Printer} onClick={() => window.print()}>Download PDF / Print</Button>
          <Button variant="ghost" icon={Trash2} onClick={() => setDel(true)} aria-label="Delete paper" />
        </div>
      </div>
      <p className="no-print mb-4 text-xs text-slate-500">Tip: in the print dialog choose <b>"Save as PDF"</b> as the printer to download the paper.</p>
      <div className="print-area mx-auto max-w-4xl rounded-2xl border border-slate-300 bg-white p-8 font-serif text-[15px] leading-relaxed text-slate-900 shadow-lg sm:p-12">
        <div className="flex items-start justify-between gap-4 text-sm">
          <div className="font-sans text-xs text-slate-500">ExamGenius AI · Model paper</div>
          <div className="flex items-center gap-1 font-sans text-xs"><span className="mr-1 font-semibold">USN</span>{Array.from({ length: 10 }).map((_, i) => <span key={i} className="inline-block h-6 w-5 border border-slate-500" />)}</div>
        </div>
        <div className="mt-4 text-center">
          <div className="text-xs font-semibold tracking-widest">{data.code}</div>
          <div className="text-lg font-bold">Semester {data.semester} B.E. Degree Examination - Model Question Paper</div>
          <div className="text-xl font-bold uppercase">{data.subject}</div>
        </div>
        <div className="mt-3 flex justify-between border-y border-slate-400 py-1.5 text-sm font-semibold"><span>Time: {data.duration}</span><span>Max. Marks: {data.max_marks}</span></div>
        <p className="mt-2 text-sm"><b>Note:</b> 1. {data.note} 2. M: Marks, L: Bloom's level.</p>
        {data.modules.map((m) => (
          <section key={m.module} className="print-break mt-6">
            <div className="mb-2 text-center text-sm font-bold uppercase tracking-wider">Module - {m.module}</div>
            {m.questions.map((q, qi) => (
              <div key={q.number} className="print-break">
                {qi === 1 && <div className="my-2 text-center text-sm font-bold">OR</div>}
                <table className="w-full text-sm">
                  <tbody>
                    {q.parts.map((p, pi) => (
                      <tr key={p.part} className="align-top">
                        <td className="w-10 py-1 font-bold">{pi === 0 ? `Q${q.number}.` : ""}</td>
                        <td className="w-6 py-1">{p.part}.</td>
                        <td className="py-1 pr-3">
                          {p.text}
                          {key && p.answer_outline && <div className="mt-1 rounded-md bg-emerald-50 px-2 py-1 font-sans text-xs text-emerald-800">Answer outline: {p.answer_outline}</div>}
                        </td>
                        <td className="w-12 py-1 text-right font-sans text-xs font-semibold">{p.level}</td>
                        <td className="w-14 py-1 text-right font-sans text-xs font-semibold">{p.marks} M</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>
        ))}
        <div className="mt-8 border-t border-slate-300 pt-3 text-center font-sans text-[11px] text-slate-500">
          AI-generated practice paper - not an official VTU paper. Levels: {Object.entries(LEVELS).map(([k, v]) => `${k} ${v}`).join(" · ")}
        </div>
      </div>
      <ConfirmDialog open={del} onClose={() => setDel(false)} onConfirm={remove} danger title="Delete this paper?" text="This model paper will be removed." confirmLabel="Delete" />
    </div>
  );
}

export default function Papers() {
  const { id } = useParams();
  return id ? <Paper id={id} /> : <Setup />;
}
