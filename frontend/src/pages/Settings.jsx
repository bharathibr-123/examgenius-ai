import { CheckCircle2, Cpu, KeyRound, Lock, Settings as SettingsIcon, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, ConfirmDialog, Field, LoadingCards, PageHeader } from "../components/ui";
import { api, fmtDateTime, useApi, useAuth, useToast } from "../lib";

export default function Settings() {
  const privacy = useApi("/privacy/");
  const status = useApi("/ai/status/");
  const usage = useApi("/usage/");
  const { setUser } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [pw, setPw] = useState({ old_password: "", new_password: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [delPw, setDelPw] = useState("");

  const changePw = async (e) => {
    e.preventDefault();
    setPwBusy(true);
    try { await api("/auth/password/", { method: "POST", body: pw }); toast.success("Password changed."); setPw({ old_password: "", new_password: "" }); }
    catch (err) { toast.error(err.message); } finally { setPwBusy(false); }
  };
  const wipe = async () => {
    setBusy(true);
    try {
      if (confirm === "account") {
        await api("/auth/delete-account/", { method: "POST", body: { password: delPw } });
        setUser(null);
        toast.success("Your account and all data were deleted.");
        nav("/");
        return;
      }
      const r = await api("/privacy/", { method: "POST", body: { what: confirm } });
      toast.success(`Deleted ${r.deleted} item(s).`);
      privacy.reload();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); setConfirm(null); setDelPw(""); }
  };
  if (privacy.loading && !privacy.data) return <LoadingCards n={3} />;
  const p = privacy.data;
  const DEL = {
    conversations: ["Delete all tutor conversations", `${p.counts.conversations} conversation(s), including PDF Q&A history.`],
    documents: ["Delete all uploaded documents", `${p.counts.documents} PDF(s) with their extracted text.`],
    history: ["Reset my learning history", `${p.counts.quizzes} quizzes, mastery, ${p.counts.mistakes} mistakes, ${p.counts.plans} plans, notes and activity.`],
    account: ["Delete my account", "Your account and ALL data are permanently removed."],
  };

  return (
    <div className="space-y-6">
      <PageHeader icon={SettingsIcon} title="Settings & Privacy" subtitle="Control your data, account security and see exactly what is shared with the AI provider." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><Cpu className="h-4 w-4" />AI connection</h2>
          {status.data && (status.data.configured ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />{status.data.provider_label} key configured on the server · model <code>{status.data.chat_model}</code></p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300"><XCircle className="h-4 w-4" />No {status.data.key_name} in backend/.env - AI features are unavailable.</p>
          ))}
          <p className="mt-2 text-xs text-slate-500">The key lives only on the server and is never sent to your browser.</p>
          <h3 className="mb-2 mt-5 text-sm font-semibold">Your recent AI requests</h3>
          <div className="max-h-56 overflow-y-auto text-xs">
            <table className="w-full"><thead className="text-slate-500"><tr><th className="py-1 text-left">When</th><th className="text-left">Feature</th><th>Tokens</th><th>ms</th><th /></tr></thead>
              <tbody>{usage.data?.logs.map((l, i) => (
                <tr key={i} className="border-t border-slate-100 dark:border-navy-800"><td className="py-1">{fmtDateTime(l.at)}</td><td>{l.feature}</td><td className="text-center">{l.prompt_tokens + l.completion_tokens}</td><td className="text-center">{l.latency_ms}</td><td>{l.cached ? "cache" : l.ok ? "ok" : <span className="text-red-600" title={l.error}>failed</span>}</td></tr>
              ))}</tbody></table>
            {!usage.data?.logs.length && <p className="text-slate-500">No AI requests yet.</p>}
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" />What is sent to the AI provider{status.data ? ` (${status.data.provider_label})` : ""}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">{p.sent_to_ai.map((s, i) => <li key={i}>{s}</li>)}</ul>
          <h3 className="mb-1 mt-4 text-sm font-semibold">Never sent</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">{p.never_sent.map((s, i) => <li key={i}>{s}</li>)}</ul>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">{p.stored_here} {p.faculty_access}</p>
          <p className="mt-2 text-xs text-slate-500">{p.provider_policy}</p>
        </Card>
        <Card className="p-6">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4" />Change password</h2>
          <form onSubmit={changePw} className="space-y-3">
            <Field label="Current password" id="op"><input id="op" type="password" className="input" value={pw.old_password} onChange={(e) => setPw({ ...pw, old_password: e.target.value })} autoComplete="current-password" /></Field>
            <Field label="New password" id="np" hint="At least 8 characters, not too common."><input id="np" type="password" className="input" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} autoComplete="new-password" /></Field>
            <Button type="submit" icon={Lock} loading={pwBusy} disabled={!pw.old_password || !pw.new_password}>Update password</Button>
          </form>
        </Card>
        <Card className="p-6">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-red-700 dark:text-red-300"><Trash2 className="h-4 w-4" />Delete data</h2>
          <div className="space-y-2">
            {Object.entries(DEL).map(([k, [t, d]]) => (
              <div key={k} className="flex items-center justify-between gap-3 rounded-xl p-3 ring-1 ring-slate-200 dark:ring-navy-700">
                <div><div className="text-sm font-semibold">{t}</div><div className="text-xs text-slate-500">{d}</div></div>
                <Button size="sm" variant={k === "account" ? "danger" : "secondary"} onClick={() => setConfirm(k)}>Delete</Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={wipe} loading={busy} danger title={confirm ? DEL[confirm][0] + "?" : ""}
        text={confirm ? DEL[confirm][1] + " This cannot be undone." : ""} confirmLabel="Delete permanently">
        {confirm === "account" && <div className="mt-4"><Field label="Enter your password to confirm" id="dpw"><input id="dpw" type="password" className="input" value={delPw} onChange={(e) => setDelPw(e.target.value)} /></Field></div>}
      </ConfirmDialog>
    </div>
  );
}
