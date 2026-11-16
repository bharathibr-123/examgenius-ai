import { ArrowLeft, Printer } from "lucide-react";
import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Genie } from "../components/art";
import { useApi } from "../lib";

/* Printable revision pack (topic notes or PDF summary) -> "Save as PDF" in the print dialog. */
export default function PrintPack() {
  const { kind, id } = useParams();
  const [sp] = useSearchParams();
  const style = sp.get("style") || "short";
  const { data, loading, error } = useApi(kind === "topic" ? `/topics/${id}/notes/?style=${style}` : `/documents/${id}/`, [kind, id, style]);
  const n = data ? (kind === "topic" ? data.notes : data.summary?.[style]) : null;
  const title = data ? (kind === "topic" ? data.topic : data.title) : "";
  useEffect(() => { if (n) { const t = setTimeout(() => window.print(), 600); return () => clearTimeout(t); } }, [n]);
  if (loading) return <p className="p-10 text-center">Preparing your revision pack…</p>;
  if (error || !n) return <p className="p-10 text-center">No notes found. Generate the notes first, then download.</p>;
  const overview = n.overview || n.summary;
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="no-print sticky top-0 flex items-center justify-between gap-2 border-b bg-white/90 px-6 py-3 backdrop-blur">
        <button onClick={() => window.history.back()} className="inline-flex items-center gap-1 text-sm font-semibold"><ArrowLeft className="h-4 w-4" />Back</button>
        <span className="text-xs text-slate-500">Choose "Save as PDF" in the print dialog to download</span>
        <button onClick={() => window.print()} className="gradient-brand inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"><Printer className="h-4 w-4" />Print / Save PDF</button>
      </div>
      <article className="print-area mx-auto max-w-3xl p-8 text-[14px] leading-relaxed">
        <header className="flex items-center gap-4 border-b-2 border-brand-500 pb-4">
          <Genie mood="happy" size={64} />
          <div><div className="text-xs font-bold uppercase tracking-widest text-brand-600">ExamGenius AI · Revision pack</div><h1 className="text-2xl font-extrabold">{title}</h1>
            <div className="text-xs text-slate-500">{style === "short" ? "Short revision notes" : "Detailed notes"} · {new Date().toLocaleDateString("en-IN")}</div></div>
        </header>
        <p className="mt-4 text-[15px]">{overview}</p>
        {n.key_points?.length > 0 && <section className="print-break mt-5"><h2 className="mb-2 text-lg font-bold">Key points</h2><ul className="list-disc space-y-1 pl-5">{n.key_points.map((k, i) => <li key={i}>{k}</li>)}</ul></section>}
        {n.definitions?.length > 0 && <section className="print-break mt-5"><h2 className="mb-2 text-lg font-bold">Definitions</h2>{n.definitions.map((d, i) => <p key={i} className="mb-1.5"><b>{d.term}:</b> {d.meaning}</p>)}</section>}
        {n.formulas?.filter(Boolean).length > 0 && <section className="print-break mt-5"><h2 className="mb-2 text-lg font-bold">Formulas</h2>{n.formulas.filter(Boolean).map((f, i) => <p key={i} className="font-mono text-[13px]">{f}</p>)}</section>}
        {n.example && <section className="print-break mt-5"><h2 className="mb-2 text-lg font-bold">Worked example</h2><p className="whitespace-pre-wrap">{n.example}</p></section>}
        {n.keywords?.length > 0 && <section className="print-break mt-5"><h2 className="mb-2 text-lg font-bold">Keywords</h2><p>{n.keywords.join(" · ")}</p></section>}
        {n.exam_questions?.length > 0 && <section className="print-break mt-5"><h2 className="mb-2 text-lg font-bold">Important exam questions</h2><ol className="list-decimal space-y-1 pl-5">{n.exam_questions.map((q, i) => <li key={i}>{q.question} <b>[{q.marks}M]</b></li>)}</ol></section>}
        {n.common_mistakes?.length > 0 && <section className="print-break mt-5"><h2 className="mb-2 text-lg font-bold">Common mistakes</h2><ul className="list-disc pl-5">{n.common_mistakes.map((k, i) => <li key={i}>{k}</li>)}</ul></section>}
        {n.flashcards?.length > 0 && (
          <section className="mt-6"><h2 className="mb-2 text-lg font-bold">Flashcards (cut along the lines)</h2>
            <div className="grid grid-cols-2 gap-0">{n.flashcards.map((c, i) => (
              <div key={i} className="print-break border border-dashed border-slate-400 p-3"><div className="text-[11px] font-bold uppercase text-brand-600">Q</div><div>{c.front}</div><div className="mt-2 text-[11px] font-bold uppercase text-emerald-600">A</div><div>{c.back}</div></div>
            ))}</div>
          </section>
        )}
        <footer className="mt-8 border-t pt-3 text-center text-[11px] text-slate-500">Generated with ExamGenius AI - verify important facts with your textbook.</footer>
      </article>
    </div>
  );
}
