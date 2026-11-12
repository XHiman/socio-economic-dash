import { query, type Db } from '../db.js';
import { quoteIdent, quoteList } from '../sql.js';
import type { SchemaCatalog } from '../schema.js';
import type { CardDef } from '../sections.js';

type Vals = Record<string, number | null>;
interface YearData { total: Vals | null; rows: { taluka: string; values: Vals }[] }

export interface CardResult {
  id: string;
  title: string;
  kind: CardDef['kind'];
  columns: CardDef['columns'];
  /** Source table, e.g. dsa_11a, for the "DSA table 11a" reference line. */
  table: string;
  stackable: boolean;
  /** Rendered as a plain card without a full-screen view. */
  static: boolean;
  year: string | null;
  /** District-level values (the taluka_id IS NULL row for taluka tables). */
  total: Vals | null;
  rows: YearData['rows'];
}

/** Every reference year of a card. Tables without a year column live under the '' key and have `years: []`. */
export interface CardHistory extends Omit<CardResult, 'year' | 'total' | 'rows'> {
  years: string[];
  data: Record<string, YearData>;
}

type Raw = Record<string, number | string | null>;

function pick(raw: Raw, keys: string[]): Vals {
  const out: Vals = {};
  for (const k of keys) out[k] = typeof raw[k] === 'number' ? (raw[k] as number) : null;
  return out;
}

const meta = (card: CardDef): Omit<CardHistory, 'years' | 'data'> => ({
  id: card.id, title: card.title, kind: card.kind, columns: card.columns, table: card.table, stackable: !!card.stackable, static: !!card.static,
});

const startYear = (y: string) => /^\d{4}/.exec(y)?.[0] ?? '';

/** The year a selection resolves to: the latest reference year starting at or before it ('2023_24' matches '2022-23'). */
export function resolveYear(years: string[], selected?: string): string | undefined {
  const s = selected ? startYear(selected) : '';
  if (!s) return years.at(-1);
  return years.filter((y) => startYear(y) !== '' && startYear(y) <= s).at(-1);
}

/** One year of a history (latest, or the one a selection resolves to) in the flat shape the cards use. */
export function atYear(h: CardHistory, selected?: string): CardResult {
  const { years, data, ...rest } = h;
  const y = years.length ? resolveYear(years, selected) ?? null : null;
  const d = data[y ?? ''];
  return { ...rest, year: y, total: d?.total ?? null, rows: d?.rows ?? [] };
}

export async function loadCardHistory(db: Db, catalog: SchemaCatalog, card: CardDef, districtId: number): Promise<CardHistory> {
  const t = catalog.table(card.table)!; // validated at startup
  // Weight columns are fetched too (to combine rates across districts) but aren't shown unless they are also card columns.
  const keys = [...new Set(card.columns.flatMap((c) => (c.weightBy ? [c.key, c.weightBy] : [c.key])))];
  const tbl = quoteIdent(card.table);
  const filter = card.rowFilter ? ` AND ${quoteIdent(card.rowFilter.column)} = ?` : '';
  const data: Record<string, YearData> = {};
  const at = (y: string | null) => (data[y ?? ''] ??= { total: null, rows: [] });

  if (card.kind !== 'taluka') {
    const where = `district_id = ?${t.hasDupFlag ? ' AND is_dup_row = 0' : ''}${t.hasTaluka ? ' AND taluka_id IS NULL' : ''}${filter}`;
    const rows = await query<Raw>(
      db,
      `SELECT ${t.hasYear ? 'reference_year AS _year,' : ''} ${quoteList(keys)} FROM ${tbl} WHERE ${where}
        ORDER BY ${t.hasYear ? 'reference_year,' : ''} id`,
      card.rowFilter ? [districtId, card.rowFilter.value] : [districtId],
    );
    for (const r of rows) at((r._year as string | null) ?? null).total = pick(r, keys); // later id wins
  } else {
    const dup = t.hasDupFlag ? ' AND t.is_dup_row = 0' : '';
    const rows = await query<Raw>(
      db,
      `SELECT ${t.hasYear ? 't.reference_year AS _year,' : ''} k.name_en AS _taluka, t.taluka_id AS _tid, ${keys.map((k) => `t.${quoteIdent(k)}`).join(', ')}
         FROM ${tbl} t LEFT JOIN dim_taluka k ON k.taluka_id = t.taluka_id
        WHERE t.district_id = ?${dup}
        ORDER BY k.name_en`,
      [districtId],
    );
    for (const r of rows) {
      const d = at((r._year as string | null) ?? null);
      if (r._tid === null) d.total = pick(r, keys);
      else d.rows.push({ taluka: String(r._taluka ?? `Taluka ${r._tid}`), values: pick(r, keys) });
    }
  }
  return { ...meta(card), years: Object.keys(data).filter(Boolean).sort(), data };
}

/** Combine per-district values for one column: sum for counts; mean for rates/averages, weighted when weights are given. */
function combine(values: (number | null)[], agg: 'sum' | 'avg' | undefined, weights?: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null);
  if (!v.length) return null;
  if (agg === 'avg' && weights) {
    let num = 0, den = 0;
    values.forEach((x, i) => { const w = weights[i]; if (x !== null && w != null && w > 0) { num += x * w; den += w; } });
    if (den) return num / den;
  }
  const sum = v.reduce((a, b) => a + b, 0);
  return agg === 'avg' ? sum / v.length : sum;
}

/** State-level history: kpis/breakdown aggregate all districts; taluka cards are split by district instead. */
export async function loadStateCardHistory(
  db: Db, catalog: SchemaCatalog, card: CardDef, districts: { id: number; name: string }[],
): Promise<CardHistory> {
  const histories = await Promise.all(districts.map((d) => loadCardHistory(db, catalog, card, d.id)));
  const keys = [...new Set(card.columns.flatMap((c) => (c.weightBy ? [c.key, c.weightBy] : [c.key])))];
  const colOf = (k: string) => card.columns.find((c) => c.key === k);
  const aggOf = (k: string) => colOf(k)?.agg;
  const years = [...new Set(histories.flatMap((h) => h.years))].sort();
  const data: Record<string, YearData> = {};

  for (const y of years.length ? years : ['']) {
    // Per district: the most recent year at or before y (a district that hasn't reported y yet keeps its last figures).
    const perDistrict = histories.map((h, i) => {
      const hy = y === '' ? '' : h.years.filter((x) => x <= y).at(-1) ?? '';
      const d = h.data[hy];
      let values = d?.total ?? null;
      if (!values && d?.rows.length) {
        values = Object.fromEntries(keys.map((k) => [k, combine(d.rows.map((x) => x.values[k] ?? null), aggOf(k))]));
      }
      return { name: districts[i]!.name, values };
    }).filter((d): d is { name: string; values: Vals } => d.values !== null);

    if (!perDistrict.length) continue;
    const total = Object.fromEntries(keys.map((k) => {
      const w = colOf(k)?.weightBy;
      return [k, combine(perDistrict.map((d) => d.values[k] ?? null), aggOf(k), w ? perDistrict.map((d) => d.values[w] ?? null) : undefined)];
    }));
    data[y] = {
      total,
      rows: card.kind !== 'taluka' ? [] : perDistrict.map((d) => ({ taluka: d.name, values: d.values })).sort((a, b) => a.taluka.localeCompare(b.taluka)),
    };
  }
  return { ...meta(card), title: card.title.replace(/ by taluka$/, ' by district'), years: Object.keys(data).filter(Boolean).sort(), data };
}
