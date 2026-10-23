import report from "@/data/report.json";

export type Grade = "A" | "B" | "C" | "D" | "E";

export type Kpi = {
  name: string;
  group: string;
  category: string;
  uom: string;
  higher: boolean;
  th: { g: Grade; v: number }[];
  bobot: number;
  scored: boolean;
};

export type Dentist = { name: string; type: string; spec: string };

type Data = {
  months: { key: string; label: string }[];
  kpis: Kpi[];
  weights: Record<string, { nm: number; med: number }>;
  dentists: Dentist[];
  cells: [number, number, number, number][];
};

const data = report as unknown as Data;

export const MONTHS = data.months;
export const KPIS = data.kpis;
export const DENTISTS = data.dentists;
export const SCORED = KPIS.filter((k) => k.scored);
export const ACTIVITIES = KPIS.filter((k) => !k.scored);

const POINTS: Record<Grade, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 };
export const GRADE_LABEL: Record<Grade, string> = {
  A: "Sangat baik",
  B: "Baik",
  C: "Cukup",
  D: "Kurang",
  E: "Buruk",
};

const grid: Array<Array<Map<number, number>>> = DENTISTS.map(() =>
  MONTHS.map(() => new Map()),
);
for (const [d, m, k, v] of data.cells) {
  const row = grid[d]?.[m];
  if (row) row.set(k, v);
}

export function gradeFor(kpi: Kpi, value: number): Grade {
  if (!kpi.th.length) return "C";
  if (kpi.higher) {
    for (const t of kpi.th) if (value >= t.v - 1e-9) return t.g;
    return "E";
  }
  for (const t of kpi.th) if (value <= t.v + 1e-9) return t.g;
  return "E";
}

export function scoreToGrade(score: number): Grade {
  if (score >= 4.5) return "A";
  if (score >= 3.5) return "B";
  if (score >= 2.5) return "C";
  if (score >= 1.5) return "D";
  return "E";
}

function aggregate(kpi: Kpi, values: number[]): number {
  if (kpi.uom === "Point" || kpi.uom === "IDR") {
    return values.reduce((s, v) => s + v, 0);
  }
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export type KpiResult = {
  kpi: Kpi;
  index: number;
  value: number | null;
  grade: Grade | null;
  score: number | null;
  spark: (number | null)[];
};

export type DentistScore = {
  index: number;
  dentist: Dentist;
  nm: number | null;
  med: number | null;
  overall: number | null;
  grade: Grade | null;
  filled: number;
  expected: number;
  kpis: KpiResult[];
  activities: { name: string; total: number }[];
};

function weighted(items: { score: number | null; bobot: number }[]): number | null {
  const present = items.filter((x): x is { score: number; bobot: number } => x.score != null);
  const sum = present.reduce((s, x) => s + x.bobot, 0);
  if (!sum) return null;
  return present.reduce((s, x) => s + x.score * (x.bobot / sum), 0);
}

export function scoreDentist(di: number, from: number, to: number, cumulative: boolean): DentistScore {
  const start = cumulative ? from : to;
  const end = to;
  const kpis: KpiResult[] = SCORED.map((kpi) => {
    const index = KPIS.indexOf(kpi);
    const spark: (number | null)[] = [];
    const values: number[] = [];
    for (let m = start; m <= end; m++) {
      const raw = grid[di][m].get(index);
      if (raw == null) {
        spark.push(null);
        continue;
      }
      values.push(raw);
      spark.push(POINTS[gradeFor(kpi, raw)]);
    }
    if (!values.length) {
      return { kpi, index, value: null, grade: null, score: null, spark };
    }
    const value = aggregate(kpi, values);
    const grade = gradeFor(kpi, value);
    return { kpi, index, value, grade, score: POINTS[grade], spark };
  });
  const nmItems = kpis.filter((k) => k.kpi.group === "Non-Medical");
  const medItems = kpis.filter((k) => k.kpi.group === "Medical");
  const nm = weighted(nmItems.map((k) => ({ score: k.score, bobot: k.kpi.bobot })));
  const med = weighted(medItems.map((k) => ({ score: k.score, bobot: k.kpi.bobot })));
  const w = data.weights[DENTISTS[di].type] ?? { nm: 0.7, med: 0.3 };
  let overall: number | null = null;
  if (nm != null && med != null) overall = nm * w.nm + med * w.med;
  else if (nm != null) overall = nm;
  else if (med != null) overall = med;
  const filled = kpis.filter((k) => k.value != null).length;
  const activities = ACTIVITIES.map((kpi) => {
    const index = KPIS.indexOf(kpi);
    let total = 0;
    for (let m = start; m <= end; m++) total += grid[di][m].get(index) ?? 0;
    return { name: kpi.name, total };
  });
  return {
    index: di,
    dentist: DENTISTS[di],
    nm,
    med,
    overall,
    grade: overall == null ? null : scoreToGrade(overall),
    filled,
    expected: SCORED.length,
    kpis,
    activities,
  };
}

export function scoreAll(from: number, to: number, cumulative: boolean): DentistScore[] {
  return DENTISTS.map((_, i) => scoreDentist(i, from, to, cumulative)).filter(
    (d) => d.filled > 0 || d.activities.some((a) => a.total > 0),
  );
}

export function fmtScore(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtAchievement(kpi: Kpi, value: number | null): string {
  if (value == null) return "Tidak ada data";
  if (kpi.uom === "%") return `${(value * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
  if (kpi.uom === "IDR") return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
  if (kpi.uom === "Day") return `${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })} hari`;
  if (kpi.uom === "Point") return `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })} poin`;
  return value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

export function monthIndex(key: string): number {
  return MONTHS.findIndex((m) => m.key === key);
}
