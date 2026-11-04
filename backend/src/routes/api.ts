import { Router, type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { z } from 'zod';
import { query, type Db } from '../db.js';
import type { SchemaCatalog } from '../schema.js';
import type { SectionDef } from '../sections.js';
import * as gddp from '../services/gddp.js';
import { loadCard } from '../services/cards.js';
import { describeTables, exploreTable } from '../services/explore.js';

export interface ApiContext { db: Db; catalog: SchemaCatalog; sections: SectionDef[] }

export class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const id = z.coerce.number().int().positive().max(65535);
const year = z.string().regex(/^[0-9]{4}[_-][0-9]{2}$/);
const idList = z.string().regex(/^\d+(,\d+){0,39}$/).transform((s) => [...new Set(s.split(',').map(Number))]);
const slug = z.string().regex(/^[a-z0-9_-]{1,64}$/);
const metricKey = z.enum(Object.keys(gddp.GDDP_METRICS) as [gddp.GddpMetric, ...gddp.GddpMetric[]]);

function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const r = schema.safeParse(value);
  if (!r.success) throw new HttpError(400, 'Invalid request parameters');
  return r.data;
}

const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

export function apiRouter(ctx: ApiContext): Router {
  const { db, catalog, sections } = ctx;
  const r = Router();
  r.use((_req, res, next) => { res.setHeader('Cache-Control', 'public, max-age=60'); next(); });

  const districtExists = async (districtId: number) => {
    const rows = await query(db, 'SELECT 1 FROM dim_district WHERE district_id = ?', [districtId]);
    if (!rows.length) throw new HttpError(404, 'District not found');
  };
  const resolveYear = async (raw: unknown): Promise<string> => {
    const years = await gddp.listYears(db);
    const y = raw === undefined ? years.at(-1) : parse(year, raw);
    if (!y || !years.includes(y)) throw new HttpError(404, 'Year not available');
    return y;
  };

  r.get('/health', wrap(async (_req, res) => {
    await query(db, 'SELECT 1');
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true });
  }));

  r.get('/meta', wrap(async (_req, res) => {
    const years = await gddp.listYears(db);
    res.json({ years, latestYear: years.at(-1) ?? null, metrics: gddp.GDDP_METRICS });
  }));

  r.get('/districts', wrap(async (_req, res) => {
    const rows = await query<{ id: number; name: string; division: string }>(
      db, 'SELECT district_id AS id, name_en AS name, division_en AS division FROM dim_district ORDER BY name_en',
    );
    res.json(rows);
  }));

  r.get('/state', wrap(async (req, res) => {
    const y = await resolveYear(req.query.year);
    res.json({ year: y, ...(await gddp.stateOverview(db, y)) });
  }));

  r.get('/districts/:id/overview', wrap(async (req, res) => {
    const districtId = parse(id, req.params.id);
    await districtExists(districtId);
    const y = await resolveYear(req.query.year);
    res.json({ year: y, overview: await gddp.districtOverview(db, districtId, y) });
  }));

  r.get('/districts/:id/sector-mix', wrap(async (req, res) => {
    const districtId = parse(id, req.params.id);
    await districtExists(districtId);
    const y = await resolveYear(req.query.year);
    res.json({ year: y, ...(await gddp.sectorMix(db, districtId, y)) });
  }));

  r.get('/gddp/series', wrap(async (req, res) => {
    const districts = parse(idList, req.query.districts);
    const metric = parse(metricKey, req.query.metric ?? 'dist');
    res.json({ metric, ...(await gddp.series(db, districts, metric)) });
  }));

  r.get('/sections', (_req, res) => {
    res.json(sections.map((s) => ({
      id: s.id, title: s.title, description: s.description,
      cards: s.cards.map((c) => ({ id: c.id, title: c.title, kind: c.kind })),
    })));
  });

  r.get('/districts/:id/sections/:sectionId', wrap(async (req, res) => {
    const districtId = parse(id, req.params.id);
    const section = sections.find((s) => s.id === parse(slug, req.params.sectionId));
    if (!section) throw new HttpError(404, 'Section not found');
    await districtExists(districtId);
    const cards = await Promise.all(section.cards.map((c) => loadCard(db, catalog, c, districtId)));
    res.json({ id: section.id, title: section.title, cards });
  }));

  r.get('/explore/tables', (_req, res) => { res.json(describeTables(catalog)); });

  r.get('/explore/:table', wrap(async (req, res) => {
    const table = catalog.table(parse(z.string().regex(/^dsa_[a-z0-9_]{1,59}$/), req.params.table));
    if (!table || !table.hasDistrict) throw new HttpError(404, 'Table not found');
    const districtId = parse(id, req.query.district);
    await districtExists(districtId);
    const level = parse(z.enum(['district', 'taluka']).default('district'), req.query.level);
    const requested = req.query.columns === undefined
      ? catalog.dataColumns(table).slice(0, 12).map((c) => c.name)
      : parse(z.string().regex(/^[a-z0-9_]+(,[a-z0-9_]+){0,59}$/), req.query.columns).split(',');
    res.json({ table: table.name, ...(await exploreTable(db, table, catalog, { districtId, columns: requested, level })) });
  }));

  r.use((_req, _res, next) => next(new HttpError(404, 'Not found')));
  return r;
}
