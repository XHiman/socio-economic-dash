import { query, type Db } from '../db.js';

/** Table the units are maintained in: (table_name, column_name, unit), e.g. ('dsa_71', 'tot_elecons_total', 'million kWh'). */
export const UNIT_TABLE = 'dim_unit';

/** "table.column" -> unit. Empty (with a warning) when the table isn't there yet. */
export async function loadUnits(db: Db, database: string, warn: (msg: string) => void): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const [exists] = await query<{ n: number }>(
    db, 'SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [database, UNIT_TABLE],
  );
  if (!exists?.n) { warn(`${UNIT_TABLE} not found - using built-in units only`); return out; }
  const rows = await query<{ t: string; c: string; u: string | null }>(
    db, `SELECT table_name AS t, column_name AS c, unit AS u FROM \`${UNIT_TABLE}\``,
  );
  for (const r of rows) if (r.u) out.set(`${r.t}.${r.c}`, r.u);
  return out;
}
