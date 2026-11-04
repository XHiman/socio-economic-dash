import { query, type Db } from './db.js';

export interface ColumnInfo {
  name: string;
  numeric: boolean;
}
export interface TableInfo {
  name: string;
  columns: Map<string, ColumnInfo>;
  hasDistrict: boolean;
  hasTaluka: boolean;
  hasYear: boolean;
  hasDupFlag: boolean;
  hasTotalFlag: boolean;
  hasTitle: boolean;
}

const NUMERIC = new Set(['tinyint', 'smallint', 'mediumint', 'int', 'bigint', 'decimal', 'float', 'double']);
/** Bookkeeping columns that are never exposed as data. */
const HIDDEN = new Set(['id', 'src_row', 'district_id', 'taluka_id', 'is_total_row', 'is_dup_row']);

export class SchemaCatalog {
  private constructor(readonly tables: Map<string, TableInfo>) {}

  static async load(db: Db, database: string): Promise<SchemaCatalog> {
    const rows = await query<{ t: string; c: string; dt: string }>(
      db,
      `SELECT TABLE_NAME AS t, COLUMN_NAME AS c, DATA_TYPE AS dt
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE 'dsa\_%'
        ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [database],
    );
    const tables = new Map<string, TableInfo>();
    for (const r of rows) {
      let t = tables.get(r.t);
      if (!t) {
        t = {
          name: r.t, columns: new Map(), hasDistrict: false, hasTaluka: false, hasYear: false,
          hasDupFlag: false, hasTotalFlag: false, hasTitle: false,
        };
        tables.set(r.t, t);
      }
      t.columns.set(r.c, { name: r.c, numeric: NUMERIC.has(r.dt.toLowerCase()) });
      if (r.c === 'district_id') t.hasDistrict = true;
      if (r.c === 'taluka_id') t.hasTaluka = true;
      if (r.c === 'reference_year') t.hasYear = true;
      if (r.c === 'is_dup_row') t.hasDupFlag = true;
      if (r.c === 'is_total_row') t.hasTotalFlag = true;
      if (r.c === 'title') t.hasTitle = true;
    }
    return new SchemaCatalog(tables);
  }

  table(name: string): TableInfo | undefined {
    return this.tables.get(name);
  }

  /** Data columns a client may read from a table (numeric only, no bookkeeping). */
  dataColumns(table: TableInfo): ColumnInfo[] {
    return [...table.columns.values()].filter((c) => c.numeric && !HIDDEN.has(c.name));
  }
}
