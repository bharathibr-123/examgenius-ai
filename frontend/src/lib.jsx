import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/* ---------------------------------------------------------------- API client */
function getCookie(name) {
  const m = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : "";
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api(path, { method = "GET", body, form } = {}) {
  const opts = { method, credentials: "same-origin", headers: {} };
  if (method !== "GET") {
    if (!getCookie("csrftoken")) await fetch("/api/auth/csrf/", { credentials: "same-origin" });
    opts.headers["X-CSRFToken"] = getCookie("csrftoken");
  }
  if (form) opts.body = form;
  else if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch("/api" + path, opts);
  } catch {
    throw new ApiError("Cannot reach the ExamGenius server. Is `python manage.py runserver` running?", 0);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const msg = data?.detail || (res.status === 403 ? "Please sign in again." : `Request failed (${res.status}).`);
    throw new ApiError(msg, res.status, data);
  }
  return data;
}

export function useApi(path, deps = []) {
  const [state, setState] = useState({ data: null, loading: !!path, error: null });
  const alive = useRef(true);
  const load = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api(path);
      if (alive.current) setState({ data, loading: false, error: null });
    } catch (e) {
      if (alive.current) setState({ data: null, loading: false, error: e });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => {
    alive.current = true;
    load();
    return () => {
      alive.current = false;
    };
  }, [load]);
  return { ...state, reload: load, setData: (d) => setState((s) => ({ ...s, data: typeof d === "function" ? d(s.data) : d })) };
}

/* ---------------------------------------------------------------- Auth */
const AuthCtx = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const refresh = useCallback(async () => {
    try {
      const r = await api("/auth/me/");
      setUser(r.authenticated ? r.user : null);
    } catch {
      setUser(null);
    }
  }, []);
  useEffect(() => {
    fetch("/api/auth/csrf/", { credentials: "same-origin" }).finally(refresh);
  }, [refresh]);
  return <AuthCtx.Provider value={{ user, setUser, refresh }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);

/* ---------------------------------------------------------------- Theme */
const ThemeCtx = createContext(null);
export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("eg-theme", next ? "dark" : "light");
    } catch {
      /* storage unavailable */
    }
  };
  return <ThemeCtx.Provider value={{ dark, toggle }}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);

/* ---------------------------------------------------------------- Toasts */
const ToastCtx = createContext(null);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((type, msg) => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, type, msg }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), type === "error" ? 7000 : 3800);
  }, []);
  const toast = { success: (m) => push("success", m), error: (m) => push("error", m), info: (m) => push("info", m) };
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pr-6" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role="status"
            className={`pointer-events-auto max-w-sm animate-pop rounded-xl px-4 py-3 text-sm font-medium shadow-lg ring-1 ${
              t.type === "error" ? "bg-red-600 text-white ring-red-700" : t.type === "success" ? "bg-emerald-600 text-white ring-emerald-700" : "bg-slate-900 text-white ring-slate-800 dark:bg-white dark:text-slate-900"}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------------------------------------------------------------- helpers */
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
export const daysUntil = (d) => (d ? Math.ceil((new Date(d + "T00:00:00") - new Date(new Date().toDateString())) / 86400000) : null);

export const STATUS = {
  strong: { label: "Strong", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", bar: "bg-emerald-500" },
  developing: { label: "Developing", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", bar: "bg-amber-500" },
  weak: { label: "Weak", cls: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300", bar: "bg-red-500" },
  not_enough: { label: "New", cls: "bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300", bar: "bg-slate-400" },
};
export const statusOf = (score, attempts) => (attempts < 3 ? "not_enough" : score < 40 ? "weak" : score < 70 ? "developing" : "strong");

export const SUBJECT_COLORS = {
  violet: "from-violet-500 to-indigo-600", blue: "from-blue-500 to-indigo-600", fuchsia: "from-fuchsia-500 to-purple-600",
  amber: "from-amber-500 to-orange-600", emerald: "from-emerald-500 to-teal-600", sky: "from-sky-500 to-blue-600",
  indigo: "from-indigo-500 to-violet-600",
};
