import 'dotenv/config';

// ── Sentry: must be imported before everything else so the SDK can
// instrument modules at load time. Reads SENTRY_DSN from env; if unset,
// init is a no-op and the SDK stays dormant.
import * as Sentry from '@sentry/node';
const SENTRY_DSN = process.env.SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.RAILWAY_ENVIRONMENT ?? 'production',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    // Don't capture expected 4xx errors from our own routes
    ignoreErrors: [
      /HTTP 40[0-9]/,
      /AbortError/,
      /ECONNRESET/,
    ],
  });
}

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';

import { ordersRoutes } from './routes/orders.js';
import { roundsRoutes } from './routes/rounds.js';
import { robotsRoutes } from './routes/robots.js';
import { quotesRoutes } from './routes/quotes.js';
import { accountRoutes } from './routes/account.js';
import { barsRoutes } from './routes/bars.js';
import { authRoutes } from './routes/auth.js';
import { transactionsRoutes } from './routes/transactions.js';
import { adminRoutes } from './routes/admin.js';
import { alertsRoutes } from './routes/alerts.js';
import { notificationsRoutes } from './routes/notifications.js';
import { sessionsRoutes } from './routes/sessions.js';
import { achievementsRoutes } from './routes/achievements.js';
import { watchlistRoutes } from './routes/watchlist.js';
import { tradersRoutes } from './routes/traders.js';
import { startPriceFeed } from './feed/pricefeed.js';
import { getWorkerHealth } from './lib/workerHealth.js';
import { recordTiming } from './middleware/timing.js';
import { startRobotEngine } from './ai/robotEngine.js';
import { startRiskWorker } from './workers/risk.js';
import { startRoundsWorker } from './workers/rounds.js';
import { startPriceAlertsWorker } from './workers/priceAlerts.js';
import { startOrdersTriggerWorker } from './workers/ordersTrigger.js';

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = Fastify({ logger: { level: 'info' } });

// Capture every uncaught error to Sentry. Fastify's built-in error handler
// still runs (200/4xx/5xx behavior unchanged) — this just forks errors out.
app.setErrorHandler((err, req, reply) => {
  if (SENTRY_DSN && (reply.statusCode >= 500 || !reply.statusCode)) {
    Sentry.captureException(err, {
      tags: { route: req.routeOptions?.url ?? req.url, method: req.method },
    });
  }
  reply.send(err);
});

// CORS: lock to known Vercel + local-dev origins. Add custom domain here later.
const ALLOWED_ORIGINS = new Set([
  'https://vanta-jade.vercel.app',
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:3000',
]);

await app.register(cors, {
  origin: (origin, cb) => {
    // No origin (mobile app, curl, server-to-server) → allow
    if (!origin) return cb(null, true);
    // Any *.vercel.app preview deployment of our project → allow
    if (origin.endsWith('.vercel.app') && origin.includes('vanta')) return cb(null, true);
    if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'), false);
  },
  credentials: true,
});

await app.register(rateLimit, {
  global: false, // routes opt-in via { config: { rateLimit: ... } }
});

await app.register(websocket);

// Timing middleware: record p50/p95/p99 per route over rolling 5-min window.
// Uses Fastify's built-in start time so overhead is ~0 per request.
app.addHook('onResponse', (req, reply, done) => {
  const route = req.routeOptions?.url ?? req.url;
  // Skip health-check noise from the timing stats
  if (route && route !== '/health' && route !== '/api/health/workers') {
    recordTiming(route, reply.elapsedTime);
  }
  done();
});

app.get('/health', async () => ({ ok: true, ts: Date.now() }));

app.get('/api/health/workers', async () => ({
  ok: true,
  ts: Date.now(),
  workers: getWorkerHealth(),
}));

await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(accountRoutes, { prefix: '/api/account' });
await app.register(ordersRoutes, { prefix: '/api/orders' });
await app.register(roundsRoutes, { prefix: '/api/rounds' });
await app.register(robotsRoutes, { prefix: '/api/robots' });
await app.register(quotesRoutes, { prefix: '/api/quotes' });
await app.register(barsRoutes, { prefix: '/api/bars' });
await app.register(transactionsRoutes, { prefix: '/api/transactions' });
await app.register(adminRoutes, { prefix: '/api/admin' });
await app.register(alertsRoutes, { prefix: '/api/alerts' });
await app.register(notificationsRoutes, { prefix: '/api/notifications' });
await app.register(sessionsRoutes, { prefix: '/api/auth' });
await app.register(achievementsRoutes, { prefix: '/api/achievements' });
await app.register(watchlistRoutes, { prefix: '/api/watchlist' });
  await app.register(tradersRoutes, { prefix: '/api/traders' });

startPriceFeed(app);
startRobotEngine(app);
startRiskWorker(app);
startRoundsWorker(app);
startPriceAlertsWorker(app);
startOrdersTriggerWorker(app);


app
  .listen({ port: PORT, host: HOST })
  .then(() => app.log.info(`Vanta API listening on ${HOST}:${PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });