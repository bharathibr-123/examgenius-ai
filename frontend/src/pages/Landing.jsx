import {
  ArrowRight, BrainCircuit, CalendarClock, CheckCircle2, ClipboardCheck, FileSearch, GaugeCircle, LifeBuoy, Mic,
  Moon, RotateCcw, ShieldCheck, Sparkles, Sun, Target, Timer,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "../components/ui";
import { Doodles, Genie } from "../components/art";
import { FileQuestion, Hourglass, Trophy, Volume2 } from "lucide-react";
import { useApi, useAuth, useTheme } from "../lib";

function HeroArt() {
  return (
    <svg viewBox="0 0 520 440" className="h-auto w-full" role="img" aria-label="A student studying with an AI companion that shows readiness and mastery">
      <defs>
        <linearGradient id="h1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6366f1" /><stop offset="1" stopColor="#a855f7" /></linearGradient>
        <linearGradient id="h2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3b82f6" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#4f46e5" floodOpacity=".18" /></filter>
      </defs>
      <circle cx="270" cy="220" r="190" fill="url(#h1)" opacity=".10" />
      <circle cx="270" cy="220" r="130" fill="url(#h2)" opacity=".10" />
      {/* desk + laptop */}
      <rect x="90" y="318" width="340" height="14" rx="7" className="fill-slate-300 dark:fill-navy-700" />
      <rect x="170" y="230" width="170" height="92" rx="10" className="fill-slate-800 dark:fill-slate-700" />
      <rect x="180" y="240" width="150" height="72" rx="6" fill="url(#h2)" opacity=".9" />
      <path d="M196 290l22-20 18 12 26-28 22 18" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="150" y="320" width="210" height="8" rx="4" className="fill-slate-400 dark:fill-slate-600" />
      {/* student */}
      <circle cx="380" cy="215" r="26" fill="#f2c4a0" />
      <path d="M354 208c2-22 22-32 40-24 12 5 14 16 12 24-10-10-30-12-52 0z" fill="#1e1b4b" />
      <path d="M340 320c0-46 18-74 40-74s40 28 40 74z" fill="url(#h1)" />
      <path d="M352 285l-40 22" stroke="#f2c4a0" strokeWidth="10" strokeLinecap="round" />

      {/* floating cards */}
      <g filter="url(#soft)">
        <rect x="300" y="60" width="170" height="74" rx="16" className="fill-white dark:fill-navy-900" />
        <text x="318" y="88" className="fill-slate-500 dark:fill-slate-400" fontSize="12" fontFamily="Inter Variable, sans-serif">Exam readiness</text>
        <text x="318" y="116" className="fill-slate-900 dark:fill-white" fontSize="24" fontWeight="800" fontFamily="Plus Jakarta Sans Variable, sans-serif">74%</text>
        <circle cx="436" cy="98" r="18" fill="none" strokeWidth="6" className="stroke-slate-100 dark:stroke-navy-700" />
        <circle cx="436" cy="98" r="18" fill="none" stroke="#10b981" strokeWidth="6" strokeDasharray="113" strokeDashoffset="29" strokeLinecap="round" transform="rotate(-90 436 98)" />
      </g>
      <g filter="url(#soft)">
        <rect x="40" y="250" width="150" height="62" rx="14" className="fill-white dark:fill-navy-900" />
        <text x="56" y="274" className="fill-slate-500 dark:fill-slate-400" fontSize="11" fontFamily="Inter Variable, sans-serif">A* search mastery</text>
        <rect x="56" y="286" width="118" height="8" rx="4" className="fill-slate-100 dark:fill-navy-700" />
        <rect x="56" y="286" width="86" height="8" rx="4" fill="#6366f1" />
      </g>
      <g filter="url(#soft)">
        <rect x="350" y="356" width="150" height="48" rx="14" className="fill-white dark:fill-navy-900" />
        <circle cx="372" cy="380" r="9" fill="#f59e0b" />
        <text x="388" y="385" className="fill-slate-800 dark:fill-slate-200" fontSize="12" fontWeight="600" fontFamily="Inter Variable, sans-serif">Revise: BFS today</text>
      </g>
    </svg>
  );
}

const FEATURES = [
  { icon: BrainCircuit, title: "AI Personal Tutor", text: "Five explanation modes plus 2, 5 and 10-mark exam answers, adapted to your semester and learning style." },
  { icon: FileSearch, title: "Smart PDF Notes", text: "Upload notes, get summaries, flashcards and exam questions, and ask questions answered with page citations." },
  { icon: ClipboardCheck, title: "Adaptive Quizzes", text: "MCQ, true/false, fill-in and short answers whose difficulty adapts to your real performance." },
  { icon: Target, title: "Knowledge Gap Detector", text: "Topic-wise mastery from your actual answers, plus weak spots and prerequisite gaps." },
  { icon: LifeBuoy, title: "Exam Rescue Mode", text: "Only 3 days left? Get a priority-ranked emergency plan that re-plans after every quiz." },
  { icon: RotateCcw, title: "Mistake Memory", text: "Every wrong answer comes back on a spaced-repetition schedule until you've mastered it." },
  { icon: Timer, title: "Exam Hall Simulator", text: "A timed mock exam with no hints, then detailed AI feedback after you submit." },
  { icon: Mic, title: "AI Viva Examiner", text: "Practise oral exams: the AI asks, scores and adapts each follow-up question." },
  { icon: GaugeCircle, title: "Exam Readiness", text: "A transparent readiness score built from mastery, coverage, mock exams and revision." },
  { icon: Volume2, title: "Voice Tutor", text: "Speak your doubts and listen to answers - hands-free revision, in Indian English." },
  { icon: FileQuestion, title: "VTU Model Papers", text: "Generate a full 100-mark VTU-style paper with Bloom's levels, then download it as a PDF." },
  { icon: Hourglass, title: "Focus Mode + Achievements", text: "Pomodoro focus sessions, study streaks and 15 badges that turn good habits into a game." },
];

const STEPS = [
  { n: 1, title: "Create your profile", text: "Choose your semester, subjects, exam dates and learning style." },
  { n: 2, title: "Learn with AI", text: "Ask the tutor, generate topic notes or upload your own PDFs." },
  { n: 3, title: "Practise and get measured", text: "Every quiz, viva and evaluated answer updates your topic mastery." },
  { n: 4, title: "Follow your plan", text: "The planner, Rescue Mode and revision queue tell you what to do next." },
];

export default function Landing() {
  const { user } = useAuth();
  const { dark, toggle } = useTheme();
  const status = useApi("/ai/status/");
  const engine = status.data?.configured ? status.data.provider_label : "ChatGPT";
  return (
    <div className="min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="rounded-xl p-2.5 hover:bg-slate-100 dark:hover:bg-navy-800" aria-label="Toggle theme">{dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>
          {user ? (
            <Link to="/dashboard" className="gradient-brand rounded-xl px-4 py-2.5 text-sm font-semibold text-white">Open dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-navy-800">Sign in</Link>
              <Link to="/register" className="gradient-brand rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/30">Get started</Link>
            </>
          )}
        </div>
      </header>

      <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-8 lg:grid-cols-2 lg:pt-16">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[880px] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-400/20 via-violet-400/20 to-blue-400/20 blur-3xl" />
        <div className="relative animate-fade-up">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
            <Sparkles className="h-3.5 w-3.5" /> Powered by {engine} · built for VTU students
          </div>
          <h1 className="text-4xl font-extrabold leading-[1.1] sm:text-5xl lg:text-[56px]">
            Your intelligent <span className="text-gradient">academic success</span> partner
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-300">
            ExamGenius AI is more than a chatbot. It learns what <i>you</i> know from your quizzes and answers, finds your weak topics,
            and turns the days you have left into a plan that adapts as you go.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={user ? "/dashboard" : "/register"} className="gradient-brand inline-flex items-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:brightness-110">
              {user ? "Go to your dashboard" : "Create free account"} <ArrowRight className="h-4 w-4" />
            </Link>
            {!user && <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold ring-1 ring-slate-300 hover:bg-slate-50 dark:bg-navy-900 dark:ring-navy-700">I have an account</Link>}
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
            {["6 VTU subjects ready", "Real scores, not fake charts", "Your data stays private"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" />{t}</span>
            ))}
          </div>
        </div>
        <div className="relative animate-fade-up [animation-delay:120ms]">
          <HeroArt />
          <Genie mood="wave" size={150} className="absolute left-[4%] top-[14%] w-[26%] animate-bob drop-shadow-xl" />
          <div className="absolute left-[24%] top-[6%] hidden rounded-2xl rounded-bl-none bg-white px-3 py-2 text-sm font-semibold shadow-lg ring-1 ring-brand-100 sm:block dark:bg-navy-900 dark:ring-navy-700">Hi! I'm Genie 👋 Let's ace your exams!</div>
          <Doodles.pencil className="absolute -bottom-2 left-[2%] w-12 animate-[float_6s_ease-in-out_infinite]" />
          <Doodles.star className="absolute right-[6%] top-0 w-8 animate-[float_5s_ease-in-out_infinite]" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl font-bold">Everything you need before the exam</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">The AI writes the content. ExamGenius's own engine measures, schedules and adapts.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card group p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="gradient-brand mb-4 grid h-11 w-11 place-items-center rounded-xl text-white shadow-md shadow-brand-600/25"><Icon className="h-5 w-5" /></div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="mb-10 text-center text-3xl font-bold">How it works</h2>
        <div className="grid gap-6 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative text-center">
              {i < STEPS.length - 1 && <div className="absolute left-[60%] top-6 hidden h-0.5 w-[80%] bg-gradient-to-r from-brand-300 to-transparent md:block" />}
              <div className="gradient-brand relative mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full font-display text-lg font-bold text-white shadow-lg shadow-brand-600/30">{s.n}</div>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="gradient-brand relative overflow-hidden rounded-3xl p-8 text-white sm:p-12">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
          <div className="relative grid gap-8 md:grid-cols-3">
            {[
              { icon: CalendarClock, t: "Less panic", d: "Know exactly what to study today, even 3 days before the exam." },
              { icon: Target, t: "No blind spots", d: "Weak topics and missing prerequisites show up before they cost you marks." },
              { icon: ShieldCheck, t: "Honest and private", d: "Transparent formulas, AI estimates clearly labelled, and your data is yours." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t}><Icon className="mb-3 h-7 w-7" /><h3 className="text-lg font-semibold">{t}</h3><p className="mt-1 text-sm text-white/85">{d}</p></div>
            ))}
          </div>
          <div className="relative mt-10">
            <Link to={user ? "/dashboard" : "/register"} className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-brand-700 hover:bg-brand-50">
              Start preparing now <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
      <footer className="flex flex-col items-center gap-2 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        <Genie mood="happy" size={56} />
        ExamGenius AI · BCS515B Artificial Intelligence assignment prototype · ATME College of Engineering, Mysuru
      </footer>
    </div>
  );
}
