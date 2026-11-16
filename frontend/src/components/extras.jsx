import { Command, CornerDownLeft, Hourglass, Mic, MicOff, Pause, Play, RotateCcw, Search, Square, Volume2, VolumeX, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, useToast } from "../lib";
import { Genie } from "./art";
import { NAV } from "./AppLayout";

/* ======================================================================= Voice (browser built-in, free) */
const Recognition = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

export function useDictation(onText) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const supported = !!Recognition;
  const start = useCallback(() => {
    if (!Recognition) return;
    const rec = new Recognition();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => onText(Array.from(e.results).map((r) => r[0].transcript).join(" "));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }, [onText]);
  const stop = useCallback(() => { recRef.current?.stop(); setListening(false); }, []);
  return { supported, listening, start, stop };
}

export function MicButton({ onText, className = "" }) {
  const toast = useToast();
  const { supported, listening, start, stop } = useDictation(onText);
  if (!supported) return null;
  return (
    <button type="button" onClick={() => { if (listening) stop(); else { start(); toast.info("Listening… speak now"); } }}
      title={listening ? "Stop listening" : "Speak your question"} aria-label={listening ? "Stop voice input" : "Voice input"}
      className={`relative grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl transition ${listening ? "bg-red-500 text-white" : "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200"} ${className}`}>
      {listening && <span className="absolute inset-0 animate-ping rounded-xl bg-red-400/50" />}
      {listening ? <MicOff className="relative h-5 w-5" /> : <Mic className="h-5 w-5" />}
    </button>
  );
}

function cleanForSpeech(md) {
  return md.replace(/```[\s\S]*?```/g, " ").replace(/[#*_>`|]/g, " ").replace(/\[(.*?)\]\(.*?\)/g, "$1").replace(/\s+/g, " ").trim();
}
export function speak(text, onEnd) {
  if (!window.speechSynthesis) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(cleanForSpeech(text));
  u.lang = "en-IN";
  u.rate = 1;
  const v = window.speechSynthesis.getVoices().find((x) => /en[-_]IN/i.test(x.lang)) || window.speechSynthesis.getVoices().find((x) => /^en/i.test(x.lang));
  if (v) u.voice = v;
  u.onend = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.speak(u);
  return true;
}
export function SpeakButton({ text, className = "" }) {
  const [on, setOn] = useState(false);
  useEffect(() => () => { if (on) window.speechSynthesis?.cancel(); }, [on]);
  if (!window.speechSynthesis) return null;
  return (
    <button type="button" onClick={() => { if (on) { window.speechSynthesis.cancel(); setOn(false); } else { setOn(true); speak(text, () => setOn(false)); } }}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-white hover:text-brand-700 dark:hover:bg-navy-900 ${className}`}
      aria-label={on ? "Stop reading aloud" : "Read aloud"}>
      {on ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}{on ? "Stop" : "Listen"}
    </button>
  );
}

/* ======================================================================= Confetti (tiny canvas, no library) */
export function fireConfetti() {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas");
  c.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:200";
  document.body.appendChild(c);
  const ctx = c.getContext("2d");
  const W = (c.width = innerWidth), H = (c.height = innerHeight);
  const colors = ["#6d5cf6", "#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#fb7185", "#facc15"];
  const parts = Array.from({ length: 160 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.4, y: H * 0.35, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 16 - 4,
    s: Math.random() * 7 + 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: colors[(Math.random() * colors.length) | 0],
  }));
  let frame = 0;
  const tick = () => {
    ctx.clearRect(0, 0, W, H);
    parts.forEach((p) => {
      p.vy += 0.42; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
    });
    if (++frame < 160) requestAnimationFrame(tick); else c.remove();
  };
  tick();
}

/* ======================================================================= Focus timer (Pomodoro) */
const FocusCtx = createContext(null);
export const useFocus = () => useContext(FocusCtx);

export function FocusProvider({ children }) {
  const toast = useToast();
  const [session, setSession] = useState(null); // {label, task_id, total, left, running}
  const [open, setOpen] = useState(false);
  const endRef = useRef(null);

  const start = useCallback((opts = {}) => {
    const minutes = opts.minutes || 25;
    setSession({ label: opts.label || "Focus session", task_id: opts.task_id || null, total: minutes * 60, left: minutes * 60, running: true, onDone: opts.onDone });
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!session?.running) return;
    endRef.current = Date.now() + session.left * 1000;
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setSession((s) => (s ? { ...s, left } : s));
    }, 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.running]);

  const finish = useCallback(async (s, early) => {
    const minutes = Math.max(1, Math.round((s.total - s.left) / 60));
    try {
      await api("/focus/", { method: "POST", body: { minutes, task_id: s.task_id, label: s.label, complete_task: !early } });
      if (!early) { fireConfetti(); toast.success(`Focus session complete - ${minutes} min logged${s.task_id ? " and task ticked off" : ""}!`); }
      else toast.info(`${minutes} min logged.`);
      s.onDone?.();
    } catch (e) { toast.error(e.message); }
    setSession(null);
    setOpen(false);
  }, [toast]);

  useEffect(() => {
    if (session && session.running && session.left === 0) {
      try { new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=").play(); } catch { /* ignore */ }
      finish(session, false);
    }
  }, [session, finish]);

  const value = useMemo(() => ({ session, start, open: () => setOpen(true) }), [session, start]);
  const pct = session ? 100 * (1 - session.left / session.total) : 0;
  const mm = session ? String(Math.floor(session.left / 60)).padStart(2, "0") : "25";
  const ss = session ? String(session.left % 60).padStart(2, "0") : "00";

  return (
    <FocusCtx.Provider value={value}>
      {children}
      {session && !open && (
        <button onClick={() => setOpen(true)} className="fixed bottom-24 right-4 z-50 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 font-mono text-sm font-bold text-white shadow-xl lg:bottom-6 dark:bg-white dark:text-slate-900">
          <Hourglass className="h-4 w-4 animate-pulse" />{mm}:{ss}
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/70 p-4 backdrop-blur" onClick={() => setOpen(false)}>
          <div className="card relative w-full max-w-md animate-pop overflow-hidden p-8 text-center" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Focus mode">
            <div className="bg-dots absolute inset-0 opacity-60" />
            <button className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800" onClick={() => setOpen(false)} aria-label="Minimise"><X className="h-5 w-5" /></button>
            <div className="relative">
              <div className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-300">Focus mode</div>
              <h2 className="mt-1 text-lg font-bold">{session?.label || "Pick a length and start"}</h2>
              <div className="relative mx-auto my-6 h-56 w-56">
                <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
                  <circle cx="100" cy="100" r="88" strokeWidth="12" className="fill-none stroke-slate-100 dark:stroke-navy-800" />
                  <circle cx="100" cy="100" r="88" strokeWidth="12" fill="none" stroke="url(#fg)" strokeLinecap="round" strokeDasharray={553} strokeDashoffset={553 - (pct / 100) * 553} style={{ transition: "stroke-dashoffset .5s linear" }} />
                  <defs><linearGradient id="fg"><stop offset="0" stopColor="#6d5cf6" /><stop offset="1" stopColor="#3b82f6" /></linearGradient></defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Genie mood={session?.running ? "think" : "happy"} size={64} />
                  <div className="font-mono text-4xl font-extrabold tabular-nums">{mm}:{ss}</div>
                </div>
              </div>
              {!session ? (
                <div className="flex justify-center gap-2">
                  {[15, 25, 45].map((m) => <button key={m} onClick={() => start({ minutes: m })} className="gradient-brand rounded-xl px-4 py-2.5 text-sm font-semibold text-white">{m} min</button>)}
                </div>
              ) : (
                <div className="flex justify-center gap-2">
                  <button onClick={() => setSession((s) => ({ ...s, running: !s.running }))} className="gradient-brand inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white">
                    {session.running ? <><Pause className="h-4 w-4" />Pause</> : <><Play className="h-4 w-4" />Resume</>}
                  </button>
                  <button onClick={() => finish(session, true)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 ring-slate-300 dark:ring-navy-700"><Square className="h-4 w-4" />End & log</button>
                  <button onClick={() => setSession((s) => ({ ...s, left: s.total, running: false }))} className="rounded-xl px-3 py-2.5 ring-1 ring-slate-300 dark:ring-navy-700" aria-label="Restart"><RotateCcw className="h-4 w-4" /></button>
                </div>
              )}
              <p className="mt-5 text-xs text-slate-500">Phone away, one tab open. Time is logged to your analytics and study streak.</p>
            </div>
          </div>
        </div>
      )}
    </FocusCtx.Provider>
  );
}

/* ======================================================================= Command palette (Ctrl+K) */
export function CommandPalette() {
  const nav = useNavigate();
  const focus = useFocus();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); setQ(""); setI(0); }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => { setOpen(true); setQ(""); setI(0); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-palette", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("open-palette", onOpen); };
  }, []);
  const items = useMemo(() => {
    const pages = NAV.flatMap((g) => g.items).map((it) => ({ label: it.label, hint: "Go to page", icon: it.icon, run: () => nav(it.to) }));
    const actions = [
      { label: "Start a focus session", hint: "25-minute Pomodoro", icon: Hourglass, run: () => focus.start({ minutes: 25 }) },
      { label: "Settings & Privacy", hint: "Go to page", icon: Command, run: () => nav("/settings") },
    ];
    const all = [...pages, ...actions];
    const f = q.trim().toLowerCase();
    const list = f ? all.filter((x) => x.label.toLowerCase().includes(f)) : all;
    if (f) list.push({ label: `Ask the AI tutor: "${q.trim()}"`, hint: "New conversation", icon: Search, run: () => nav("/tutor", { state: { prefill: q.trim() } }) });
    return list;
  }, [q, nav, focus]);
  if (!open) return null;
  const run = (it) => { setOpen(false); it.run(); };
  return (
    <div className="fixed inset-0 z-[96] flex items-start justify-center bg-slate-950/50 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="card w-full max-w-lg animate-pop overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-navy-700">
          <Search className="h-5 w-5 text-slate-400" />
          <input autoFocus className="h-14 flex-1 bg-transparent text-base outline-none" placeholder="Search pages or ask anything…" value={q}
            onChange={(e) => { setQ(e.target.value); setI(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, items.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
              if (e.key === "Enter" && items[i]) run(items[i]);
            }} aria-label="Search" />
          <kbd className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-navy-800">Esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {items.map((it, k) => (
            <li key={it.label}>
              <button onMouseEnter={() => setI(k)} onClick={() => run(it)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${k === i ? "bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100" : ""}`}>
                <it.icon className="h-4 w-4 shrink-0" /><span className="flex-1 font-medium">{it.label}</span><span className="text-xs text-slate-400">{it.hint}</span>
                {k === i && <CornerDownLeft className="h-3.5 w-3.5 text-slate-400" />}
              </button>
            </li>
          ))}
          {!items.length && <li className="px-3 py-6 text-center text-sm text-slate-500">No matches</li>}
        </ul>
      </div>
    </div>
  );
}

/* ======================================================================= Mermaid diagrams in AI answers */
let mermaidPromise = null;
export function MermaidDiagram({ code }) {
  const ref = useRef(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    mermaidPromise ||= import("mermaid").then((m) => { m.default.initialize({ startOnLoad: false, theme: document.documentElement.classList.contains("dark") ? "dark" : "default", securityLevel: "strict" }); return m.default; });
    mermaidPromise.then(async (mermaid) => {
      try {
        const { svg } = await mermaid.render("mm" + Math.random().toString(36).slice(2), code);
        if (alive && ref.current) ref.current.innerHTML = svg;
      } catch { if (alive) setErr(true); }
    });
    return () => { alive = false; };
  }, [code]);
  if (err) return <pre><code>{code}</code></pre>;
  return <div ref={ref} className="my-2 flex justify-center overflow-x-auto rounded-xl bg-white p-3 dark:bg-navy-950" aria-label="Diagram" />;
}
