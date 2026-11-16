import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LogIn, Sparkles, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Field, Logo } from "../components/ui";
import { api, useAuth, useToast } from "../lib";
import { Doodles, Genie } from "../components/art";

function Shell({ children, title, subtitle }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="gradient-brand relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-24 bottom-10 h-80 w-80 rounded-full bg-white/10" />
        <div className="absolute -right-10 top-20 h-56 w-56 rounded-full bg-white/10" />
        <Link to="/" className="relative"><Logo className="text-white [&_.text-gradient]:text-white" /></Link>
        <Doodles.star className="absolute right-16 top-40 w-10 animate-[float_6s_ease-in-out_infinite]" />
        <Doodles.book className="absolute bottom-40 right-24 w-14 animate-[float_7s_ease-in-out_infinite] opacity-90" />
        <div className="relative">
          <Genie mood="wave" size={130} className="mb-4 animate-bob drop-shadow-2xl" />
          <blockquote className="font-display text-3xl font-bold leading-snug">"Study smarter by knowing exactly what you don't know yet."</blockquote>
          <p className="mt-4 max-w-md text-white/80">Every quiz, viva and evaluated answer updates your personal mastery map. ExamGenius uses it to plan your next step.</p>
        </div>
        <div className="relative text-sm text-white/70">BCS515B AI assignment prototype · ATME College of Engineering</div>
      </div>
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md animate-fade-up">
          <Link to="/" className="mb-8 inline-block lg:hidden"><Logo /></Link>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={show ? "text" : "password"} className="input pr-11" value={value} onChange={onChange} autoComplete={autoComplete} required />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function Login() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (user) nav(loc.state?.from || "/dashboard", { replace: true }); }, [user, nav, loc.state]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await api("/auth/login/", { method: "POST", body: form });
      setUser(r.user);
      toast.success(`Welcome back, ${r.user.first_name || "there"}!`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Shell title="Welcome back" subtitle="Sign in to continue your exam preparation.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" id="email">
          <input id="email" type="email" className="input" value={form.email} autoComplete="email" required
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password" id="password">
          <PasswordInput id="password" value={form.password} autoComplete="current-password" onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <div className="-mt-2 text-right"><Link to="/forgot-password" className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300">Forgot password?</Link></div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300" role="alert">{error}</p>}
        <Button type="submit" loading={loading} icon={LogIn} className="w-full" size="lg">Sign in</Button>
      </form>
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-4 text-sm dark:border-navy-700">
        <div className="font-semibold">Demo accounts (DEMO data)</div>
        <div className="mt-1 text-slate-600 dark:text-slate-400">Student: <code>student@demo.examgenius</code><br />Faculty: <code>faculty@demo.examgenius</code><br />Password: <code>ExamGenius@2026</code></div>
        <button type="button" className="mt-2 text-xs font-semibold text-brand-600 dark:text-brand-300"
          onClick={() => setForm({ email: "student@demo.examgenius", password: "ExamGenius@2026" })}>Fill demo student</button>
      </div>
      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">New here? <Link to="/register" className="font-semibold text-brand-600 dark:text-brand-300">Create an account</Link></p>
    </Shell>
  );
}

const STYLES = [["examples", "Examples"], ["diagrams", "Diagrams"], ["steps", "Step-by-step"], ["theory", "Theory"], ["practice", "Practice questions"]];

export function Register() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [subjects, setSubjects] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", usn: "", college: "ATME College of Engineering", university: "VTU",
    degree: "B.E.", branch: "Computer Science & Engineering", year: 3, semester: 5, learning_style: "examples", daily_hours: 4,
  });
  const [picked, setPicked] = useState({});
  useEffect(() => { if (user) nav("/dashboard", { replace: true }); }, [user, nav]);
  useEffect(() => { api("/subjects/public/").then((r) => setSubjects(r.subjects)).catch(() => {}); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const next = () => {
    const errs = {};
    if (step === 1) {
      if (form.full_name.trim().length < 2) errs.full_name = "Enter your full name.";
      if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = "Enter a valid email address.";
      if (form.password.length < 8) errs.password = "Use at least 8 characters.";
    }
    setErrors(errs);
    if (!Object.keys(errs).length) setStep(step + 1);
  };

  const submit = async () => {
    setLoading(true);
    setErrors({});
    try {
      const r = await api("/auth/register/", {
        method: "POST",
        body: { ...form, subjects: Object.entries(picked).map(([id, d]) => ({ subject_id: Number(id), exam_date: d || null })) },
      });
      setUser(r.user);
      toast.success("Account created - welcome to ExamGenius AI!");
      nav("/dashboard");
    } catch (err) {
      const e = err.data?.errors || {};
      setErrors(e);
      if (e.email || e.password || e.full_name) setStep(1);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell title="Create your account" subtitle={`Step ${step} of 3 - ${["Account", "Academic profile", "Subjects & exams"][step - 1]}`}>
      <div className="mb-6 flex gap-2">{[1, 2, 3].map((i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "gradient-brand" : "bg-slate-200 dark:bg-navy-800"}`} />)}</div>
      {step === 1 && (
        <div className="space-y-4">
          <Field label="Full name" id="full_name" error={errors.full_name}><input id="full_name" className="input" value={form.full_name} onChange={set("full_name")} autoComplete="name" /></Field>
          <Field label="College email" id="email" error={errors.email}><input id="email" type="email" className="input" value={form.email} onChange={set("email")} autoComplete="email" /></Field>
          <Field label="Password" id="password" error={errors.password} hint="At least 8 characters, not too common, not all numbers.">
            <PasswordInput id="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
          </Field>
        </div>
      )}
      {step === 2 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Field label="College" id="college"><input id="college" className="input" value={form.college} onChange={set("college")} /></Field></div>
          <Field label="University" id="university"><input id="university" className="input" value={form.university} onChange={set("university")} /></Field>
          <Field label="USN (optional)" id="usn"><input id="usn" className="input" value={form.usn} onChange={set("usn")} /></Field>
          <Field label="Degree" id="degree"><input id="degree" className="input" value={form.degree} onChange={set("degree")} /></Field>
          <Field label="Branch" id="branch"><input id="branch" className="input" value={form.branch} onChange={set("branch")} /></Field>
          <Field label="Year" id="year" error={errors.year}><select id="year" className="input" value={form.year} onChange={set("year")}>{[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}</select></Field>
          <Field label="Semester" id="semester" error={errors.semester}><select id="semester" className="input" value={form.semester} onChange={set("semester")}>{[1, 2, 3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>Semester {s}</option>)}</select></Field>
          <div className="col-span-2">
            <span className="label">How do you learn best?</span>
            <div className="flex flex-wrap gap-2">
              {STYLES.map(([v, l]) => (
                <button type="button" key={v} onClick={() => setForm({ ...form, learning_style: v })}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition ${form.learning_style === v ? "gradient-brand text-white ring-transparent" : "ring-slate-300 hover:bg-slate-50 dark:ring-navy-700 dark:hover:bg-navy-800"}`}>{l}</button>
              ))}
            </div>
          </div>
          <Field label="Study hours per day" id="daily_hours" error={errors.daily_hours}><input id="daily_hours" type="number" min="0.5" max="14" step="0.5" className="input" value={form.daily_hours} onChange={set("daily_hours")} /></Field>
        </div>
      )}
      {step === 3 && (
        <div>
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">Pick the subjects you're preparing for and (optionally) your exam dates. You can change these later.</p>
          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {subjects.map((s) => {
              const on = s.id in picked;
              return (
                <div key={s.id} className={`rounded-xl p-3 ring-1 transition ${on ? "bg-brand-50 ring-brand-300 dark:bg-brand-500/10 dark:ring-brand-500/40" : "ring-slate-200 dark:ring-navy-700"}`}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={on}
                      onChange={() => setPicked((p) => { const n = { ...p }; if (on) delete n[s.id]; else n[s.id] = ""; return n; })} />
                    <div className="flex-1"><div className="text-sm font-semibold">{s.name}</div><div className="text-xs text-slate-500">{s.code} · Sem {s.semester}</div></div>
                  </label>
                  {on && (
                    <div className="mt-2 flex items-center gap-2 pl-7">
                      <span className="text-xs text-slate-500">Exam date</span>
                      <input type="date" className="input py-1.5" value={picked[s.id]} min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setPicked({ ...picked, [s.id]: e.target.value })} aria-label={`Exam date for ${s.name}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {errors.subjects && <p className="mt-2 text-sm text-red-600">{errors.subjects}</p>}
        </div>
      )}
      <div className="mt-8 flex justify-between gap-3">
        {step > 1 ? <Button variant="secondary" icon={ArrowLeft} onClick={() => setStep(step - 1)}>Back</Button> : <span />}
        {step < 3 ? <Button onClick={next}>Continue <ArrowRight className="h-4 w-4" /></Button>
          : <Button onClick={submit} loading={loading} icon={Object.keys(picked).length ? Check : UserPlus}>Create account</Button>}
      </div>
      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">Already registered? <Link to="/login" className="font-semibold text-brand-600 dark:text-brand-300">Sign in</Link></p>
    </Shell>
  );
}
