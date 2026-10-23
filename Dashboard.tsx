import { useMemo, useState } from "react";
import {
  DENTISTS,
  GRADE_LABEL,
  MONTHS,
  SCORED,
  type DentistScore,
  type Grade,
  fmtAchievement,
  fmtScore,
  monthIndex,
  scoreAll,
  scoreDentist,
  scoreToGrade,
} from "@/lib/score";

const GRADE_BG: Record<Grade, string> = {
  A: "#3DBE8B",
  B: "#5B8DEF",
  C: "#F2B33D",
  D: "#F08A4B",
  E: "#E5566D",
};
const TYPE_COLOR: Record<string, string> = {
  Sp: "#8A76E0",
  "Gp+": "#F0707F",
  Gp: "#5B8DEF",
  "Tanam X": "#E8A317",
};

const TOOTH = (
  <svg width="44" height="48" viewBox="0 0 120 130" aria-hidden="true">
    <path
      d="M60 14c-10 0-15 5-26 5-12 0-20 9-20 24 0 14 6 22 9 38 3 17 5 33 14 33 8 0 8-17 13-28 2-5 5-8 10-8s8 3 10 8c5 11 5 28 13 28 9 0 11-16 14-33 3-16 9-24 9-38 0-15-8-24-20-24-11 0-16-5-26-5z"
      fill="currentColor"
    />
    <path d="M34 34c4-6 10-8 16-7" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" opacity=".7" />
  </svg>
);

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

function Bar({ value, color }: { value: number | null; color: string }) {
  const w = value == null ? 0 : Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <div className="mini">
      <span className="num">{fmtScore(value)}</span>
      <div className="track">
        <div style={{ width: `${w}%`, background: color }} />
      </div>
    </div>
  );
}

function Spark({ values }: { values: (number | null)[] }) {
  const pts = values
    .map((v, i) => (v == null ? null : [6 + i * (values.length > 1 ? 76 / (values.length - 1) : 0), 22 - ((v - 1) / 4) * 16]))
    .filter((p): p is number[] => !!p);
  if (pts.length < 2) return <span className="muted">—</span>;
  const d = pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox="0 0 88 26" aria-hidden="true">
      <polyline points={d} fill="none" stroke="#6C58C7" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill="#6C58C7" />
    </svg>
  );
}

export function Dashboard() {
  const defaultFrom = Math.max(0, monthIndex("2026-01"));
  const defaultTo = Math.max(defaultFrom, monthIndex("2026-06"));
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo < 0 ? MONTHS.length - 1 : defaultTo);
  const [page, setPage] = useState<"overview" | "card">("overview");
  const [dentist, setDentist] = useState(0);
  const [cumulative, setCumulative] = useState(true);
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [onlyRisk, setOnlyRisk] = useState(false);

  const safeFrom = Math.min(from, to);
  const safeTo = Math.max(from, to);

  const rows = useMemo(() => scoreAll(safeFrom, safeTo, cumulative), [safeFrom, safeTo, cumulative]);
  const byIndex = useMemo(() => new Map(rows.map((r) => [r.index, r])), [rows]);

  const ranked = useMemo(() => {
    return [...rows].sort((a, b) => (a.overall ?? 9) - (b.overall ?? 9));
  }, [rows]);

  const withScore = ranked.filter((r) => r.overall != null);
  const avg = withScore.length ? withScore.reduce((s, r) => s + (r.overall ?? 0), 0) / withScore.length : null;
  const avgGrade = avg == null ? null : scoreToGrade(avg);
  const risk = withScore.filter((r) => (r.overall ?? 5) < 3.5);
  const typeCounts = DENTISTS.reduce<Record<string, number>>((acc, d) => {
    if (rows.some((r) => r.dentist.name === d.name)) acc[d.type] = (acc[d.type] ?? 0) + 1;
    return acc;
  }, {});
  const filledCells = rows.reduce((s, r) => s + r.filled, 0);
  const expectedCells = rows.reduce((s, r) => s + r.expected, 0);
  const complete = expectedCells ? filledCells / expectedCells : 0;

  const dist: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const r of withScore) if (r.grade) dist[r.grade]++;

  const problem = useMemo(() => {
    return SCORED.map((kpi) => {
      const counts: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
      let n = 0;
      for (const r of rows) {
        const hit = r.kpis.find((k) => k.kpi.name === kpi.name);
        if (hit?.grade) {
          counts[hit.grade]++;
          n++;
        }
      }
      return { name: kpi.name, counts, n, bad: counts.D + counts.E };
    })
      .filter((x) => x.n > 0)
      .sort((a, b) => b.bad / b.n - a.bad / a.n)
      .slice(0, 6);
  }, [rows]);

  const trend = useMemo(() => {
    const pts: { label: string; overall: number; nm: number; med: number }[] = [];
    for (let m = safeFrom; m <= safeTo; m++) {
      const snap = scoreAll(m, m, false).filter((r) => r.overall != null);
      if (!snap.length) continue;
      const o = snap.reduce((s, r) => s + (r.overall ?? 0), 0) / snap.length;
      const nmSet = snap.filter((r) => r.nm != null);
      const mdSet = snap.filter((r) => r.med != null);
      pts.push({
        label: MONTHS[m].label.replace(" 20", " '"),
        overall: o,
        nm: nmSet.length ? nmSet.reduce((s, r) => s + (r.nm ?? 0), 0) / nmSet.length : o,
        med: mdSet.length ? mdSet.reduce((s, r) => s + (r.med ?? 0), 0) / mdSet.length : o,
      });
    }
    return pts;
  }, [safeFrom, safeTo]);

  const filtered = ranked.filter((r) => {
    if (type !== "all" && r.dentist.type !== type) return false;
    if (query && !r.dentist.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (onlyRisk && (r.overall == null || r.overall >= 3.5)) return false;
    return true;
  });
  const shown = showAll ? filtered : filtered.slice(0, 10);

  const active = byIndex.get(dentist) ?? scoreDentist(dentist, safeFrom, safeTo, cumulative);

  const periodLabel = `${MONTHS[safeFrom].label} – ${MONTHS[safeTo].label}`;

  function applyPreset(kind: "3" | "sem" | "year") {
    if (kind === "3") {
      setFrom(Math.max(0, safeTo - 2));
      setCumulative(true);
    } else if (kind === "sem") {
      const end = MONTHS[safeTo];
      const month = Number(end.key.slice(5));
      const year = end.key.slice(0, 4);
      const startKey = month <= 6 ? `${year}-01` : `${year}-07`;
      const idx = monthIndex(startKey);
      setFrom(idx < 0 ? Math.max(0, safeTo - 5) : idx);
      setCumulative(true);
    } else {
      const year = MONTHS[safeTo].key.slice(0, 4);
      const idx = monthIndex(`${year}-01`);
      setFrom(idx < 0 ? 0 : idx);
      setCumulative(true);
    }
  }

  function openDentist(index: number) {
    setDentist(index);
    setPage("card");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="shell">
      <nav className="side" aria-label="Navigasi utama">
        <div className="brand">
          <div className="logo">{TOOTH}</div>
          <div>
            <div className="brand-name">Halo, Tim Relations</div>
            <div className="brand-sub">Dentist Relations</div>
          </div>
        </div>
        <div className="nav-list">
          <button type="button" className={page === "overview" ? "navi on" : "navi"} onClick={() => setPage("overview")}>
            <GridIcon /> Overview
          </button>
          <button type="button" className={page === "card" ? "navi on" : "navi"} onClick={() => setPage("card")}>
            <DocIcon /> Report Card Dentist
          </button>
        </div>
        <div className="completeness">
          <Ring pct={complete} />
          <div>
            <b>{Math.round(complete * 100)}% data terisi.</b> Masih ada measurement kosong di rentang ini.
          </div>
          <button type="button" className="check-btn" onClick={() => { setPage("overview"); setOnlyRisk(false); document.getElementById("tabel")?.scrollIntoView({ behavior: "smooth" }); }}>
            Cek kelengkapan
          </button>
        </div>
      </nav>

      <main className="panel">
        {page === "overview" ? (
          <Overview
            periodLabel={periodLabel}
            avg={avg}
            avgGrade={avgGrade}
            risk={risk.length}
            assessed={rows.length}
            typeCounts={typeCounts}
            complete={complete}
            dist={dist}
            trend={trend}
            problem={problem}
            from={safeFrom}
            to={safeTo}
            setFrom={setFrom}
            setTo={setTo}
            applyPreset={applyPreset}
            type={type}
            setType={setType}
            query={query}
            setQuery={setQuery}
            shown={shown}
            filteredCount={filtered.length}
            showAll={showAll}
            setShowAll={setShowAll}
            onlyRisk={onlyRisk}
            setOnlyRisk={setOnlyRisk}
            openDentist={openDentist}
            rows={rows}
          />
        ) : (
          <ReportCard
            periodLabel={periodLabel}
            from={safeFrom}
            to={safeTo}
            setFrom={setFrom}
            setTo={setTo}
            dentist={dentist}
            setDentist={(i) => setDentist(i)}
            cumulative={cumulative}
            setCumulative={setCumulative}
            row={active}
            peers={rows}
            onBack={() => setPage("overview")}
          />
        )}
      </main>
    </div>
  );
}

function Overview(props: {
  periodLabel: string;
  avg: number | null;
  avgGrade: Grade | null;
  risk: number;
  assessed: number;
  typeCounts: Record<string, number>;
  complete: number;
  dist: Record<Grade, number>;
  trend: { label: string; overall: number; nm: number; med: number }[];
  problem: { name: string; counts: Record<Grade, number>; n: number; bad: number }[];
  from: number;
  to: number;
  setFrom: (n: number) => void;
  setTo: (n: number) => void;
  applyPreset: (k: "3" | "sem" | "year") => void;
  type: string;
  setType: (t: string) => void;
  query: string;
  setQuery: (q: string) => void;
  shown: DentistScore[];
  filteredCount: number;
  showAll: boolean;
  setShowAll: (v: boolean) => void;
  onlyRisk: boolean;
  setOnlyRisk: (v: boolean) => void;
  openDentist: (i: number) => void;
  rows: DentistScore[];
}) {
  const types = ["Sp", "Gp+", "Gp", "Tanam X"].filter((t) => (props.typeCounts[t] ?? 0) > 0);
  const distTotal = Object.values(props.dist).reduce((s, n) => s + n, 0) || 1;
  let angle = 0;
  const slices = (["A", "B", "C", "D", "E"] as Grade[]).map((g) => {
    const frac = props.dist[g] / distTotal;
    const start = angle;
    angle += frac * 360;
    return `${GRADE_BG[g]} ${start}deg ${angle}deg`;
  });

  const compareTypes = ["Sp", "Gp+", "Gp"].filter((t) => props.rows.some((r) => r.dentist.type === t && r.overall != null));

  return (
    <>
      <header className="top">
        <h1>Performa Dentist</h1>
        <div className="live"><span>Diperbarui dari database report card</span><i /></div>
      </header>

      <section className="hero" aria-label="Sapaan">
        <div className="hero-tooth" aria-hidden="true">{TOOTH}</div>
        <div>
          <div className="hero-title">{greeting()}, Tim Relations</div>
          <p>
            {props.periodLabel}: rata-rata skor <b>{fmtScore(props.avg)}{props.avgGrade ? ` (grade ${props.avgGrade})` : ""}</b>.
            Ada <b>{props.risk} dentist</b> yang perlu perhatian dan <b>{Math.round((1 - props.complete) * 100)}%</b> measurement masih kosong.
          </p>
          <button type="button" className="pill on" onClick={() => { props.setOnlyRisk(true); document.getElementById("tabel")?.scrollIntoView({ behavior: "smooth" }); }}>
            Lihat yang perlu perhatian
          </button>
        </div>
      </section>

      <section className="card filters" aria-label="Filter rentang bulan">
        <label>Dari bulan
          <select className="sel" value={props.from} onChange={(e) => props.setFrom(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m.key} value={i} disabled={i > props.to}>{m.label}</option>)}
          </select>
        </label>
        <label>Sampai bulan
          <select className="sel" value={props.to} onChange={(e) => props.setTo(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m.key} value={i} disabled={i < props.from}>{m.label}</option>)}
          </select>
        </label>
        <div className="pills" role="group" aria-label="Pilihan cepat">
          <button type="button" className="pill" onClick={() => props.applyPreset("3")}>3 bulan terakhir</button>
          <button type="button" className="pill" onClick={() => props.applyPreset("sem")}>Semester ini</button>
          <button type="button" className="pill" onClick={() => props.applyPreset("year")}>Tahun ini</button>
        </div>
        <button type="button" className="pill" onClick={() => window.print()}>Unduh ringkasan</button>
      </section>

      <section className="tiles" aria-label="Ringkasan periode">
        <article className="tile" style={{ background: "#EFE8FF" }}>
          <div className="tile-h"><span>Dentist dinilai</span><span className="ico" style={{ background: "#8A76E0" }}>#</span></div>
          <div className="big">{props.assessed}</div>
          <div className="split">
            {types.map((t) => <div key={t} style={{ flex: props.typeCounts[t] ?? 0, background: TYPE_COLOR[t] }} />)}
          </div>
          <div className="legend">
            {types.map((t) => <span key={t} className="lg"><i style={{ background: TYPE_COLOR[t] }} />{t} {props.typeCounts[t]}</span>)}
          </div>
        </article>
        <article className="tile" style={{ background: "#FFE6EA" }}>
          <div className="tile-h"><span>Rata-rata skor</span><span className="ico" style={{ background: "#F0707F" }}>★</span></div>
          <div className="big-row"><span className="big">{fmtScore(props.avg)}</span>{props.avgGrade && <span className={`g g${props.avgGrade}`}>{props.avgGrade}</span>}</div>
          <div className="track fat"><div style={{ width: `${((props.avg ?? 0) / 5) * 100}%`, background: "#F0707F" }} /></div>
          <div className="hint">Skala 1–5 · bobot Gp/Gp+ 80:20, Sp/Tanam X 60:40</div>
        </article>
        <article className="tile" style={{ background: "#FFF1CC" }}>
          <div className="tile-h"><span>Perlu perhatian</span><span className="ico" style={{ background: "#E8A317" }}>!</span></div>
          <div className="big">{props.risk}</div>
          <div className="track fat"><div style={{ width: `${props.assessed ? (props.risk / props.assessed) * 100 : 0}%`, background: "#E8A317" }} /></div>
          <div className="hint">{props.assessed ? Math.round((props.risk / props.assessed) * 100) : 0}% dentist · grade C ke bawah</div>
        </article>
        <article className="tile" style={{ background: "#E1ECFF" }}>
          <div className="tile-h"><span>Kelengkapan data</span><span className="ico" style={{ background: "#5B8DEF" }}>✓</span></div>
          <div className="big">{Math.round(props.complete * 100)}%</div>
          <div className="track fat"><div style={{ width: `${props.complete * 100}%`, background: "#5B8DEF" }} /></div>
          <div className="hint">Measurement yang terisi · {SCORED.length} KPI</div>
        </article>
      </section>

      <section className="split-2">
        <article className="card">
          <div className="card-h">
            <h2>Tren rata-rata skor per bulan</h2>
          </div>
          <div className="legend">
            <span className="lg"><i style={{ background: "#6C58C7" }} />Overall</span>
            <span className="lg"><i style={{ background: "#F0707F" }} />Non-Medical</span>
            <span className="lg"><i style={{ background: "#5B8DEF" }} />Medical</span>
          </div>
          <TrendChart points={props.trend} />
        </article>
        <article className="card">
          <h2>Distribusi grade</h2>
          <div className="donut-wrap">
            <div className="donut" style={{ background: `conic-gradient(${slices.join(",")})` }} role="img" aria-label={`Distribusi grade dari ${distTotal} dentist`}>
              <div><b>{distTotal}</b><span>dentist</span></div>
            </div>
            <div className="grade-list">
              {(["A", "B", "C", "D", "E"] as Grade[]).map((g) => (
                <div key={g}><span className={`g g${g} sm`}>{g}</span><span>{GRADE_LABEL[g]}</span><b>{props.dist[g]}</b></div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="split-2">
        <article className="card">
          <div className="card-h">
            <div>
              <h2>Measurement paling bermasalah</h2>
              <div className="muted">Diurutkan dari proporsi grade D+E tertinggi</div>
            </div>
            <div className="legend">
              {(["A", "B", "C", "D", "E"] as Grade[]).map((g) => <span key={g} className="lg"><i style={{ background: GRADE_BG[g] }} />{g}</span>)}
            </div>
          </div>
          <div className="problems">
            {props.problem.map((p) => (
              <div key={p.name}>
                <div className="prob-h"><span>{p.name}</span><span className="muted">{p.bad} dari {p.n} D/E</span></div>
                <div className="stack" role="img">
                  {(["A", "B", "C", "D", "E"] as Grade[]).map((g) => p.counts[g] > 0 ? <div key={g} style={{ flex: p.counts[g], background: GRADE_BG[g] }} /> : null)}
                </div>
              </div>
            ))}
          </div>
        </article>
        <article className="card">
          <h2>Perbandingan tipe</h2>
          <div className="legend">
            {compareTypes.map((t) => <span key={t} className="lg"><i style={{ background: TYPE_COLOR[t] }} />{t} ({props.typeCounts[t] ?? 0})</span>)}
          </div>
          <TypeBars rows={props.rows} types={compareTypes} />
        </article>
      </section>

      <section id="tabel" className="card table-card">
        <div className="table-head">
          <div>
            <h2>Daftar dentist</h2>
            <div className="muted">Diurutkan dari skor overall terendah{props.onlyRisk ? " · hanya yang perlu perhatian" : ""}</div>
          </div>
          <div className="table-tools">
            <div className="seg" role="group" aria-label="Filter tipe dentist">
              {[["all", "Semua"], ["Sp", "Sp"], ["Gp+", "Gp+"], ["Gp", "Gp"], ["Tanam X", "Tanam X"]].map(([v, label]) => {
                const count = v === "all" ? props.rows.length : props.rows.filter((r) => r.dentist.type === v).length;
                if (v !== "all" && count === 0) return null;
                return (
                  <button key={v} type="button" aria-pressed={props.type === v} className={props.type === v ? "on" : ""} onClick={() => { props.setType(v); props.setShowAll(false); }}>
                    {label} <span>{count}</span>
                  </button>
                );
              })}
            </div>
            <label className="search">
              <span className="sr">Cari nama dentist</span>
              <input value={props.query} onChange={(e) => { props.setQuery(e.target.value); props.setShowAll(false); }} placeholder="Cari nama dentist" />
            </label>
            {props.onlyRisk && <button type="button" className="pill" onClick={() => props.setOnlyRisk(false)}>Semua dentist</button>}
          </div>
        </div>
        <div className="table-scroll">
          <div className="tr th" role="row">
            <div>Dentist</div><div>Tipe</div><div>Non-Medical</div><div>Medical</div><div>Overall</div><div>Kelengkapan</div><div />
          </div>
          {props.shown.map((r) => (
            <div className="tr" role="row" key={r.index}>
              <div>
                <button type="button" className="linkish" onClick={() => props.openDentist(r.index)}>{r.dentist.name}</button>
                <div className="muted tiny">{r.dentist.spec || "—"}</div>
              </div>
              <div><span className="chip">{r.dentist.type || "—"}</span></div>
              <div><Bar value={r.nm} color="#B3A5EE" /></div>
              <div><Bar value={r.med} color="#8FB4F5" /></div>
              <div className="ov-cell">
                <b className="num">{fmtScore(r.overall)}</b>
                {r.grade && <span className={`g g${r.grade} sm`}>{r.grade}</span>}
              </div>
              <div className="muted num">{r.filled}/{r.expected}</div>
              <div><button type="button" className="pill tiny-btn" onClick={() => props.openDentist(r.index)}>Kartu</button></div>
            </div>
          ))}
          {props.filteredCount === 0 && <div className="empty">Tidak ada dentist di filter ini.</div>}
        </div>
        {props.filteredCount > 10 && (
          <button type="button" className="more" onClick={() => props.setShowAll(!props.showAll)}>
            {props.showAll ? "Ringkas daftar" : `Tampilkan semua (${props.filteredCount})`}
          </button>
        )}
      </section>
    </>
  );
}

function TrendChart({ points }: { points: { label: string; overall: number; nm: number; med: number }[] }) {
  if (points.length < 2) return <p className="muted">Belum cukup bulan untuk tren.</p>;
  const w = 640;
  const h = 220;
  const pad = 28;
  const xs = points.map((_, i) => pad + (i * (w - pad * 2)) / (points.length - 1));
  const y = (v: number) => pad + ((5 - v) / 4) * (h - pad * 2);
  const line = (key: "overall" | "nm" | "med") => points.map((p, i) => `${xs[i]},${y(p[key])}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img" aria-label="Tren skor bulanan">
      {[1, 2, 3, 4, 5].map((g) => (
        <g key={g}>
          <line x1={pad} x2={w - pad} y1={y(g)} y2={y(g)} stroke="#EDE7FF" />
          <text x={4} y={y(g) + 4} fontSize="11" fill="#6A6488">{g}</text>
        </g>
      ))}
      <polyline points={line("med")} fill="none" stroke="#5B8DEF" strokeWidth="2.5" strokeDasharray="6 5" />
      <polyline points={line("nm")} fill="none" stroke="#F0707F" strokeWidth="2.5" />
      <polyline points={line("overall")} fill="none" stroke="#6C58C7" strokeWidth="3" />
      {points.map((p, i) => (
        <text key={p.label} x={xs[i]} y={h - 6} textAnchor="middle" fontSize="11" fill="#6A6488">{p.label.split(" ")[0].slice(0, 3)}</text>
      ))}
    </svg>
  );
}

function TypeBars({ rows, types }: { rows: DentistScore[]; types: string[] }) {
  const metrics: { key: "nm" | "med" | "overall"; label: string }[] = [
    { key: "nm", label: "Non-Medical" },
    { key: "med", label: "Medical" },
    { key: "overall", label: "Overall" },
  ];
  function avg(type: string, key: "nm" | "med" | "overall") {
    const set = rows.filter((r) => r.dentist.type === type && r[key] != null);
    if (!set.length) return null;
    return set.reduce((s, r) => s + (r[key] ?? 0), 0) / set.length;
  }
  return (
    <div className="typebars">
      {metrics.map((m) => (
        <div key={m.key} className="tb-col">
          <div className="tb-bars">
            {types.map((t) => {
              const v = avg(t, m.key);
              return (
                <div key={t} className="tb">
                  <span>{v == null ? "—" : fmtScore(v)}</span>
                  <div style={{ height: `${((v ?? 0) / 5) * 140}px`, background: TYPE_COLOR[t] }} />
                </div>
              );
            })}
          </div>
          <div className="muted tiny">{m.label}</div>
        </div>
      ))}
    </div>
  );
}

function ReportCard(props: {
  periodLabel: string;
  from: number;
  to: number;
  setFrom: (n: number) => void;
  setTo: (n: number) => void;
  dentist: number;
  setDentist: (n: number) => void;
  cumulative: boolean;
  setCumulative: (v: boolean) => void;
  row: DentistScore | undefined;
  peers: DentistScore[];
  onBack: () => void;
}) {
  const row = props.row;
  const names = DENTISTS.map((d, i) => ({ d, i })).filter(({ i }) => props.peers.some((p) => p.index === i) || i === props.dentist);
  const cats = [...new Set(SCORED.map((k) => k.category))];
  function catScore(r: DentistScore | undefined, cat: string) {
    if (!r) return null;
    const items = r.kpis.filter((k) => k.kpi.category === cat && k.score != null);
    if (!items.length) return null;
    const bobot = items.reduce((s, k) => s + k.kpi.bobot, 0);
    return items.reduce((s, k) => s + (k.score ?? 0) * (k.kpi.bobot / bobot), 0);
  }
  const peerType = row?.dentist.type;
  const peers = props.peers.filter((p) => p.dentist.type === peerType && p.overall != null);
  const w = row ? ({ Gp: "80% non-medical + 20% medical", "Gp+": "80% non-medical + 20% medical", Sp: "60% non-medical + 40% medical", "Tanam X": "60% non-medical + 40% medical" } as Record<string, string>)[row.dentist.type] : "";

  return (
    <>
      <header className="card-top">
        <div>
          <button type="button" className="pill" onClick={props.onBack}>← Overview</button>
          <h1>{row?.dentist.name ?? "Pilih dentist"}</h1>
          <div className="who">
            {row && <span className="chip">{row.dentist.type}</span>}
            <span className="muted">{row?.dentist.spec}</span>
          </div>
        </div>
        <div className="card-filters">
          <label>Dentist
            <select className="sel" value={props.dentist} onChange={(e) => props.setDentist(Number(e.target.value))}>
              {names.map(({ d, i }) => <option key={d.name} value={i}>{d.name}</option>)}
            </select>
          </label>
          <label>Dari bulan
            <select className="sel" value={props.from} onChange={(e) => props.setFrom(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m.key} value={i}>{m.label}</option>)}
            </select>
          </label>
          <label>Sampai bulan
            <select className="sel" value={props.to} onChange={(e) => props.setTo(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m.key} value={i}>{m.label}</option>)}
            </select>
          </label>
          <div className="seg">
            <button type="button" className={!props.cumulative ? "on" : ""} onClick={() => props.setCumulative(false)}>Bulanan</button>
            <button type="button" className={props.cumulative ? "on" : ""} onClick={() => props.setCumulative(true)}>Kumulatif</button>
          </div>
          <button type="button" className="pill on" onClick={() => window.print()}>Cetak / PDF</button>
        </div>
      </header>

      {!row ? <p>Tidak ada data pada rentang ini.</p> : (
        <>
          <section className="summary">
            <article className="card gauge">
              <div className="card-h"><h2>Overall Performance</h2><span className="muted">{props.cumulative ? props.periodLabel : MONTHS[props.to].label}</span></div>
              <Gauge score={row.overall} />
              <div className="grade-line">
                {row.grade && <span className={`g g${row.grade} lg-g`}>{row.grade}</span>}
                <b>{row.grade ? `Grade ${row.grade} · ${GRADE_LABEL[row.grade]}` : "Belum cukup data"}</b>
              </div>
              <div className="muted">{w}</div>
              <div className="chips">
                <span className="chipx">Kelengkapan {row.filled}/{row.expected}</span>
                <span className="chipx">Non-medical {fmtScore(row.nm)} · Medical {fmtScore(row.med)}</span>
              </div>
            </article>
            <article className="card">
              <div className="card-h">
                <h2>Profil per kategori</h2>
                <div className="legend">
                  <span className="lg"><i style={{ background: "#6C58C7" }} />Dentist ini</span>
                  <span className="lg"><i style={{ background: "#B9B0DA" }} />Rata-rata {peerType}</span>
                </div>
              </div>
              <Radar
                cats={cats}
                self={cats.map((c) => catScore(row, c))}
                peer={cats.map((c) => {
                  const vals = peers.map((p) => catScore(p, c)).filter((v): v is number => v != null);
                  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
                })}
              />
            </article>
          </section>

          {(["Non-Medical", "Medical"] as const).map((group) => (
            <section key={group} className="card table-card">
              <div className="table-head"><h2>{group === "Non-Medical" ? "Non-Medical" : "Medical Treatment"}</h2></div>
              <div className="table-scroll">
                <div className="tr kpi th">
                  <div>Kategori</div><div>Measurement</div><div>Pencapaian</div><div>Grade</div><div>Skor</div><div>Bobot</div><div>Tren</div>
                </div>
                {row.kpis.filter((k) => k.kpi.group === group).map((k) => (
                  <div className={`tr kpi ${k.grade === "C" || k.grade === "D" || k.grade === "E" ? "warn" : ""}`} key={k.kpi.name}>
                    <div className="muted">{k.kpi.category}</div>
                    <div><b>{k.kpi.name}</b></div>
                    <div>{fmtAchievement(k.kpi, k.value)}</div>
                    <div>{k.grade ? <span className={`g g${k.grade} sm`}>{k.grade}</span> : <span className="muted">—</span>}</div>
                    <div><Bar value={k.score} color={k.grade ? GRADE_BG[k.grade] : "#ccc"} /></div>
                    <div className="num">{Math.round(k.kpi.bobot * 1000) / 10}%</div>
                    <div><Spark values={k.spark} /></div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="card">
            <h2>Aktivitas konfirmasi</h2>
            <p className="muted">Volume kasus di rentang terpilih. Tidak masuk bobot skor karena belum ada skala grade di Index.</p>
            <div className="acts">
              {row.activities.map((a) => (
                <div key={a.name} className="act"><span>{a.name.replace("Konfirmasi ", "")}</span><b>{a.total.toLocaleString("id-ID")}</b></div>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}

function Gauge({ score }: { score: number | null }) {
  const pct = score == null ? 0 : Math.max(0, Math.min(1, (score - 1) / 4));
  const len = 251.3;
  return (
    <svg viewBox="0 0 200 128" className="gauge-svg" role="img" aria-label={score == null ? "Belum ada skor" : `Skor ${fmtScore(score)} dari 5`}>
      <defs>
        <linearGradient id="gg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8A76E0" />
          <stop offset="1" stopColor="#5B8DEF" />
        </linearGradient>
      </defs>
      <path d="M20 104 A80 80 0 0 1 180 104" fill="none" stroke="#fff" strokeWidth="18" strokeLinecap="round" opacity=".75" />
      <path d="M20 104 A80 80 0 0 1 180 104" fill="none" stroke="url(#gg)" strokeWidth="18" strokeLinecap="round" strokeDasharray={`${pct * len} ${len}`} />
      <text x="100" y="92" textAnchor="middle" fontSize="38" fontWeight="800" fill="#26204A">{fmtScore(score)}</text>
      <text x="100" y="112" textAnchor="middle" fontSize="12" fill="#4A3F86" fontWeight="600">dari 5,00</text>
    </svg>
  );
}

function Radar({ cats, self, peer }: { cats: string[]; self: (number | null)[]; peer: (number | null)[] }) {
  const n = cats.length;
  const cx = 160;
  const cy = 150;
  const R = 108;
  function poly(values: (number | null)[], fallback: number) {
    return values.map((v, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const rad = ((v ?? fallback) / 5) * R;
      return [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad];
    });
  }
  const rings = [1, 2, 3, 4, 5].map((level) => poly(cats.map(() => level), level).map((p) => p.join(",")).join(" "));
  const selfPts = poly(self, 0).map((p) => p.join(",")).join(" ");
  const peerPts = poly(peer, 0).map((p) => p.join(",")).join(" ");
  const labels = cats.map((c, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { c, x: cx + Math.cos(ang) * (R + 22), y: cy + Math.sin(ang) * (R + 18) };
  });
  return (
    <svg viewBox="0 0 340 310" className="radar" role="img" aria-label="Radar skor per kategori">
      {rings.map((pts) => <polygon key={pts} points={pts} fill="none" stroke="#E4DDF7" />)}
      <polygon points={peerPts} fill="#B9B0DA" fillOpacity=".28" stroke="#B9B0DA" strokeDasharray="5 4" />
      <polygon points={selfPts} fill="#8A76E0" fillOpacity=".35" stroke="#6C58C7" strokeWidth="2.5" />
      {labels.map((l) => (
        <text key={l.c} x={l.x} y={l.y} textAnchor="middle" fontSize="11" fontWeight="700" fill="#26204A">{l.c}</text>
      ))}
    </svg>
  );
}

function Ring({ pct }: { pct: number }) {
  const c = 2 * Math.PI * 26;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="26" fill="none" stroke="#fff" strokeWidth="8" opacity=".7" />
      <circle cx="32" cy="32" r="26" fill="none" stroke="#D93E5C" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 32 32)" />
      <text x="32" y="36" textAnchor="middle" fontSize="13" fontWeight="800" fill="#4A1D35">{Math.round(pct * 100)}%</text>
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}
