import { query, type Db } from '../db.js';

/**
 * dsa_gddp merges source tables dsa_21..dsa_24 (different measures of the same districts).
 * dsa_21 is the nominal / current-prices series shown on the dashboard. Every query below
 * MUST filter on it, otherwise districts appear 4x.
 */
export const GDDP_SOURCE = 'dsa_21';
/** dsa_gddp.pop is stored in thousands. */
const POP_FACTOR = 1000;

/** '2023-24' -> '2022-23' (also accepts '2023_24'). */
function previousYear(y: string): string | null {
  const m = /^(\d{4})([_-])(\d{2})$/.exec(y);
  if (!m) return null;
  const start = Number(m[1]) - 1;
  return `${start}${m[2]}${String(start + 1).slice(-2)}`;
}
const growth = (cur: number | null, prev: number | null | undefined) =>
  cur !== null && prev ? Math.round((cur / prev - 1) * 10000) / 100 : null;

/** Allowlisted dsa_gddp metrics; keys are the only values accepted from clients. */
export const GDDP_METRICS = {
  dist: { column: 'dist', label: 'GDDP', unit: '₹ crore' },
  per_cap_dist: { column: 'per_cap_dist', label: 'Per capita income', unit: '₹ per annum' },
  pop: { column: 'pop', label: 'Population', unit: 'thousand' },
  perc_dis_state: { column: 'perc_dis_state', label: 'Share in state GSDP', unit: '%' },
  perc_lastyr: { column: 'perc_lastyr', label: 'Growth over previous year', unit: '%' },
} as const;
export type GddpMetric = keyof typeof GDDP_METRICS;

export async function listYears(db: Db): Promise<string[]> {
  const rows = await query<{ y: string }>(db, 'SELECT DISTINCT data_year AS y FROM dsa_gddp WHERE src_table = ? AND data_year IS NOT NULL ORDER BY y', [GDDP_SOURCE]);
  return rows.map((r) => r.y);
}

export async function districtOverview(db: Db, districtId: number, year: string) {
  const [row] = await query<Record<string, number | null>>(
    db,
    `SELECT g.dist, g.per_cap_dist, g.pop, g.state, g.per_cap_state, g.perc_dis_state,
            g.tot_prim, g.tot_sec, g.tot_third,
            (SELECT COUNT(*) + 1 FROM dsa_gddp x WHERE x.src_table = g.src_table AND x.data_year = g.data_year AND x.dist > g.dist) AS gddp_rank,
            (SELECT COUNT(DISTINCT x.district_id) FROM dsa_gddp x WHERE x.src_table = g.src_table AND x.data_year = g.data_year) AS district_count
       FROM dsa_gddp g WHERE g.src_table = ? AND g.district_id = ? AND g.data_year = ? LIMIT 1`,
    [GDDP_SOURCE, districtId, year],
  );
  if (!row) return null;
  const py = previousYear(year);
  const [prev] = py
    ? await query<{ dist: number | null }>(db, 'SELECT dist FROM dsa_gddp WHERE src_table = ? AND district_id = ? AND data_year = ?', [GDDP_SOURCE, districtId, py])
    : [];
  return { ...row, pop: row.pop == null ? null : row.pop * POP_FACTOR, perc_lastyr: growth(row.dist ?? null, prev?.dist) };
}

export async function series(db: Db, districtIds: number[], metric: GddpMetric) {
  const col = GDDP_METRICS[metric].column; // from allowlist, never client text
  const years = await listYears(db);
  const rows = await query<{ district_id: number; data_year: string; v: number | null }>(
    db,
    `SELECT district_id, data_year, \`${col}\` AS v FROM dsa_gddp
      WHERE src_table = ? AND district_id IN (${districtIds.map(() => '?').join(',')})`,
    [GDDP_SOURCE, ...districtIds],
  );
  const byDistrict = new Map<number, Map<string, number | null>>();
  for (const r of rows) {
    if (!byDistrict.has(r.district_id)) byDistrict.set(r.district_id, new Map());
    byDistrict.get(r.district_id)!.set(r.data_year, r.v);
  }
  return {
    years,
    series: districtIds.map((id) => ({
      districtId: id,
      values: years.map((y) => byDistrict.get(id)?.get(y) ?? null),
    })),
  };
}

type Mix = { primary: number | null; secondary: number | null; tertiary: number | null };

export async function sectorMix(db: Db, districtId: number, year: string) {
  const [d] = await query<Mix>(
    db,
    'SELECT tot_prim AS `primary`, tot_sec AS secondary, tot_third AS tertiary FROM dsa_gddp WHERE src_table = ? AND district_id = ? AND data_year = ? LIMIT 1',
    [GDDP_SOURCE, districtId, year],
  );
  const [s] = await query<Mix>(
    db,
    'SELECT SUM(tot_prim) AS `primary`, SUM(tot_sec) AS secondary, SUM(tot_third) AS tertiary FROM dsa_gddp WHERE src_table = ? AND data_year = ?',
    [GDDP_SOURCE, year],
  );
  return { district: d ?? null, state: s ?? null };
}

export async function stateOverview(db: Db, year: string) {
  const py = previousYear(year);
  const rows = await query<{ id: number; name: string; division: string; dist: number | null; per_cap_dist: number | null; pop: number | null; perc_dis_state: number | null; prev: number | null }>(
    db,
    `SELECT d.district_id AS id, d.name_en AS name, d.division_en AS division,
            g.dist, g.per_cap_dist, g.pop, g.perc_dis_state, p.dist AS prev
       FROM dim_district d
       JOIN dsa_gddp g ON g.district_id = d.district_id AND g.src_table = ? AND g.data_year = ?
       LEFT JOIN dsa_gddp p ON p.district_id = d.district_id AND p.src_table = ? AND p.data_year = ?
      ORDER BY g.dist DESC`,
    [GDDP_SOURCE, year, GDDP_SOURCE, py ?? ''],
  );
  // The source reports Mumbai City and Mumbai Suburban with identical (combined) figures.
  // Flag the repeats so aggregates over districts don't count them twice.
  const seen = new Set<string>();
  const districts = rows.map(({ prev, pop, ...r }) => {
    const key = `${r.division}|${r.dist}|${pop}`;
    const duplicate = r.dist !== null && seen.has(key);
    seen.add(key);
    return { ...r, pop: pop === null ? null : pop * POP_FACTOR, perc_lastyr: growth(r.dist, prev), combinedWithOther: duplicate };
  });
  const trend = await query<{ year: string; gddp: number }>(
    db, 'SELECT data_year AS year, MAX(state) AS gddp FROM dsa_gddp WHERE src_table = ? GROUP BY data_year ORDER BY data_year', [GDDP_SOURCE],
  );
  const [st] = await query<{ state: number | null; per_cap_state: number | null }>(
    db, 'SELECT MAX(state) AS state, MAX(per_cap_state) AS per_cap_state FROM dsa_gddp WHERE src_table = ? AND data_year = ?', [GDDP_SOURCE, year],
  );
  return { districts, trend, state: st ?? null };
}
