/**
 * QA-4.3 — Rate limit tests.
 *
 * Uses a standalone Fastify app (not buildApp) because the test app helper
 * doesn't register @fastify/rate-limit. The plugin's default hook is
 * 'onRequest', which fires before validation, so even minimal/invalid
 * bodies count toward the rate limit counter.
 *
 * Thresholds from auth.ts:
 *   /api/auth/login    → max=5  per minute → 6th request is 429
 *   /api/auth/register → max=10 per minute → 11th request is 429
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import {
  supabaseAdmin as mockSupa,
  authUser as mockAuthUser,
} from './helpers/supabaseMock.js';
import { authRoutes } from '../src/routes/auth.js';

beforeAll(() => {
  process.env.SUPABASE_URL = 'http://localhost:0/fake';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-key';
  process.env.ANTHROPIC_API_KEY = 'fake-anthropic-key';
});

vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: mockSupa,
  authUser: mockAuthUser,
}));
vi.mock('../src/lib/push.js', () => ({
  sendPush: vi.fn(async () => ({ ok: true })),
  sendPushChecked: vi.fn(async () => ({ ok: true })),
}));

/** Build a fresh app with rate-limit enabled — separate from the shared test helper. */
async function buildRateLimitApp() {
  const app = Fastify({ logger: false, trustProxy: true });
  await app.register(rateLimit, {
    global: false, // routes opt-in via config.rateLimit
  });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.ready();
  return app;
}

// ── Login rate limit ──────────────────────────────────────────────────────────

describe('Rate limiting — /api/auth/login', () => {
  it('first 5 requests are not 429', async () => {
    const app = await buildRateLimitApp();

    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { login: 12345678, password: 'test-password-ok' },
      });
      expect(res.statusCode).not.toBe(429);
    }

    await app.close();
  });

  it('6th request returns 429 with Retry-After header', async () => {
    const app = await buildRateLimitApp();

    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { login: 12345678, password: 'test-password-ok' },
      });
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: 12345678, password: 'test-password-ok' },
    });

    expect(res.statusCode).toBe(429);
    expect(
      res.headers['retry-after'] ?? res.headers['x-ratelimit-reset'],
    ).toBeDefined();

    await app.close();
  });
});

// ── Register rate limit ───────────────────────────────────────────────────────

describe('Rate limiting — /api/auth/register', () => {
  it('first 10 requests are not 429', async () => {
    const app = await buildRateLimitApp();

    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {},
      });
      expect(res.statusCode).not.toBe(429);
    }

    await app.close();
  });

  it('11th request returns 429', async () => {
    const app = await buildRateLimitApp();

    for (let i = 0; i < 10; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {},
      });
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {},
    });

    expect(res.statusCode).toBe(429);

    await app.close();
  });
});
