/**
 * DEV ONLY: fills the local MariaDB with SYNTHETIC data so the dashboard can be
 * developed without the real DSA load. Deterministic (seeded PRNG), refuses to run
 * in production, and skips any table not present in the loaded schema.
 * None of these numbers are real statistics.
 */
import mysql from 'mysql2/promise';

if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed in production');

const DIVISIONS: Record<string, string[]> = {
  Konkan: ['Mumbai City', 'Mumbai Suburban', 'Thane', 'Palghar', 'Raigad', 'Ratnagiri', 'Sindhudurg'],
  Nashik: ['Nashik', 'Dhule', 'Nandurbar', 'Jalgaon', 'Ahilyanagar'],
  Pune: ['Pune', 'Satara', 'Sangli', 'Solapur', 'Kolhapur'],
  'Chhatrapati Sambhajinagar': ['Chhatrapati Sambhajinagar', 'Jalna', 'Beed', 'Dharashiv', 'Latur', 'Nanded', 'Parbhani', 'Hingoli'],
  Amravati: ['Amravati', 'Akola', 'Washim', 'Buldhana', 'Yavatmal'],
  Nagpur: ['Nagpur', 'Wardha', 'Bhandara', 'Gondia', 'Chandrapur', 'Gadchiroli'],
};
const YEARS = Array.from({ length: 13 }, (_, i) => `${2011 + i}_${String(12 + i).padStart(2, '0')}`);

let s = 20260101;
const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

type Spec = { min: number; max: number; int?: boolean; agg?: 'sum' | 'avg' };
const sum = (min: number, max: number, int = true): Spec => ({ min, max, int, agg: 'sum' });
const avg = (min: number, max: number): Spec => ({ min, max, agg: 'avg' });

/** table -> columns -> value spec. `year` is the reference_year written. */
const TABLES: Record<string, { year: string; cols: Record<string, Spec>; talukas?: boolean; district?: boolean }> = {
  dsa_87: { year: '2022-23', talukas: true, cols: { tot_lite_perce: avg(70, 92), tot_lite_perce_man: avg(78, 95), tot_lite_perce_womman: avg(62, 88) } },
  dsa_115: { year: '2022-23', talukas: true, cols: { mainperf_total: sum(40000, 220000), marginalworker: sum(8000, 60000), tot_main_marginalwor: sum(50000, 280000) } },
  dsa_61a: { year: '2022-23', talukas: true, cols: { tot_sma_mid_indst: sum(40, 900), tot_jobs: sum(300, 9000, false), tot_inv: sum(20, 900, false) } },
  dsa_45: { year: '2022-23', talukas: true, cols: { comm_bank_off: sum(8, 80), branch_comm_bank: sum(8, 80), deposit_comm_bank: sum(300, 9000, false) } },
  dsa_51: { year: '2022-23', talukas: true, cols: { for_cov_area: sum(500, 40000, false), land_non_agri: sum(300, 9000, false), fallen_uncaltivated_land: sum(500, 12000, false), tot_fall_land: sum(300, 9000, false), net_area: sum(30000, 150000, false) } },
  dsa_57: { year: '2022-23', talukas: true, cols: { rainfall_day_cnt: avg(35, 70), avg_rainfall: avg(450, 2800), ref_year_avg_rainfall: avg(400, 3000) } },
  dsa_118c: { year: '2019', talukas: true, cols: { cow_and_bull: sum(15000, 90000), buff_and_redd: sum(8000, 70000), sheep: sum(3000, 40000), goat: sum(8000, 70000), horse_colt_mule: sum(20, 900), donkey: sum(10, 600), other_livestock: sum(10, 800) } },
  dsa_71: { year: '2022-23', talukas: true, cols: { tot_elecconsu_home: sum(40, 900, false), tot_elecons_commwork: sum(10, 300, false), tot_elecons_industrial: sum(30, 1500, false), tot_elecons_agri: sum(60, 1800, false), tot_elecons_total: sum(200, 4000, false) } },
  dsa_78: { year: '2022-23', talukas: true, cols: { nationalhi_road: sum(0, 120, false), lengroad_statehighway: sum(20, 300, false), lengroad_majordisroad: sum(60, 600, false), lengroad_otherdisroad: sum(100, 900, false), lengroad_ruraldisroad: sum(400, 4000, false) } },
  dsa_81: { year: '2022-23', talukas: true, cols: { tot_gov_sch: sum(20, 260), tot_local_sch: sum(10, 120), tot_priv_sch: sum(5, 90), tot_priv_non_sch: sum(10, 150) } },
  dsa_815: { year: '2022-23', talukas: true, cols: { pub_medfac_hospitals: sum(1, 6), pub_medfac_prihealcent: sum(3, 14), pub_medfac_subcent: sum(15, 70), pub_medfac_doctors: sum(10, 160), numbeds_total: sum(60, 900) } },
  dsa_817: { year: '2022-23', talukas: true, cols: { tot_num_livebir_total: sum(2000, 15000), tot_num_deathbir_total: sum(800, 6000), numchilddeath_total: sum(10, 150), numinfantdeath_total: sum(20, 250) } },
  // district-level only (no taluka_id column)
  dsa_11a: { year: '2022-23', district: true, cols: {
    area_pop_net_area: avg(300, 15000), area_pop_net_pop: avg(1000, 12000), area_pop_prop_urban: avg(15, 60), area_pop_prop_rural: avg(40, 85),
    area_pop_gen_ratio: avg(880, 1000), lit_male: avg(80, 95), lit_female: avg(65, 88), lit_tot: avg(72, 92), lit_rural: avg(68, 88),
    lit_urban: avg(82, 96), lit_sc_castes: avg(68, 90), lit_sc_tribes: avg(55, 80), loc_gov_mun_corp: { min: 0, max: 5, int: true },
    loc_gov_mun_coun: { min: 1, max: 14, int: true }, loc_gov_nag_panch: { min: 0, max: 10, int: true }, loc_gov_cutt_board: { min: 0, max: 1, int: true },
    loc_gov_punch_sam: { min: 3, max: 15, int: true }, loc_gov_gram_punch: { min: 250, max: 1600, int: true },
  } },
};

const conn = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3307),
  user: process.env.DB_ADMIN_USER ?? 'root',
  password: process.env.DB_ADMIN_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'socioecon',
});

const [tbl] = await conn.query('SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
const present = new Set((tbl as { t: string }[]).map((r) => r.t));
const [colRows] = await conn.query('SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()');
const colsOf = new Map<string, Set<string>>();
for (const r of colRows as { t: string; c: string }[]) (colsOf.get(r.t) ?? colsOf.set(r.t, new Set()).get(r.t)!).add(r.c);

async function insert(table: string, cols: string[], rows: unknown[][]) {
  if (!rows.length) return;
  await conn.query(`INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(',')}) VALUES ?`, [rows]);
}

await conn.query('SET FOREIGN_KEY_CHECKS = 0');
for (const t of ['dsa_gddp', ...Object.keys(TABLES), 'dim_taluka', 'dim_district']) if (present.has(t)) await conn.query(`TRUNCATE TABLE \`${t}\``);
await conn.query('SET FOREIGN_KEY_CHECKS = 1');

// --- dimensions -----------------------------------------------------------
const districts: { id: number; name: string; division: string; weight: number; talukas: number[] }[] = [];
let did = 0, tid = 0;
for (const [division, names] of Object.entries(DIVISIONS)) {
  for (const name of names) {
    did += 1;
    const big = ['Mumbai City', 'Mumbai Suburban', 'Pune', 'Thane', 'Nagpur', 'Nashik'].includes(name);
    const talukas = Array.from({ length: 3 + Math.floor(rnd() * 4) }, () => (tid += 1));
    districts.push({ id: did, name, division, weight: big ? between(2.5, 6) : between(0.5, 1.6), talukas });
  }
}
await insert('dim_district', ['district_id', 'name_en', 'division_en'], districts.map((d) => [d.id, d.name, d.division]));
await insert('dim_taluka', ['taluka_id', 'district_id', 'name_en'],
  districts.flatMap((d) => d.talukas.map((t, i) => [t, d.id, `${d.name} Taluka ${i + 1} (synthetic)`])));

// --- dsa_gddp -------------------------------------------------------------
const gddpRows: unknown[][] = [];
const prev = new Map<number, number>();
// Per-year snapshot of each district's GDDP/population following a noisy growth path.
const snapshot: { dist: number; pop: number }[][] = [];
{
  const cur = districts.map((d) => ({ dist: 9000 * d.weight, pop: Math.round(2_000_000 * d.weight) }));
  YEARS.forEach((_, yi) => {
    if (yi > 0) cur.forEach((c) => { c.dist *= 1 + between(0.06, 0.13); c.pop = Math.round(c.pop * 1.011); });
    snapshot.push(cur.map((c) => ({ ...c })));
  });
}
YEARS.forEach((y, yi) => {
  const snap = snapshot[yi]!;
  const state = snap.reduce((a, c) => a + c.dist, 0);
  districts.forEach((d, di) => {
    const { dist, pop } = snap[di]!;
    const p = prev.get(d.id);
    const prim = dist * between(0.06, 0.28), sec = dist * between(0.2, 0.4);
    const third = dist - prim - sec;
    gddpRows.push([
      di + 1 + yi * 100, y, y, d.id, round(prim, 3), round(sec, 4), round(third, 4), round(dist, 4), pop,
      round((dist * 1e7) / pop, 2), Math.round(state), round(((state * 1e7) / snap.reduce((a, c) => a + c.pop, 0)), 2),
      round((dist / state) * 100, 2), p ? round((dist / p - 1) * 100, 2) : null,
    ]);
    prev.set(d.id, dist);
  });
});
await insert('dsa_gddp', ['src_row', 'reference_year', 'data_year', 'district_id', 'tot_prim', 'tot_sec', 'tot_third', 'dist', 'pop', 'per_cap_dist', 'state', 'per_cap_state', 'perc_dis_state', 'perc_lastyr'], gddpRows);

// --- DSA tables -------------------------------------------------------------
for (const [table, spec] of Object.entries(TABLES)) {
  if (!present.has(table)) continue;
  const have = colsOf.get(table)!;
  const names = Object.keys(spec.cols).filter((c) => have.has(c));
  const gen = (sp: Spec) => (sp.int ? Math.round(between(sp.min, sp.max)) : round(between(sp.min, sp.max), 2));
  const header = ['src_row', 'reference_year', 'district_id', ...(spec.talukas ? ['taluka_id', 'is_total_row'] : []), ...names];
  const rows: unknown[][] = [];
  let n = 0;
  for (const d of districts) {
    if (spec.talukas) {
      const acc = Object.fromEntries(names.map((c) => [c, [] as number[]]));
      for (const t of d.talukas) {
        n += 1;
        const vals = names.map((c) => { const v = gen(spec.cols[c]!); acc[c]!.push(v); return v; });
        rows.push([n, spec.year, d.id, t, 0, ...vals]);
      }
      n += 1;
      rows.push([n, spec.year, d.id, null, 1, ...names.map((c) => {
        const xs = acc[c]!; const t = xs.reduce((a, b) => a + b, 0);
        return spec.cols[c]!.agg === 'sum' ? round(t, 2) : round(t / xs.length, 2);
      })]);
    } else {
      n += 1;
      rows.push([n, spec.year, d.id, ...names.map((c) => gen(spec.cols[c]!))]);
    }
  }
  await insert(table, header, rows);
}

console.log(`Seeded ${districts.length} districts, ${tid} talukas, ${gddpRows.length} dsa_gddp rows (SYNTHETIC).`);
await conn.end();
