import { query, type Db } from '../db.js';
import { quoteIdent } from '../sql.js';
import type { SchemaCatalog, TableInfo } from '../schema.js';

export const EXPLORE_ROW_LIMIT = 1000;

export function describeTables(catalog: SchemaCatalog) {
  return [...catalog.tables.values()]
    .filter((t) => t.hasDistrict)
    .map((t) => ({
      name: t.name,
      hasTaluka: t.hasTaluka,
      hasYear: t.hasYear,
      columns: catalog.dataColumns(t).map((c) => c.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
}

export async function exploreTable(
  db: Db, table: TableInfo, catalog: SchemaCatalog,
  opts: { districtId: number; columns: string[]; level: 'district' | 'taluka' },
) {
  const allowed = new Set(catalog.dataColumns(table).map((c) => c.name));
  const cols = opts.columns.filter((c) => allowed.has(c));
  if (!cols.length) return { columns: [] as string[], rows: [] as Record<string, unknown>[] };
  const conds = ['t.district_id = ?'];
  if (table.hasDupFlag) conds.push('t.is_dup_row = 0');
  if (table.hasTaluka) conds.push(opts.level === 'taluka' ? 't.taluka_id IS NOT NULL' : 't.taluka_id IS NULL');
  const rows = await query<Record<string, unknown>>(
    db,
    `SELECT ${table.hasYear ? 't.reference_year AS _year,' : ''}
            ${table.hasTaluka ? 'k.name_en AS _taluka,' : ''}
            ${table.hasTitle ? 't.title AS _title,' : ''}
            ${cols.map((c) => `t.${quoteIdent(c)}`).join(', ')}
       FROM ${quoteIdent(table.name)} t ${table.hasTaluka ? 'LEFT JOIN dim_taluka k ON k.taluka_id = t.taluka_id' : ''}
      WHERE ${conds.join(' AND ')}
      ORDER BY ${table.hasYear ? 't.reference_year DESC,' : ''} t.id
      LIMIT ${EXPLORE_ROW_LIMIT}`,
    [opts.districtId],
  );
  return { columns: cols, rows };
}
