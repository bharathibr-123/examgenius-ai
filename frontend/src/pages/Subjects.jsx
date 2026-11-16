import { ArrowLeft, Bot, Download, BookOpen, Check, ClipboardCheck, GitBranch, Layers, Plus, RefreshCw, Sparkles, Star, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card, EmptyState, ErrorBox, LoadingCards, Markdown, MasteryBar, Modal, PageHeader, StatusBadge, Tabs } from "../components/ui";
import { api, STATUS, SUBJECT_COLORS, useApi, useAuth, useToast } from "../lib";

export function Subjects() {
  const { data, loading, error, reload } = useApi("/subjects/");
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const [dateFor, setDateFor] = useState(null);

  const save = async (list, msg) => {
    try {
      const r = await api("/auth/profile/", { method: "PATCH", body: { subjects: list } });
      setUser(r.user);
      toast.success(msg);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };
  const current = () => user.enrollments.map((e) => ({ subject_id: e.subject_id, exam_date: e.exam_date }));
  const toggle = (s) => {
    setBusy(s.id);
    const list = current();
    if (s.enrolled) save(list.filter((x) => x.subject_id !== s.id), `Removed ${s.short} from your subjects.`);
    else save([...list, { subject_id: s.id, exam_date: null }], `Added ${s.short} to your subjects.`);
  };
  const setDate = (s, date) => save(current().map((x) => (x.subject_id === s.id ? { ...x, exam_date: date || null } : x)), "Exam date saved.");

  return (
    <div>
      <PageHeader icon={BookOpen} art={["book", "atom", "star"]} title="My Subjects" subtitle="Choose the subjects you're studying, set exam dates and open a subject to see topic mastery." />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <LoadingCards n={6} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.subjects.map((s) => (
            <Card key={s.id} className="flex flex-col overflow-hidden">
              <div className={`h-1.5 bg-gradient-to-r ${SUBJECT_COLORS[s.color] || SUBJECT_COLORS.indigo}`} />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">{s.code} · Sem {s.semester}</div>
                    <h3 className="font-semibold">{s.name}</h3>
                  </div>
                  {s.enrolled && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><Check className="h-3 w-3" />Studying</Badge>}
                </div>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{s.description}</p>
                <div className="mt-3 text-xs text-slate-500">{s.unit_count} modules · {s.topic_count} topics</div>
                {s.enrolled && (
                  <>
                    <div className="mt-3 flex justify-between text-xs"><span>Mastery</span><span className="font-semibold">{s.mastery}%</span></div>
                    <MasteryBar value={s.mastery} className="mt-1" />
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      <span className="text-slate-500">Exam:</span>
                      {dateFor === s.id ? (
                        <input type="date" autoFocus className="input py-1 text-xs" defaultValue={s.exam_date || ""} aria-label="Exam date"
                          onBlur={(e) => { setDateFor(null); if ((e.target.value || null) !== s.exam_date) setDate(s, e.target.value); }} />
                      ) : (
                        <button className="font-semibold text-brand-600 hover:underline dark:text-brand-300" onClick={() => setDateFor(s.id)}>
                          {s.exam_date ? new Date(s.exam_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Set date"}
                        </button>
                      )}
                    </div>
                  </>
                )}
                <div className="mt-auto flex gap-2 pt-4">
                  {s.enrolled && <Link to={`/subjects/${s.id}`} className="flex-1"><Button className="w-full" size="sm">Open</Button></Link>}
                  <Button size="sm" variant={s.enrolled ? "ghost" : "soft"} icon={s.enrolled ? X : Plus} loading={busy === s.id} onClick={() => toggle(s)} className={s.enrolled ? "" : "flex-1"}>
                    {s.enrolled ? "Remove" : "Add subject"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ConceptMap({ subjectId }) {
  const { data, loading, error } = useApi(`/subjects/${subjectId}/concept-map/`);
  const [hover, setHover] = useState(null);
  if (loading) return <div className="skeleton h-80 w-full" />;
  if (error) return <ErrorBox error={error} />;
  const cols = {};
  data.nodes.forEach((n) => { (cols[n.depth] ||= []).push(n); });
  const depths = Object.keys(cols).map(Number).sort((a, b) => a - b);
  const W = 210, H = 64, GX = 70, GY = 18;
  const maxRows = Math.max(...depths.map((d) => cols[d].length));
  const width = depths.length * (W + GX) + 40, height = maxRows * (H + GY) + 40;
  const pos = {};
  depths.forEach((d, ci) => cols[d].forEach((n, ri) => {
    const offset = ((maxRows - cols[d].length) * (H + GY)) / 2;
    pos[n.id] = { x: 20 + ci * (W + GX), y: 20 + offset + ri * (H + GY) };
  }));
  const color = { strong: "#10b981", developing: "#f59e0b", weak: "#ef4444", not_enough: "#94a3b8" };
  const related = hover ? new Set([hover, ...data.edges.filter((e) => e.to === hover || e.from === hover).flatMap((e) => [e.from, e.to])]) : null;
  const external = data.edges.filter((e) => e.external);
  return (
    <div>
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">Arrows point from a prerequisite to the topic that needs it. Hover a topic to highlight its links; colours show your mastery. Links come from the curated syllabus data, not AI guesses.</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/60 dark:border-navy-700 dark:bg-navy-950/60">
        <svg width={width} height={height} role="img" aria-label={`Concept dependency map for ${data.subject}`}>
          <defs><marker id="cm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#94a3b8" /></marker></defs>
          {data.edges.filter((e) => !e.external && pos[e.from] && pos[e.to]).map((e, i) => {
            const a = pos[e.from], b = pos[e.to];
            const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x - 4, y2 = b.y + H / 2, mx = (x1 + x2) / 2;
            const on = !related || (related.has(e.from) && related.has(e.to));
            return <path key={i} d={`M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`} fill="none" stroke={on ? "#8b7cff" : "#cbd5e1"} strokeOpacity={on ? 0.9 : 0.35} strokeWidth={on && related ? 2 : 1.25} markerEnd="url(#cm-arrow)" />;
          })}
          {data.nodes.map((n) => {
            const p = pos[n.id];
            const dim = related && !related.has(n.id);
            return (
              <g key={n.id} transform={`translate(${p.x},${p.y})`} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} opacity={dim ? 0.35 : 1} style={{ cursor: "default" }}>
                <rect width={W} height={H} rx="12" className="fill-white dark:fill-navy-900" stroke={color[n.status]} strokeWidth="2" />
                <rect width="6" height={H} rx="3" fill={color[n.status]} />
                <foreignObject x="14" y="6" width={W - 22} height={H - 12}>
                  <div className="flex h-full flex-col justify-center text-[12px] leading-tight text-slate-800 dark:text-slate-100">
                    <span className="line-clamp-2 font-semibold">{n.name}</span>
                    <span className="mt-0.5 text-[10.5px] text-slate-500">M{n.unit} · {n.status === "not_enough" ? "not enough evidence" : `${n.mastery}% mastery`}</span>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>
      {external.length > 0 && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          <b>Cross-subject prerequisites:</b>{" "}
          {external.map((e, i) => <span key={i}>{e.external_name} → {data.nodes.find((n) => n.id === e.to)?.name}{i < external.length - 1 ? "; " : ""}</span>)}
        </p>
      )}
    </div>
  );
}

function NotesView({ notes }) {
  return (
    <div className="space-y-5 text-sm">
      <p className="text-[15px] leading-relaxed">{notes.overview}</p>
      <section><h4 className="mb-2 font-semibold">Key points</h4><ul className="list-disc space-y-1 pl-5">{notes.key_points.map((k, i) => <li key={i}>{k}</li>)}</ul></section>
      {notes.definitions?.length > 0 && (
        <section><h4 className="mb-2 font-semibold">Definitions</h4>
          <dl className="space-y-2">{notes.definitions.map((d, i) => <div key={i} className="rounded-lg bg-slate-50 p-3 dark:bg-navy-800"><dt className="font-semibold">{d.term}</dt><dd className="text-slate-600 dark:text-slate-300">{d.meaning}</dd></div>)}</dl>
        </section>)}
      {notes.formulas?.filter(Boolean).length > 0 && <section><h4 className="mb-2 font-semibold">Formulas</h4><ul className="space-y-1">{notes.formulas.filter(Boolean).map((f, i) => <li key={i} className="rounded bg-slate-100 px-2 py-1 font-mono text-[13px] dark:bg-navy-800">{f}</li>)}</ul></section>}
      {notes.example && <section><h4 className="mb-2 font-semibold">Worked example</h4><Markdown>{notes.example}</Markdown></section>}
      {notes.keywords?.length > 0 && <section><h4 className="mb-2 font-semibold">Keywords</h4><div className="flex flex-wrap gap-1.5">{notes.keywords.map((k) => <Badge key={k} className="bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">{k}</Badge>)}</div></section>}
      {notes.exam_questions?.length > 0 && <section><h4 className="mb-2 font-semibold">Important exam questions</h4><ol className="list-decimal space-y-1 pl-5">{notes.exam_questions.map((q, i) => <li key={i}>{q.question} <span className="text-xs font-semibold text-slate-500">[{q.marks} marks]</span></li>)}</ol></section>}
      {notes.common_mistakes?.length > 0 && <section><h4 className="mb-2 font-semibold">Common mistakes</h4><ul className="list-disc space-y-1 pl-5">{notes.common_mistakes.map((k, i) => <li key={i}>{k}</li>)}</ul></section>}
      {notes.flashcards?.length > 0 && <section><h4 className="mb-2 font-semibold">Flashcards <span className="font-normal text-slate-500">(tap to flip)</span></h4><Flashcards cards={notes.flashcards} /></section>}
    </div>
  );
}

export function Flashcards({ cards }) {
  const [flipped, setFlipped] = useState({});
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((c, i) => (
        <button key={i} onClick={() => setFlipped({ ...flipped, [i]: !flipped[i] })}
          className={`min-h-[96px] rounded-xl p-4 text-left text-sm transition ${flipped[i] ? "gradient-brand text-white" : "bg-slate-50 ring-1 ring-slate-200 hover:ring-brand-300 dark:bg-navy-800 dark:ring-navy-700"}`}>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-70">{flipped[i] ? "Answer" : "Question"}</div>
          {flipped[i] ? c.back : c.front}
        </button>
      ))}
    </div>
  );
}

function TopicDrawer({ topic, subject, onClose }) {
  const nav = useNavigate();
  const toast = useToast();
  const [style, setStyle] = useState("short");
  const { data, loading, setData } = useApi(topic ? `/topics/${topic.id}/notes/?style=${style}` : null, [style]);
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState(null);
  if (!topic) return null;
  const generate = async (regenerate) => {
    setGen(true);
    setErr(null);
    try {
      setData(await api(`/topics/${topic.id}/notes/`, { method: "POST", body: { style, regenerate } }));
    } catch (e) {
      setErr(e);
    } finally {
      setGen(false);
    }
  };
  const askTutor = async () => {
    try {
      const c = await api("/conversations/", { method: "POST", body: { topic_id: topic.id } });
      nav(`/tutor/${c.id}`, { state: { prefill: `Explain "${topic.name}" for my exam.` } });
    } catch (e) { toast.error(e.message); }
  };
  return (
    <Modal open onClose={onClose} title={topic.name} wide>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge status={topic.status} />
        <span className="text-slate-500">{topic.attempts} answers · mastery {topic.mastery}% · level {topic.level}</span>
        <span className="inline-flex items-center gap-0.5 text-amber-500">{Array.from({ length: topic.importance }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}</span>
      </div>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">{topic.summary}</p>
      {topic.prerequisites.length > 0 && <p className="mb-4 text-sm"><b>Prerequisites:</b> {topic.prerequisites.map((p) => p.name).join(", ")}</p>}
      <div className="mb-5 flex flex-wrap gap-2">
        <Button icon={ClipboardCheck} onClick={() => nav("/quiz", { state: { subject_id: subject.id, topic_ids: [topic.id] } })}>Quick quiz</Button>
        <Button variant="secondary" icon={Bot} onClick={askTutor}>Ask the tutor</Button>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-navy-700">
        <h3 className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-brand-500" />AI revision notes</h3>
        <Tabs value={style} onChange={setStyle} tabs={[{ value: "short", label: "Short revision" }, { value: "detailed", label: "Detailed" }]} />
      </div>
      <ErrorBox error={err} />
      {loading ? <div className="space-y-2"><div className="skeleton h-4" /><div className="skeleton h-4 w-2/3" /></div>
        : data?.notes ? (
          <>
            <NotesView notes={data.notes} />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="soft" size="sm" icon={Download} onClick={() => nav(`/print/topic/${topic.id}?style=${style}`)}>Download PDF revision pack</Button>
              <Button variant="ghost" size="sm" icon={RefreshCw} loading={gen} onClick={() => generate(true)}>Regenerate</Button>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-navy-700">
            <p className="text-sm text-slate-600 dark:text-slate-400">Generate {style === "short" ? "short revision" : "detailed"} notes with definitions, keywords, an example, exam questions and flashcards. They're saved, so later visits cost nothing.</p>
            <Button className="mt-4" icon={Sparkles} loading={gen} onClick={() => generate(false)}>Generate notes</Button>
            {gen && <p className="mt-2 text-xs text-slate-500">ChatGPT is writing your notes (usually 10-20 seconds)…</p>}
          </div>
        )}
    </Modal>
  );
}

export function SubjectDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi(`/subjects/${id}/`);
  const [tab, setTab] = useState("topics");
  const [topic, setTopic] = useState(null);
  if (loading && !data) return <LoadingCards n={3} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const s = data.subject;
  const all = data.units.flatMap((u) => u.topics);
  const counts = Object.fromEntries(Object.keys(STATUS).map((k) => [k, all.filter((t) => t.status === k).length]));
  return (
    <div>
      <Link to="/subjects" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white"><ArrowLeft className="h-4 w-4" />All subjects</Link>
      <PageHeader icon={Layers} title={s.name} subtitle={`${s.code} · ${s.unit_count} modules · ${s.topic_count} topics · demo syllabus (verify with your official VTU syllabus)`}
        actions={<>
          <Link to="/quiz" state={{ subject_id: s.id }}><Button variant="secondary" icon={ClipboardCheck}>Subject quiz</Button></Link>
          <Link to="/planner" state={{ subject_id: s.id }}><Button>Plan this subject</Button></Link>
        </>} />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card className="p-4 sm:col-span-1"><div className="text-xs text-slate-500">Mastery</div><div className="font-display text-2xl font-bold">{s.mastery}%</div></Card>
        {Object.entries(STATUS).map(([k, v]) => (
          <Card key={k} className="p-4"><div className="text-xs text-slate-500">{v.label}</div><div className="font-display text-2xl font-bold">{counts[k]}</div></Card>
        ))}
      </div>
      <div className="mb-4"><Tabs value={tab} onChange={setTab} tabs={[{ value: "topics", label: "Topics by module" }, { value: "map", label: "Concept dependency map" }]} /></div>
      {tab === "map" ? <Card className="p-5"><h2 className="mb-2 flex items-center gap-2 font-semibold"><GitBranch className="h-4 w-4" />Concept dependency map</h2><ConceptMap subjectId={id} /></Card> : (
        <div className="space-y-4">
          {data.units.map((u) => (
            <Card key={u.id} className="p-5">
              <h2 className="mb-3 font-semibold"><span className="mr-2 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">Module {u.number}</span>{u.title}</h2>
              <div className="divide-y divide-slate-100 dark:divide-navy-800">
                {u.topics.map((t) => (
                  <button key={t.id} onClick={() => setTopic(t)} className="flex w-full items-center gap-4 py-3 text-left hover:bg-slate-50/70 dark:hover:bg-navy-800/50">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{t.name}</span><StatusBadge status={t.status} /></div>
                      <div className="truncate text-xs text-slate-500">{t.summary}</div>
                    </div>
                    <div className="hidden w-40 sm:block"><MasteryBar value={t.mastery} status={t.status} /><div className="mt-1 text-right text-[11px] text-slate-500">{t.mastery}% · {t.attempts} ans</div></div>
                  </button>
                ))}
              </div>
            </Card>
          ))}
          {!data.units.length && <EmptyState title="No modules yet" />}
        </div>
      )}
      <TopicDrawer topic={topic} subject={s} onClose={() => { setTopic(null); reload(); }} />
    </div>
  );
}
