import { ArrowLeft, BookOpen, Download, ClipboardCheck, FileText, FileUp, MessageSquare, Search, Send, Sparkles, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AIBanner, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorBox, Field, LoadingCards, Markdown, Modal, PageHeader, SelectSubject, Tabs } from "../components/ui";
import { api, fmtDateTime, useApi, useToast } from "../lib";
import { Flashcards } from "./Subjects";

export function Notes() {
  const docs = useApi("/documents/");
  const subjects = useApi("/subjects/?mine=1");
  const status = useApi("/ai/status/");
  const nav = useNavigate();
  const toast = useToast();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [subjectId, setSubjectId] = useState(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [drag, setDrag] = useState(false);

  const pick = (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) return toast.error("Only PDF files are supported.");
    if (f.size > 10 * 1024 * 1024) return toast.error("This PDF is larger than 10 MB.");
    setFile(f);
    setTitle(f.name.replace(/\.pdf$/i, ""));
  };
  const upload = async () => {
    if (!file || !subjectId) return toast.error("Choose a PDF and its subject.");
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("subject_id", subjectId);
    form.append("title", title);
    try {
      const d = await api("/documents/", { method: "POST", form });
      toast.success(`Uploaded ${d.pages} pages.`);
      nav(`/notes/${d.id}`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader icon={FileText} art={["book", "pencil", "bulb"]} title="Smart PDF Notes" subtitle="Upload your class notes or textbook chapters. Get summaries, flashcards and exam questions, and ask questions answered with page citations." />
      <AIBanner configured={status.data?.configured} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Card className="space-y-4 p-6">
          <h2 className="font-semibold">Upload a PDF</h2>
          <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${drag ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-slate-300 hover:border-brand-400 dark:border-navy-700"}`}>
            <FileUp className="mx-auto h-10 w-10 text-brand-500" />
            <p className="mt-2 font-semibold">{file ? file.name : "Drop a PDF here or click to browse"}</p>
            <p className="text-xs text-slate-500">PDF only · max 10 MB · max 60 pages · text-based PDFs (not scanned images)</p>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files[0])} />
          </div>
          <Field label="Title" id="title"><input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Subject" id="dsubj"><SelectSubject id="dsubj" subjects={subjects.data?.subjects} value={subjectId} onChange={setSubjectId} /></Field>
          <ErrorBox error={error} />
          <Button className="w-full" icon={FileUp} loading={busy} onClick={upload} disabled={!file || !subjectId}>Upload and process</Button>
          <p className="text-xs text-slate-500">Your PDFs are private to your account and can be deleted at any time.</p>
        </Card>
        <Card className="p-6">
          <h2 className="mb-3 font-semibold">Your documents</h2>
          {docs.loading ? <div className="skeleton h-40" /> : docs.data?.documents.length ? (
            <ul className="space-y-2">
              {docs.data.documents.map((d) => (
                <li key={d.id}>
                  <Link to={`/notes/${d.id}`} className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-slate-200 transition hover:bg-slate-50 dark:ring-navy-700 dark:hover:bg-navy-800">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-red-50 text-red-600 dark:bg-red-500/15"><FileText className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1"><div className="truncate font-medium">{d.title}</div><div className="text-xs text-slate-500">{d.subject} · {d.pages} pages · {fmtDateTime(d.created_at)}</div></div>
                    {d.has_summary && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Summarised</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={BookOpen} title="No documents yet" text="Prefer not to upload? Open any topic in My Subjects and generate AI notes instantly." action={<Link to="/subjects"><Button variant="secondary">Browse topics</Button></Link>} />}
        </Card>
      </div>
    </div>
  );
}

function SummaryView({ s }) {
  return (
    <div className="space-y-5 text-sm">
      <Markdown>{s.summary}</Markdown>
      {s.key_points?.length > 0 && <section><h4 className="mb-2 font-semibold">Key points</h4><ul className="list-disc space-y-1 pl-5">{s.key_points.map((k, i) => <li key={i}>{k}</li>)}</ul></section>}
      {s.definitions?.length > 0 && <section><h4 className="mb-2 font-semibold">Important definitions</h4><dl className="space-y-2">{s.definitions.map((d, i) => <div key={i} className="rounded-lg bg-slate-50 p-3 dark:bg-navy-800"><dt className="font-semibold">{d.term}</dt><dd className="text-slate-600 dark:text-slate-300">{d.meaning}</dd></div>)}</dl></section>}
      {s.formulas?.filter(Boolean).length > 0 && <section><h4 className="mb-2 font-semibold">Formulas</h4><ul className="space-y-1">{s.formulas.filter(Boolean).map((f, i) => <li key={i} className="rounded bg-slate-100 px-2 py-1 font-mono text-[13px] dark:bg-navy-800">{f}</li>)}</ul></section>}
      {s.keywords?.length > 0 && <section><h4 className="mb-2 font-semibold">Keywords</h4><div className="flex flex-wrap gap-1.5">{s.keywords.map((k) => <Badge key={k} className="bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">{k}</Badge>)}</div></section>}
      {s.exam_questions?.length > 0 && <section><h4 className="mb-2 font-semibold">Important exam questions</h4><ol className="list-decimal space-y-1 pl-5">{s.exam_questions.map((q, i) => <li key={i}>{q.question} <span className="text-xs text-slate-500">[{q.marks} marks]</span></li>)}</ol></section>}
      {s.flashcards?.length > 0 && <section><h4 className="mb-2 font-semibold">Flashcards</h4><Flashcards cards={s.flashcards} /></section>}
    </div>
  );
}

export function NoteDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, error, setData, reload } = useApi(`/documents/${id}/`, [id]);
  const [tab, setTab] = useState("ask");
  const [style, setStyle] = useState("short");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState(false);
  const [err, setErr] = useState(null);
  const [page, setPage] = useState(null);
  const [del, setDel] = useState(false);
  const [quizBusy, setQuizBusy] = useState(false);

  if (loading && !data) return <LoadingCards n={2} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const summarise = async () => {
    setBusy(true);
    setErr(null);
    try { setData(await api(`/documents/${id}/summary/`, { method: "POST", body: { style } })); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const ask = async (e) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setAsking(true);
    setErr(null);
    const question = q;
    setQ("");
    try {
      const r = await api(`/documents/${id}/ask/`, { method: "POST", body: { question } });
      setData((d) => ({ ...d, qa: [...d.qa, { role: "user", content: question }, { role: "assistant", content: r.answer, meta: r }] }));
    } catch (e2) { setErr(e2); setQ(question); } finally { setAsking(false); }
  };
  const openPage = async (p) => setPage(await api(`/documents/${id}/page/${p}/`));
  const quiz = async () => {
    setQuizBusy(true);
    try { const r = await api(`/documents/${id}/quiz/`, { method: "POST", body: { count: 5 } }); nav(`/quiz/${r.id}`); }
    catch (e) { toast.error(e.message); } finally { setQuizBusy(false); }
  };
  const remove = async () => { await api(`/documents/${id}/`, { method: "DELETE" }); toast.success("Document deleted."); nav("/notes"); };
  const summary = data.summary?.[style];

  return (
    <div>
      <Link to="/notes" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white"><ArrowLeft className="h-4 w-4" />All documents</Link>
      <PageHeader icon={FileText} title={data.title} subtitle={`${data.subject} · ${data.pages} pages · ${data.retrieval === "embedding" ? "semantic search (AI embeddings)" : "keyword search"}`}
        actions={<>
          <Button variant="secondary" icon={ClipboardCheck} loading={quizBusy} onClick={quiz}>Quiz me on this PDF</Button>
          <Button variant="ghost" icon={Trash2} onClick={() => setDel(true)}>Delete</Button>
        </>} />
      {data.status !== "ready" && <ErrorBox error={{ message: "No text could be extracted from this PDF - it may be a scanned image. Try a text-based PDF." }} />}
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card className="p-5">
          <div className="mb-4"><Tabs value={tab} onChange={setTab} tabs={[{ value: "ask", label: "Ask your notes" }, { value: "summary", label: "Summary & flashcards" }]} /></div>
          <ErrorBox error={err} />
          {tab === "ask" ? (
            <div>
              <div className="mb-4 max-h-[460px] space-y-4 overflow-y-auto">
                {!data.qa.length && <EmptyState icon={MessageSquare} title="Ask anything about this PDF" text="Answers use only your document and show the page numbers they came from. If the notes don't cover it, you'll be told." />}
                {data.qa.map((m, i) => m.role === "user" ? (
                  <div key={i} className="ml-auto max-w-[85%] rounded-2xl bg-brand-600 px-4 py-2.5 text-sm text-white">{m.content}</div>
                ) : (
                  <div key={i} className="max-w-[95%] rounded-2xl bg-slate-50 px-4 py-3 dark:bg-navy-800/60">
                    {m.meta?.found === false && <Badge className="mb-2 bg-amber-100 text-amber-800">Not found in your notes</Badge>}
                    <Markdown>{m.content}</Markdown>
                    {m.meta?.citations?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {m.meta.citations.map((c, k) => (
                          <button key={k} onClick={() => openPage(c.page)} title={c.excerpt} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 dark:bg-navy-900 dark:text-brand-200 dark:ring-brand-500/30">
                            <Search className="h-3 w-3" />{c.file}, p. {c.page}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {asking && <div className="skeleton h-16 w-2/3" />}
              </div>
              <form onSubmit={ask} className="flex gap-2">
                <input className="input" placeholder="e.g. What is a heuristic function?" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Question about the document" />
                <Button type="submit" icon={Send} loading={asking} disabled={!q.trim()}>Ask</Button>
              </form>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center justify-between gap-2">
                <Tabs value={style} onChange={setStyle} tabs={[{ value: "short", label: "Short revision" }, { value: "detailed", label: "Detailed" }]} />
                {summary && <div className="flex gap-1"><Button size="sm" variant="soft" icon={Download} onClick={() => nav(`/print/doc/${id}?style=${style}`)}>PDF</Button><Button size="sm" variant="ghost" icon={Sparkles} loading={busy} onClick={summarise}>Regenerate</Button></div>}
              </div>
              {summary ? <SummaryView s={summary} /> : (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-navy-700">
                  <p className="text-sm text-slate-600 dark:text-slate-400">Create {style} notes, definitions, keywords, exam questions and flashcards from this PDF.</p>
                  <Button className="mt-4" icon={Sparkles} loading={busy} onClick={summarise}>Generate summary</Button>
                </div>
              )}
            </div>
          )}
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold dark:border-navy-700">PDF preview</div>
          <iframe title="PDF preview" src={data.url} className="h-[640px] w-full bg-slate-100 dark:bg-navy-950" />
        </Card>
      </div>
      <Modal open={!!page} onClose={() => setPage(null)} title={`Page ${page?.page} of ${page?.pages} - extracted text`} wide>
        <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-sans text-sm dark:bg-navy-800">{page?.text || "(no text on this page)"}</pre>
      </Modal>
      <ConfirmDialog open={del} onClose={() => setDel(false)} onConfirm={remove} danger title="Delete this document?" text="The PDF, its extracted text and its Q&A history will be permanently deleted." confirmLabel="Delete" />
    </div>
  );
}
