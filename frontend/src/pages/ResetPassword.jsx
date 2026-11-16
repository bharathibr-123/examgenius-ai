import { KeyRound, Mail } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Genie } from "../components/art";
import { Button, Card, Field, Logo } from "../components/ui";
import { api, useToast } from "../lib";

function Shell({ children, mood }) {
  return (
    <div className="bg-dots grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md animate-fade-up">
        <Link to="/" className="mb-6 flex justify-center"><Logo /></Link>
        <Card className="p-8">
          <div className="mb-4 flex justify-center"><Genie mood={mood} size={90} className="animate-bob" /></div>
          {children}
        </Card>
      </div>
    </div>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { setDone(await api("/auth/password-reset/", { method: "POST", body: { email } })); }
    catch (err) { setDone({ detail: err.message }); } finally { setBusy(false); }
  };
  return (
    <Shell mood={done ? "wave" : "think"}>
      <h1 className="text-center text-2xl font-bold">Forgot your password?</h1>
      {done ? (
        <div className="mt-4 space-y-3 text-center text-sm">
          <p className="font-medium">{done.detail}</p>
          {done.note && <p className="rounded-xl bg-amber-50 p-3 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">{done.note}</p>}
          <Link to="/login" className="inline-block font-semibold text-brand-600 dark:text-brand-300">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <p className="text-center text-sm text-slate-500">Enter your account email and we'll send you a reset link.</p>
          <Field label="Email" id="fe"><input id="fe" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
          <Button type="submit" className="w-full" icon={Mail} loading={busy}>Send reset link</Button>
          <p className="text-center text-sm"><Link to="/login" className="font-semibold text-brand-600 dark:text-brand-300">Back to sign in</Link></p>
        </form>
      )}
    </Shell>
  );
}

export function ResetPassword() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("/auth/password-reset/confirm/", { method: "POST", body: { uid: sp.get("uid"), token: sp.get("token"), new_password: pw } });
      toast.success("Password changed - please sign in.");
      nav("/login");
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <Shell mood="happy">
      <h1 className="text-center text-2xl font-bold">Choose a new password</h1>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <Field label="New password" id="np" error={err} hint="At least 8 characters, not too common."><input id="np" type="password" required className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
        <Button type="submit" className="w-full" icon={KeyRound} loading={busy}>Save new password</Button>
      </form>
    </Shell>
  );
}
