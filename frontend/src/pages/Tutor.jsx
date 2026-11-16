import { Bot, Loader2, MessageSquarePlus, Send, Sparkles, Target, Trash2, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AIBanner, Badge, Button, Card, EmptyState, ErrorBox, Markdown, Modal } from "../components/ui";
import { api, fmtDateTime, useApi, useAuth, useToast } from "../lib";
import { QuizReview, QuizRunner } from "./Quiz";
import { MicButton, SpeakButton } from "../components/extras";

const MODES = [["beginner", "Beginner"], ["simple", "Simple"], ["detailed", "Detailed"], ["exam", "Exam prep"], ["interview", "Interview"]];
const SUGGEST = ["Explain A* search with an example", "Difference between BFS and DFS - 5 marks", "What is a rational agent?", "Explain PEAS with an example"];

export default function Tutor() {
  const { id } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const { user } = useAuth();
  const list = useApi("/conversations/");
  const subjects = useApi("/subjects/?mine=1");
  const status = useApi("/ai/status/");
  const [conv, setConv] = useState(null);
  const [text, setText] = useState(loc.state?.prefill || "");
  const [marks, setMarks] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [check, setCheck] = useState(null);
  const [checking, setChecking] = useState(false);
  const endRef = useRef(null);
  const subjectDetail = useApi(conv?.subject_id ? `/subjects/${conv.subject_id}/` : null, [conv?.subject_id]);

  useEffect(() => {
    setError(null);
    if (!id) { setConv(null); return; }
    api(`/conversations/${id}/`)
      // never let a slower, older response overwrite messages that are already on screen
      .then((c) => setConv((prev) => (prev && prev.id === c.id && (prev.messages?.length || 0) > c.messages.length ? prev : c)))
      .catch((e) => { toast.error(e.message); nav("/tutor"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conv?.messages?.length, sending]);

  const newChat = async (extra = {}) => {
    const c = await api("/conversations/", { method: "POST", body: { mode: user?.profile?.default_mode, ...extra } });
    list.reload();
    nav(`/tutor/${c.id}`);
    return c;
  };
  const patch = async (body) => {
    const c = await api(`/conversations/${conv.id}/`, { method: "PATCH", body });
    setConv(c);
  };
  const send = async (content) => {
    const msg = (content ?? text).trim();
    if (!msg || sending) return;
    let c = conv;
    if (!c) c = await newChat();
    setText("");
    setError(null);
    setSending(true);
    setConv((x) => ({ ...(x || c), messages: [...((x || c).messages || []), { id: "tmp", role: "user", content: msg, meta: { marks } }] }));
    try {
      await api(`/conversations/${c.id}/messages/`, { method: "POST", body: { content: msg, marks, mode: (conv || c).mode } });
      setConv(await api(`/conversations/${c.id}/`));
      list.reload();
    } catch (e) {
      setError(e);
      setConv((x) => (x ? { ...x, messages: (x.messages || []).filter((m) => m.id !== "tmp") } : x));
      setText(msg);
    } finally {
      setSending(false);
    }
  };
  const del = async (cid) => {
    await api(`/conversations/${cid}/`, { method: "DELETE" });
    list.reload();
    if (String(cid) === String(id)) nav("/tutor");
    toast.success("Conversation deleted.");
  };
  const startCheck = async () => {
    setChecking(true);
    try {
      setCheck(await api(`/conversations/${conv.id}/check/`, { method: "POST" }));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setChecking(false);
    }
  };

  const msgs = conv?.messages || [];
  return (
    <div className="-mt-2">
      <AIBanner configured={status.data?.configured} />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="hidden h-[calc(100vh-150px)] flex-col p-3 lg:flex">
          <Button icon={MessageSquarePlus} onClick={() => newChat()} className="w-full">New conversation</Button>
          <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
            {list.data?.conversations.map((c) => (
              <div key={c.id} className={`group flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${String(c.id) === String(id) ? "bg-brand-50 dark:bg-brand-500/15" : "hover:bg-slate-100 dark:hover:bg-navy-800"}`}>
                <button className="min-w-0 flex-1 text-left" onClick={() => nav(`/tutor/${c.id}`)}>
                  <div className="truncate font-medium">{c.title}</div>
                  <div className="text-[11px] text-slate-500">{c.subject || "General"} · {fmtDateTime(c.updated_at)}</div>
                </button>
                <button onClick={() => del(c.id)} className="opacity-0 transition group-hover:opacity-100" aria-label="Delete conversation"><Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" /></button>
              </div>
            ))}
            {list.data && !list.data.conversations.length && <p className="px-3 py-6 text-center text-xs text-slate-500">Your conversations are saved here.</p>}
          </div>
        </Card>

        <Card className="flex h-[calc(100vh-150px)] min-h-[520px] flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3 dark:border-navy-700">
            <select className="input w-auto py-1.5 text-xs" aria-label="Subject" value={conv?.subject_id || ""} disabled={!conv}
              onChange={(e) => patch({ subject_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">General (no subject)</option>
              {subjects.data?.subjects.map((s) => <option key={s.id} value={s.id}>{s.short}</option>)}
            </select>
            {conv?.subject_id && (
              <select className="input w-auto max-w-[220px] py-1.5 text-xs" aria-label="Topic" value={conv?.topic_id || ""} onChange={(e) => patch({ topic_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Any topic</option>
                {subjectDetail.data?.units.flatMap((u) => u.topics).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <select className="input w-auto py-1.5 text-xs" aria-label="Explanation mode" value={conv?.mode || user?.profile?.default_mode || "exam"} disabled={!conv}
              onChange={(e) => patch({ mode: e.target.value })}>
              {MODES.map(([v, l]) => <option key={v} value={v}>{l} mode</option>)}
            </select>
            <div className="ml-auto">
              <Button size="sm" variant="soft" icon={Target} loading={checking} disabled={!msgs.length || sending} onClick={startCheck} title="Turn this doubt into a 2-question check that updates your mastery">
                Check my understanding
              </Button>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
            {!msgs.length && (
              <EmptyState icon={Bot} mood="wave" title="Hi! I'm Genie, your AI tutor" text="Type or 🎤 speak your doubt. Answers adapt to your semester, learning style, subject and mode - ask for 2, 5 or 10-mark answers, diagrams or examples."
                action={<div className="flex flex-wrap justify-center gap-2">{SUGGEST.map((s) => <button key={s} onClick={() => send(s)} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium hover:bg-brand-50 hover:text-brand-700 dark:bg-navy-800">{s}</button>)}</div>} />
            )}
            {msgs.map((m) => (
              <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${m.role === "user" ? "bg-slate-200 dark:bg-navy-800" : "gradient-brand text-white"}`}>
                  {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-brand-600 text-white" : "bg-slate-50 dark:bg-navy-800/60"}`}>
                  {m.role === "user" ? <p className="whitespace-pre-wrap text-[15px]">{m.content}</p> : <Markdown>{m.content}</Markdown>}
                  {m.role === "assistant" && <div className="mt-1 -mb-1 flex justify-end"><SpeakButton text={m.content} /></div>}
                  {m.meta?.marks && <Badge className="mt-2 bg-white/20">{m.meta.marks}-mark answer</Badge>}
                  {m.meta?.simplified && <Badge className="mt-2 bg-amber-100 text-amber-800">Simplified - based on your recent answers</Badge>}
                </div>
              </div>
            ))}
            {sending && <div className="flex items-center gap-3 text-sm text-slate-500"><div className="gradient-brand grid h-8 w-8 place-items-center rounded-full text-white"><Loader2 className="h-4 w-4 animate-spin" /></div>Thinking…</div>}
            <ErrorBox error={error} />
            <div ref={endRef} />
          </div>

          <div className="border-t border-slate-200 p-3 dark:border-navy-700">
            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-500">Answer format:</span>
              {[null, 2, 5, 10].map((m) => (
                <button key={String(m)} onClick={() => setMarks(m)} className={`rounded-full px-2.5 py-1 font-semibold ring-1 ${marks === m ? "bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900" : "ring-slate-300 dark:ring-navy-700"}`}>
                  {m ? `${m}-mark` : "Normal"}
                </button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2">
              <textarea rows={1} className="input max-h-40 min-h-[46px] resize-none" placeholder="Ask a doubt, request an exam answer or an example…" value={text}
                onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} aria-label="Message" />
              <MicButton onText={(t) => setText((x) => (x ? x + " " : "") + t)} />
              <Button type="submit" loading={sending} icon={Send} disabled={!text.trim()} aria-label="Send">Send</Button>
            </form>
          </div>
        </Card>
      </div>

      <Modal open={!!check} onClose={() => setCheck(null)} title="Doubt → Mastery check" wide>
        {check && (check.submitted_at ? (
          <><QuizReview quiz={check} compact /><div className="mt-4 flex justify-end"><Button icon={Sparkles} onClick={() => setCheck(null)}>Back to chat</Button></div></>
        ) : <QuizRunner quiz={check} compact onSubmitted={setCheck} />)}
      </Modal>
    </div>
  );
}
