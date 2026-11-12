import { z } from 'zod';

const bool = z.enum(['true', 'false']).default('false').transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default('127.0.0.1'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().default(3306),
  DB_NAME: z.string().default('socioecon'),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_SSL: bool,
  DB_ADMIN_USER: z.string().default('root'),
  DB_ADMIN_PASSWORD: z.string().default(''),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (parsed.success && parsed.data.NODE_ENV === 'production') {
    // The API only ever reads: an admin account or a template password in production is a misconfiguration, not a preference.
    const { DB_USER, DB_PASSWORD } = parsed.data;
    if (/^(root|admin|xhi_dev)$/i.test(DB_USER)) throw new Error('Invalid environment: DB_USER must be the SELECT-only account in production');
    if (/^change_?me/i.test(DB_PASSWORD)) throw new Error('Invalid environment: DB_PASSWORD is still the template placeholder');
  }
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}
