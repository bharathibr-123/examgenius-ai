import { AlertTriangle, Inbox, Loader2, X } from "lucide-react";
import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { STATUS } from "../lib";
import { Genie, HeaderArt } from "./art";
import { MermaidDiagram } from "./extras";

export function Button({ variant = "primary", size = "md", loading, icon: Icon, children, className = "", ...rest }) {
  const v = {
    primary: "gradient-brand text-white shadow-sm shadow-brand-600/30 hover:brightness-110",
    secondary: "bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 dark:bg-navy-800 dark:text-slate-100 dark:ring-navy-700 dark:hover:bg-navy-700",
    ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800",
    danger: "bg-red-600 text-white hover:bg-red-700",
    soft: "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500/25",
  }[variant];
  const s = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-6 py-3 text-base" }[size];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60 ${v} ${s} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function Card({ className = "", children, ...rest }) {
  return <div className={`card ${className}`} {...rest}>{children}</div>;
}

export function Field({ label, error, hint, children, id }) {
  return (
    <div>
      {label && <label className="label" htmlFor={id}>{label}</label>}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export function Badge({ children, className = "" }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.not_enough;
  return <Badge className={s.cls}>{s.label}</Badge>;
}

export function MasteryBar({ value = 0, status, className = "" }) {
  const s = STATUS[status] || (value >= 70 ? STATUS.strong : value >= 40 ? STATUS.developing : value > 0 ? STATUS.weak : STATUS.not_enough);
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-navy-800 ${className}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all duration-700 ${s.bar}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

export function ProgressRing({ value = 0, size = 120, stroke = 10, label, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 70 ? "#10b981" : pct >= 45 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-slate-100 dark:stroke-navy-800" />
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" stroke={color} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} style={{ transition: "stroke-dashoffset .8s ease" }} />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-2xl font-bold">{label ?? `${Math.round(pct)}%`}</div>
        {sub && <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, sub, tone = "brand" }) {
  const tones = {
    brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
    green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    red: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
  };
  return (
    <Card className="flex items-center gap-4 p-4">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
        <div className="font-display text-xl font-bold leading-tight">{value}</div>
        {sub && <div className="truncate text-xs text-slate-500 dark:text-slate-400">{sub}</div>}
      </div>
    </Card>
  );
}

export function PageHeader({ title, subtitle, icon: Icon, actions, art }) {
  return (
    <div className="relative mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        {Icon && <div className="gradient-brand mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-md shadow-brand-600/30"><Icon className="h-5 w-5" /></div>}
        <div>
          <h1 className="text-2xl font-bold sm:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-end gap-4">
        {art && <HeaderArt kinds={art} />}
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ className = "h-4 w-full" }) {
  return <div className={`skeleton ${className}`} />;
}

export function LoadingCards({ n = 3 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: n }).map((_, i) => (
        <Card key={i} className="space-y-3 p-5"><Skeleton className="h-5 w-1/2" /><Skeleton /><Skeleton className="h-4 w-3/4" /></Card>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, text, action, mood = "happy" }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="relative mb-3">
        <div className="absolute inset-4 rounded-full bg-brand-400/25 blur-2xl" />
        <Genie mood={mood} size={92} className="relative animate-bob" />
        <div className="absolute -bottom-1 -right-2 grid h-8 w-8 place-items-center rounded-xl bg-white text-brand-600 shadow-md ring-1 ring-brand-100 dark:bg-navy-800 dark:text-brand-300 dark:ring-navy-700"><Icon className="h-4 w-4" /></div>
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {text && <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  const aiMissing = error?.data?.ai_error === "not_configured";
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200" role="alert">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">
        <div className="font-medium">{error.message}</div>
        {aiMissing && <div className="mt-1 text-xs">See README → section 1, step 5 (add your AI key).</div>}
      </div>
      {onRetry && <button onClick={onRetry} className="font-semibold underline">Retry</button>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className={`card max-h-[92vh] w-full animate-pop overflow-y-auto rounded-b-none p-6 sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, text, confirmLabel = "Confirm", danger, loading, children }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-slate-600 dark:text-slate-300">{text}</p>
      {children}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-navy-800" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${value === t.value ? "bg-white text-brand-700 shadow-sm dark:bg-navy-950 dark:text-brand-200" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

const mdComponents = {
  pre({ node, children }) {
    const code = node?.children?.[0];
    const cls = [].concat(code?.properties?.className || []).join(" ");
    if (cls.includes("language-mermaid")) {
      const text = (code.children || []).map((c) => c.value || "").join("");
      return <MermaidDiagram code={text} />;
    }
    return <pre>{children}</pre>;
  },
};
export function Markdown({ children }) {
  return <div className="md"><ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{children || ""}</ReactMarkdown></div>;
}

export function AIBanner({ configured }) {
  if (configured !== false) return null;
  return (
    <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <Genie mood="sad" size={44} className="shrink-0" />
      <div><b>AI is not configured.</b> Add your AI key (OpenAI, Gemini or GitHub - see README) to <code>backend/.env</code> and restart the server. AI features will show an error until then — nothing is faked.</div>
    </div>
  );
}

export function SelectSubject({ subjects, value, onChange, allowAll, id }) {
  return (
    <select id={id} className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      {allowAll ? <option value="">All subjects</option> : <option value="" disabled>Choose a subject…</option>}
      {subjects?.map((s) => <option key={s.id} value={s.id}>{s.short} · {s.name}</option>)}
    </select>
  );
}

export function TextLink({ to, children }) {
  return <Link to={to} className="font-semibold text-brand-600 hover:underline dark:text-brand-300">{children}</Link>;
}

export function Logo({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-lg font-extrabold tracking-tight ${className}`}>
      <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4F46E5" /><stop offset=".55" stopColor="#7C3AED" /><stop offset="1" stopColor="#2563EB" /></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#lg)" /><path d="M18 40l14-20 14 20" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="32" cy="45" r="4" fill="#fff" /></svg>
      <span>ExamGenius<span className="text-gradient"> AI</span></span>
    </span>
  );
}
