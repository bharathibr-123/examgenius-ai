/* Original illustrations for ExamGenius AI: "Genie" the study owl-bot mascot + doodles. */
import { useId } from "react";

/* Genie - moods: happy | wave | think | celebrate | sleepy | cheer | sad */
export function Genie({ mood = "happy", size = 120, className = "", title = "Genie, your study buddy" }) {
  const id = useId().replace(/:/g, "");
  const eyes = {
    happy: <><circle cx="44" cy="58" r="9" fill="#fff" /><circle cx="76" cy="58" r="9" fill="#fff" /><circle cx="46" cy="59" r="4.5" fill="#1e1b4b" /><circle cx="78" cy="59" r="4.5" fill="#1e1b4b" /><circle cx="47.5" cy="57" r="1.6" fill="#fff" /><circle cx="79.5" cy="57" r="1.6" fill="#fff" /></>,
    wave: <><circle cx="44" cy="58" r="9" fill="#fff" /><circle cx="76" cy="58" r="9" fill="#fff" /><circle cx="46" cy="59" r="4.5" fill="#1e1b4b" /><circle cx="78" cy="59" r="4.5" fill="#1e1b4b" /><circle cx="47.5" cy="57" r="1.6" fill="#fff" /><circle cx="79.5" cy="57" r="1.6" fill="#fff" /></>,
    think: <><circle cx="44" cy="58" r="9" fill="#fff" /><circle cx="76" cy="58" r="9" fill="#fff" /><circle cx="48" cy="55" r="4.5" fill="#1e1b4b" /><circle cx="80" cy="55" r="4.5" fill="#1e1b4b" /></>,
    celebrate: <><path d="M36 60q8-10 16 0" stroke="#1e1b4b" strokeWidth="4" fill="none" strokeLinecap="round" /><path d="M68 60q8-10 16 0" stroke="#1e1b4b" strokeWidth="4" fill="none" strokeLinecap="round" /></>,
    cheer: <><path d="M36 60q8-10 16 0" stroke="#1e1b4b" strokeWidth="4" fill="none" strokeLinecap="round" /><path d="M68 60q8-10 16 0" stroke="#1e1b4b" strokeWidth="4" fill="none" strokeLinecap="round" /></>,
    sleepy: <><path d="M37 59h14" stroke="#1e1b4b" strokeWidth="4" strokeLinecap="round" /><path d="M69 59h14" stroke="#1e1b4b" strokeWidth="4" strokeLinecap="round" /></>,
    sad: <><circle cx="44" cy="60" r="8" fill="#fff" /><circle cx="76" cy="60" r="8" fill="#fff" /><circle cx="44" cy="62" r="4" fill="#1e1b4b" /><circle cx="76" cy="62" r="4" fill="#1e1b4b" /><path d="M36 48l12 4M84 48l-12 4" stroke="#1e1b4b" strokeWidth="3" strokeLinecap="round" /></>,
  }[mood] || null;
  const mouth = {
    happy: <path d="M53 75q7 7 14 0" stroke="#1e1b4b" strokeWidth="3.5" fill="none" strokeLinecap="round" />,
    wave: <path d="M52 74q8 9 16 0" stroke="#1e1b4b" strokeWidth="3.5" fill="#fb7185" strokeLinecap="round" />,
    think: <path d="M55 77h10" stroke="#1e1b4b" strokeWidth="3.5" strokeLinecap="round" />,
    celebrate: <path d="M50 72q10 14 20 0z" fill="#fb7185" stroke="#1e1b4b" strokeWidth="3" strokeLinejoin="round" />,
    cheer: <path d="M50 72q10 14 20 0z" fill="#fb7185" stroke="#1e1b4b" strokeWidth="3" strokeLinejoin="round" />,
    sleepy: <ellipse cx="60" cy="77" rx="4" ry="3" fill="#1e1b4b" />,
    sad: <path d="M53 79q7-6 14 0" stroke="#1e1b4b" strokeWidth="3.5" fill="none" strokeLinecap="round" />,
  }[mood];
  const raise = mood === "wave" || mood === "celebrate" || mood === "cheer";
  return (
    <svg viewBox="0 0 120 130" width={size} height={size * 1.083} className={className} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8b7cff" /><stop offset="1" stopColor="#5b4bf5" /></linearGradient>
        <linearGradient id={`c${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#312e81" /><stop offset="1" stopColor="#1e1b4b" /></linearGradient>
      </defs>
      <ellipse cx="60" cy="124" rx="30" ry="4" fill="#1e1b4b" opacity=".12" />
      {/* wings / arms */}
      <path d={raise ? "M22 78q-16-14-10-34 8 6 16 22z" : "M20 80q-12 8-8 24 10-2 16-14z"} fill="#6d5cf6" className={mood === "wave" ? "origin-[22px_80px] animate-[wave_1.2s_ease-in-out_infinite]" : ""} />
      <path d={mood === "celebrate" || mood === "cheer" ? "M98 78q16-14 10-34-8 6-16 22z" : mood === "think" ? "M96 86q10-4 4-18-8 2-10 14z" : "M100 80q12 8 8 24-10-2-16-14z"} fill="#6d5cf6" />
      {/* body */}
      <path d="M60 22c26 0 42 20 42 50s-16 48-42 48-42-18-42-48 16-50 42-50z" fill={`url(#b${id})`} />
      <ellipse cx="60" cy="94" rx="22" ry="20" fill="#e0dbff" opacity=".9" />
      <path d="M50 88q4 4 0 8M60 86q4 4 0 8M70 88q4 4 0 8" stroke="#a99dff" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* ear tufts */}
      <path d="M28 40l-6-14 16 8z" fill="#5b4bf5" /><path d="M92 40l6-14-16 8z" fill="#5b4bf5" />
      {/* face */}
      <ellipse cx="44" cy="58" rx="15" ry="14" fill="#c7bfff" opacity=".55" /><ellipse cx="76" cy="58" rx="15" ry="14" fill="#c7bfff" opacity=".55" />
      {eyes}
      <path d="M56 66l4 5 4-5z" fill="#f59e0b" />
      {mouth}
      <circle cx="34" cy="72" r="4" fill="#fb7185" opacity=".45" /><circle cx="86" cy="72" r="4" fill="#fb7185" opacity=".45" />
      {/* graduation cap */}
      <path d="M60 4l36 12-36 12-36-12z" fill={`url(#c${id})`} />
      <path d="M38 21v9q22 10 44 0v-9l-22 7z" fill="#1e1b4b" />
      <path d="M90 17v16" stroke="#f59e0b" strokeWidth="2.5" /><circle cx="90" cy="35" r="3.5" fill="#f59e0b" />
      {mood === "think" && <><circle cx="106" cy="30" r="3" fill="#a99dff" /><circle cx="112" cy="20" r="4.5" fill="#a99dff" /></>}
      {mood === "sleepy" && <text x="96" y="30" fontSize="14" fontWeight="700" fill="#8b7cff" fontFamily="sans-serif">z</text>}
      {(mood === "celebrate" || mood === "cheer") && <><path d="M10 20l3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1z" fill="#facc15" /><circle cx="108" cy="50" r="3" fill="#34d399" /><circle cx="14" cy="56" r="2.5" fill="#fb7185" /></>}
    </svg>
  );
}

/* ---------- small doodles (used as page decorations) ---------- */
export const Doodles = {
  book: (p) => (<svg viewBox="0 0 64 64" {...p}><rect x="10" y="14" width="40" height="38" rx="4" fill="#a99dff" /><rect x="14" y="10" width="40" height="38" rx="4" fill="#6d5cf6" /><path d="M20 20h26M20 27h20M20 34h23" stroke="#fff" strokeWidth="3" strokeLinecap="round" /></svg>),
  pencil: (p) => (<svg viewBox="0 0 64 64" {...p}><g transform="rotate(-35 32 32)"><rect x="26" y="6" width="12" height="40" rx="2" fill="#f59e0b" /><rect x="26" y="6" width="12" height="7" rx="2" fill="#fb7185" /><path d="M26 46h12l-6 12z" fill="#fde68a" /><path d="M30 54h4l-2 4z" fill="#1e1b4b" /></g></svg>),
  bulb: (p) => (<svg viewBox="0 0 64 64" {...p}><circle cx="32" cy="26" r="16" fill="#facc15" /><rect x="25" y="40" width="14" height="10" rx="3" fill="#94a3b8" /><path d="M32 16v10M27 22l5 4 5-4" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" /><path d="M10 12l5 4M54 12l-5 4M6 30h6M58 30h-6" stroke="#facc15" strokeWidth="3" strokeLinecap="round" /></svg>),
  rocket: (p) => (<svg viewBox="0 0 64 64" {...p}><path d="M32 6c10 8 14 20 12 34H20C18 26 22 14 32 6z" fill="#e0e7ff" /><circle cx="32" cy="24" r="6" fill="#3b82f6" /><path d="M20 40l-8 10 10-2M44 40l8 10-10-2" fill="#6d5cf6" /><path d="M26 44q6 14 12 0" fill="#f97316" /></svg>),
  star: (p) => (<svg viewBox="0 0 64 64" {...p}><path d="M32 6l7 16 17 2-13 11 4 17-15-9-15 9 4-17L8 24l17-2z" fill="#facc15" /></svg>),
  atom: (p) => (<svg viewBox="0 0 64 64" {...p}><g fill="none" stroke="#38bdf8" strokeWidth="3"><ellipse cx="32" cy="32" rx="26" ry="10" /><ellipse cx="32" cy="32" rx="26" ry="10" transform="rotate(60 32 32)" /><ellipse cx="32" cy="32" rx="26" ry="10" transform="rotate(120 32 32)" /></g><circle cx="32" cy="32" r="5" fill="#6d5cf6" /></svg>),
  cap: (p) => (<svg viewBox="0 0 64 64" {...p}><path d="M32 12l26 10-26 10L6 22z" fill="#312e81" /><path d="M16 27v10q16 8 32 0V27l-16 6z" fill="#4338ca" /><path d="M54 24v14" stroke="#f59e0b" strokeWidth="3" /><circle cx="54" cy="40" r="3" fill="#f59e0b" /></svg>),
  calc: (p) => (<svg viewBox="0 0 64 64" {...p}><rect x="14" y="8" width="36" height="48" rx="6" fill="#10b981" /><rect x="19" y="13" width="26" height="10" rx="2" fill="#d1fae5" /><g fill="#d1fae5">{[0, 1, 2].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={19 + c * 9} y={28 + r * 9} width="6" height="6" rx="1.5" />))}</g></svg>),
  heart: (p) => (<svg viewBox="0 0 64 64" {...p}><path d="M32 54S8 40 8 22a12 12 0 0124-4 12 12 0 0124 4c0 18-24 32-24 32z" fill="#fb7185" /></svg>),
};

/* Decorative cartoon border: doodles floating along the page edges (behind the content). */
const LAYOUT = [
  ["book", "left-[3%] top-[18%] w-10 rotate-[-12deg]"], ["star", "left-[1.5%] top-[46%] w-6"], ["pencil", "left-[3%] top-[72%] w-11"],
  ["bulb", "right-[2%] top-[14%] w-11 rotate-[10deg]"], ["atom", "right-[1.5%] top-[40%] w-12"], ["rocket", "right-[2.5%] top-[64%] w-11 rotate-[18deg]"],
  ["star", "right-[4%] top-[86%] w-5"], ["cap", "left-[2%] top-[90%] w-10"], ["calc", "right-[1%] top-[26%] w-8 rotate-[-8deg] hidden 2xl:block"],
  ["heart", "left-[4.5%] top-[33%] w-5"],
];
export function DoodleBorder() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-y-0 right-0 left-0 z-0 hidden xl:block lg:left-64">
      {LAYOUT.map(([k, cls], i) => {
        const D = Doodles[k];
        return <D key={i} className={`absolute opacity-35 dark:opacity-25 animate-[float_7s_ease-in-out_infinite] ${cls}`} style={{ animationDelay: `${i * 0.7}s` }} />;
      })}
    </div>
  );
}

/* A small cluster of doodles for page headers */
export function HeaderArt({ kinds = ["book", "bulb", "star"] }) {
  return (
    <div aria-hidden="true" className="relative hidden h-16 w-36 md:block">
      {kinds.slice(0, 3).map((k, i) => {
        const D = Doodles[k];
        const pos = ["left-0 top-3 w-12 -rotate-12", "left-12 -top-1 w-14", "left-28 top-6 w-7 rotate-12"][i];
        return <D key={i} className={`absolute animate-[float_6s_ease-in-out_infinite] ${pos}`} style={{ animationDelay: `${i * 0.6}s` }} />;
      })}
    </div>
  );
}

export const GENIE_TIPS = [
  "Active recall beats re-reading. Quiz yourself after every topic!",
  "Short on time? Exam Rescue Mode ranks topics by importance and your weak spots.",
  "Mistakes are gold - revise them in Mistake Memory before they come back in the exam.",
  "Write 10-mark answers with headings, a diagram and a conclusion. Try the Answer Evaluator!",
  "45 minutes of focus + a 10-minute break keeps your brain fresh. Try Focus Mode.",
  "Feeling 'Sure' but getting it wrong? Check the confidence chart in Analytics.",
  "Explain a topic out loud - the AI Viva is great practice for that.",
  "Start with prerequisites: the concept map shows what to learn first.",
  "Download a VTU-style model paper and solve it under exam conditions.",
  "Consistency wins: a small study streak every day beats one long night.",
];
