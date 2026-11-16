import {
  BarChart3, BookMarked, BookOpen, Bot, BrainCircuit, CalendarCheck, ClipboardCheck, Dna, FileQuestion, FileText, GraduationCap,
  Hourglass, LayoutDashboard, LogOut, Menu, Mic, Moon, RotateCcw, Search, Settings, ShieldCheck, Sun, Timer, Trophy, X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { api, useAuth, useTheme } from "../lib";
import { DoodleBorder, Genie, GENIE_TIPS } from "./art";
import { CommandPalette, useFocus } from "./extras";
import { Logo } from "./ui";

export const NAV = [
  { group: "Learn", items: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/subjects", label: "My Subjects", icon: BookOpen },
    { to: "/tutor", label: "AI Tutor", icon: Bot },
    { to: "/notes", label: "Smart PDF Notes", icon: FileText },
  ]},
  { group: "Practise", items: [
    { to: "/quiz", label: "Quiz Generator", icon: ClipboardCheck },
    { to: "/exam-hall", label: "Exam Hall", icon: Timer },
    { to: "/evaluator", label: "Answer Evaluator", icon: GraduationCap },
    { to: "/viva", label: "AI Viva", icon: Mic },
    { to: "/papers", label: "Question Papers", icon: FileQuestion },
    { to: "/mistakes", label: "Mistake Memory", icon: RotateCcw },
  ]},
  { group: "Plan & track", items: [
    { to: "/planner", label: "Planner & Rescue", icon: CalendarCheck },
    { to: "/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/achievements", label: "Achievements", icon: Trophy },
    { to: "/learning-dna", label: "Learning DNA", icon: Dna },
  ]},
];

const MOBILE = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/tutor", label: "Tutor", icon: Bot },
  { to: "/quiz", label: "Quiz", icon: ClipboardCheck },
  { to: "/planner", label: "Plan", icon: CalendarCheck },
];

function NavItem({ to, label, icon: Icon, onClick }) {
  return (
    <NavLink to={to} onClick={onClick}
      className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
        isActive ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-navy-800 dark:hover:text-white"}`}>
      <Icon className="h-[18px] w-[18px]" />
      {label}
    </NavLink>
  );
}

export default function AppLayout() {
  const { user } = useAuth();
  const { dark, toggle } = useTheme();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const examMode = loc.pathname.startsWith("/quiz/") && loc.state?.exam;
  const focus = useFocus();
  const dayIndex = Math.floor(Date.now() / 86400000);
  const [tip, setTip] = useState(dayIndex % GENIE_TIPS.length);

  const logout = async () => {
    try {
      await api("/auth/logout/", { method: "POST" });
    } catch { /* already logged out */ }
    // full reload: clears every cached screen of this user (important on shared lab computers)
    window.location.assign("/");
  };

  const sidebar = (close) => (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-5"><Logo /></div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{g.group}</div>
            <div className="space-y-0.5">{g.items.map((i) => <NavItem key={i.to} {...i} onClick={close} />)}</div>
          </div>
        ))}
        {user?.role === "faculty" && (
          <div>
            <div className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Faculty</div>
            <NavItem to="/faculty" label="Faculty Portal" icon={ShieldCheck} onClick={close} />
          </div>
        )}
        <button onClick={() => setTip((t) => (t + 1) % GENIE_TIPS.length)} title="Next tip"
          className="relative mt-2 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-brand-50 to-blue-50 p-3 pr-2 text-left ring-1 ring-brand-100 transition hover:ring-brand-300 dark:from-brand-500/10 dark:to-blue-500/10 dark:ring-brand-500/20">
          <div className="flex items-start gap-2">
            <Genie mood="wave" size={46} className="-ml-1 shrink-0" />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-300">Genie's tip</div>
              <p className="mt-0.5 text-xs leading-snug text-slate-700 dark:text-slate-300">{GENIE_TIPS[tip]}</p>
            </div>
          </div>
        </button>
      </nav>
      <div className="border-t border-slate-200 p-3 dark:border-navy-700">
        <NavItem to="/settings" label="Settings & Privacy" icon={Settings} onClick={close} />
        <div className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2">
          <div className="gradient-brand grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white">
            {(user?.first_name || user?.email || "?")[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{user?.full_name}</div>
            <div className="truncate text-xs text-slate-500 dark:text-slate-400">
              {user?.role === "faculty" ? "Faculty" : `Sem ${user?.profile?.semester} · Year ${user?.profile?.year}`}
            </div>
          </div>
          <button onClick={logout} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-navy-800" aria-label="Sign out" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-dots min-h-screen">
      {!examMode && (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white/90 backdrop-blur lg:block dark:border-navy-700 dark:bg-navy-900/90">
          {sidebar()}
        </aside>
      )}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-slate-950/50" />
          <aside className="absolute inset-y-0 left-0 w-72 animate-fade-up bg-white dark:bg-navy-900" onClick={(e) => e.stopPropagation()}>
            <button className="absolute right-3 top-5 rounded-lg p-1.5" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            {sidebar(() => setOpen(false))}
          </aside>
        </div>
      )}
      <div className={examMode ? "" : "lg:pl-64"}>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200/70 bg-slate-50/80 px-4 backdrop-blur sm:px-6 dark:border-navy-700/70 dark:bg-navy-950/80">
          <div className="flex items-center gap-2">
            {!examMode && <button className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>}
            <span className="lg:hidden"><Logo /></span>
            {examMode && <span className="hidden lg:inline"><Logo /></span>}
          </div>
          <div className="flex items-center gap-2">
            {!examMode && (
              <button onClick={() => window.dispatchEvent(new Event("open-palette"))} className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-500 ring-1 ring-slate-200 hover:bg-white md:flex dark:ring-navy-700 dark:hover:bg-navy-800" aria-label="Search">
                <Search className="h-4 w-4" />Search<kbd className="ml-3 rounded bg-slate-100 px-1.5 text-[10px] font-semibold dark:bg-navy-800">Ctrl K</kbd>
              </button>
            )}
            {!examMode && (
              <button onClick={() => focus.open()} className="rounded-xl p-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800" title="Focus mode (Pomodoro)" aria-label="Focus mode">
                <Hourglass className="h-[18px] w-[18px]" />
              </button>
            )}
            {!examMode && (
              <NavLink to="/tutor" className="hidden items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 sm:flex dark:bg-brand-500/15 dark:text-brand-200">
                <BrainCircuit className="h-4 w-4" /> Ask AI Tutor
              </NavLink>
            )}
            <button onClick={toggle} className="rounded-xl p-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800" aria-label="Toggle dark mode" title="Toggle theme">
              {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
            <NavLink to="/mistakes" className="rounded-xl p-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800" title="Revision queue" aria-label="Revision queue">
              <BookMarked className="h-[18px] w-[18px]" />
            </NavLink>
          </div>
        </header>
        {!examMode && <DoodleBorder />}
        <main key={loc.pathname} className="relative z-10 mx-auto max-w-[1200px] animate-fade-up px-4 pb-28 pt-6 sm:px-6 lg:pb-12">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
      {!examMode && (
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden dark:border-navy-700 dark:bg-navy-900/95">
          {MOBILE.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${isActive ? "text-brand-600 dark:text-brand-300" : "text-slate-500"}`}>
              <Icon className="h-5 w-5" />{label}
            </NavLink>
          ))}
          <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold text-slate-500">
            <Menu className="h-5 w-5" />More
          </button>
        </nav>
      )}
    </div>
  );
}
