import 'dotenv/config';
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
import { startPriceFeed } from './feed/pricefeed.js';
import { startRobotEngine } from './ai/robotEngine.js';
import { startRiskWorker } from './workers/risk.js';
import { startRoundsWorker } from './workers/rounds.js';

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = Fastify({ logger: { level: 'info' } });

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

app.get('/health', async () => ({ ok: true, ts: Date.now() }));

await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(accountRoutes, { prefix: '/api/account' });
await app.register(ordersRoutes, { prefix: '/api/orders' });
await app.register(roundsRoutes, { prefix: '/api/rounds' });
await app.register(robotsRoutes, { prefix: '/api/robots' });
await app.register(quotesRoutes, { prefix: '/api/quotes' });
await app.register(barsRoutes, { prefix: '/api/bars' });

startPriceFeed(app);
startRobotEngine(app);
startRiskWorker(app);
startRoundsWorker(app);

app
  .listen({ port: PORT, host: HOST })
  .then(() => app.log.info(`Vanta API listening on ${HOST}:${PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
