import mysql from 'mysql2/promise';
import type { Config } from './config.js';

export type Db = mysql.Pool;

const QUERY_TIMEOUT_MS = 8000;

export function createPool(cfg: Config): Db {
  return mysql.createPool({
    host: cfg.DB_HOST,
    port: cfg.DB_PORT,
    user: cfg.DB_USER,
    password: cfg.DB_PASSWORD,
    database: cfg.DB_NAME,
    connectionLimit: 10,
    decimalNumbers: true,
    dateStrings: true,
    multipleStatements: false,
    charset: 'utf8mb4',
    ssl: cfg.DB_SSL ? { minVersion: 'TLSv1.2' } : undefined,
  });
}

/** Parameterised query with a hard timeout. Identifiers must never be interpolated by callers. */
export async function query<T = Record<string, unknown>>(
  db: Db,
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  const [rows] = await db.query({ sql, values, timeout: QUERY_TIMEOUT_MS });
  return rows as T[];
}
