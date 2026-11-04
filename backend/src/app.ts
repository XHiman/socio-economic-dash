import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import type { Config } from './config.js';
import { apiRouter, HttpError, type ApiContext } from './routes/api.js';

export function createApp(cfg: Config, ctx: ApiContext) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', cfg.TRUST_PROXY);
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
  app.use(compression());
  app.use(rateLimit({
    windowMs: 60_000, limit: cfg.RATE_LIMIT_PER_MINUTE, standardHeaders: 'draft-7', legacyHeaders: false,
  }));
  // Read-only API: reject anything but GET/HEAD outright.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    next();
  });
  app.use('/api', apiRouter(ctx));
  app.use((_req, res) => { res.status(404).json({ error: 'Not found' }); });
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    // Never leak SQL/stack details to clients.
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, err);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
