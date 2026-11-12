import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { SchemaCatalog } from './schema.js';
import { applyUnits, validateSections } from './sections.js';
import { loadUnits } from './services/units.js';
import { createApp } from './app.js';

const cfg = loadConfig();
const db = createPool(cfg);
const catalog = await SchemaCatalog.load(db, cfg.DB_NAME);
if (!catalog.table('dsa_gddp')) throw new Error(`dsa_gddp not found in database "${cfg.DB_NAME}" - is the schema loaded?`);
const sections = validateSections(catalog, (m) => console.warn(`[config] ${m}`));
const units = await loadUnits(db, cfg.DB_NAME, (m) => console.warn(`[config] ${m}`));
applyUnits(sections, units);
console.log(`[startup] ${catalog.tables.size} dsa_* tables, ${sections.reduce((n, s) => n + s.cards.length, 0)} cards`);

const server = createApp(cfg, { db, catalog, sections }).listen(cfg.PORT, cfg.HOST, () => {
  console.log(`[startup] API listening on http://${cfg.HOST}:${cfg.PORT}`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    server.close(() => { void db.end().finally(() => process.exit(0)); });
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
