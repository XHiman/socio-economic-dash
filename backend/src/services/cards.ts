import { query, type Db } from '../db.js';
import { quoteIdent, quoteList } from '../sql.js';
import type { SchemaCatalog } from '../schema.js';
import type { CardDef } from '../sections.js';

export interface CardResult {
  id: string;
  title: string;
  kind: CardDef['kind'];
  columns: CardDef['columns'];
  year: string | null;
  /** District-level values (the taluka_id IS NULL row for taluka tables). */
  total: Record<string, number | null> | null;
  rows: { taluka: string; values: Record<string, number | null> }[];
}

type Raw = Record<string, number | string | null>;

function pick(raw: Raw, keys: string[]): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const k of keys) out[k] = typeof raw[k] === 'number' ? (raw[k] as number) : null;
  return out;
}

export async function loadCard(db: Db, catalog: SchemaCatalog, card: CardDef, districtId: number): Promise<CardResult> {
  const t = catalog.table(card.table)!; // validated at startup
  const keys = card.columns.map((c) => c.key);
  const tbl = quoteIdent(card.table);
  const base: CardResult = { id: card.id, title: card.title, kind: card.kind, columns: card.columns, year: null, total: null, rows: [] };

  if (card.kind !== 'taluka') {
    const where = `district_id = ?${t.hasDupFlag ? ' AND is_dup_row = 0' : ''}${t.hasTaluka ? ' AND taluka_id IS NULL' : ''}`;
    const [row] = await query<Raw>(
      db,
      `SELECT ${t.hasYear ? 'reference_year AS _year,' : ''} ${quoteList(keys)} FROM ${tbl} WHERE ${where}
        ORDER BY ${t.hasYear ? 'reference_year DESC,' : ''} id DESC LIMIT 1`,
      [districtId],
    );
    if (!row) return base;
    return { ...base, year: (row._year as string | null) ?? null, total: pick(row, keys) };
  }

  const dup = t.hasDupFlag ? ' AND t.is_dup_row = 0' : '';
  let year: string | null = null;
  if (t.hasYear) {
    const [y] = await query<{ y: string | null }>(
      db, `SELECT MAX(t.reference_year) AS y FROM ${tbl} t WHERE t.district_id = ?${dup}`, [districtId],
    );
    year = y?.y ?? null;
  }
  const rows = await query<Raw>(
    db,
    `SELECT k.name_en AS _taluka, t.taluka_id AS _tid, ${keys.map((k) => `t.${quoteIdent(k)}`).join(', ')}
       FROM ${tbl} t LEFT JOIN dim_taluka k ON k.taluka_id = t.taluka_id
      WHERE t.district_id = ?${dup}${t.hasYear ? ' AND t.reference_year <=> ?' : ''}
      ORDER BY k.name_en`,
    t.hasYear ? [districtId, year] : [districtId],
  );
  const result: CardResult = { ...base, year };
  for (const r of rows) {
    if (r._tid === null) result.total = pick(r, keys);
    else result.rows.push({ taluka: String(r._taluka ?? `Taluka ${r._tid}`), values: pick(r, keys) });
  }
  return result;
}
