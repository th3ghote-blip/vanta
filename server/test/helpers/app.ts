/**
 * Build a Fastify instance for testing.
 *
 * Mirrors `server/src/index.ts` route registrations but:
 *   - no listen()
 *   - no worker / pricefeed startup
 *   - no Sentry, no rate limiter, no CORS (irrelevant for app.inject tests)
 *
 * Tests inject calls via `app.inject({ method, url, headers, payload })`.
 * Callers MUST register the supabase mock with `vi.mock('../lib/supabase.js', ...)`
 * BEFORE importing this module — see the .test.ts files for the pattern.
 */
import Fastify, { type FastifyInstance } from 'fastify';

import { authRoutes } from '../../src/routes/auth.js';
import { ordersRoutes } from '../../src/routes/orders.js';
import { roundsRoutes } from '../../src/routes/rounds.js';
import { robotsRoutes } from '../../src/routes/robots.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(ordersRoutes, { prefix: '/api/orders' });
  await app.register(roundsRoutes, { prefix: '/api/rounds' });
  await app.register(robotsRoutes, { prefix: '/api/robots' });
  await app.ready();
  return app;
}
