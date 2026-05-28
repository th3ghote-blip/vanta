/**
 * R.8 — VANTA E2E smoke test
 *
 * Flow: register (via API) → sign in (UI) → place 0.01 BTC market buy →
 *       close the position → sign out → confirm redirect to login.
 *
 * Runs against the live Vercel/Railway URLs by default.
 * Override via env vars:
 *   VANTA_URL     — frontend (default: https://vanta-jade.vercel.app)
 *   VANTA_API_URL — backend  (default: https://vanta-server-production.up.railway.app)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.VANTA_URL ?? 'https://vanta-jade.vercel.app';
const API_URL =
  process.env.VANTA_API_URL ?? 'https://vanta-server-production.up.railway.app';

test.describe('VANTA smoke', () => {
  test('register → sign in → trade 0.01 BTC → close → sign out', async ({ page }) => {
    // ── 1. Register a fresh demo account via the backend API ─────────────────
    // This avoids the UI sign-up flow (which requires saving credentials) and
    // guarantees a clean $10 k demo balance on every run.
    const regRes = await page.request.post(`${API_URL}/api/auth/register`, {
      headers: { 'Content-Type': 'application/json' },
      data: {},
    });
    expect(regRes.ok(), `register failed: ${regRes.status()} ${regRes.statusText()}`).toBeTruthy();
    const { login, password } = (await regRes.json()) as {
      login: number;
      password: string;
    };

    // ── 2. Open the app — should land on login ───────────────────────────────
    await page.goto(BASE_URL);
    await page.waitForURL(/login/, { timeout: 20_000 });

    // ── 3. Sign in ───────────────────────────────────────────────────────────
    await page.locator('[data-testid="login-account-input"]').fill(String(login));
    await page.locator('[data-testid="login-password-input"]').fill(password);
    await page.locator('[data-testid="login-submit"]').click();

    // ── 4. Wait for redirect to trade tab ────────────────────────────────────
    // Expo Router strips the (tabs) group from the URL, so it's /trade not /tabs/trade
    await page.waitForURL(/\/trade/, { timeout: 25_000 });

    // ── 5. Dismiss onboarding carousel if it appears ─────────────────────────
    // New accounts see a 3-step onboarding; skip it if present.
    try {
      const getStarted = page.getByText("I've saved them", { exact: false });
      if (await getStarted.isVisible({ timeout: 2_000 })) {
        await getStarted.click();
        await page.waitForURL(/\/trade|onboarding/, { timeout: 10_000 });
      }
      const continueBtn = page.getByText('Get started', { exact: false });
      if (await continueBtn.isVisible({ timeout: 2_000 })) {
        await continueBtn.click();
        await page.waitForURL(/\/trade/, { timeout: 10_000 });
      }
    } catch {
      // onboarding not shown — continue
    }

    // ── 6. Wait for a live BTC buy-price to appear in the OrderEntry ──────────
    const buyBtn = page.locator('[data-testid="buy-button"]');
    await expect(buyBtn).toBeVisible({ timeout: 30_000 });

    // ── 7. Place the trade (default volume is 0.01 BTC for BTCUSD) ───────────
    await buyBtn.click();

    // ── 8. Wait for the position to appear in the Open tab of TradeBook ──────
    // The trade row shows the symbol name.
    await expect(page.getByText('BTCUSD').first()).toBeVisible({ timeout: 15_000 });

    // ── 9. Close the position ────────────────────────────────────────────────
    // The close button carries accessibilityLabel="Close trade" (maps to
    // aria-label in the browser) — added in the same commit as this test.
    const closeBtn = page.locator('[data-testid="close-trade-button"]').first();
    await expect(closeBtn).toBeVisible({ timeout: 10_000 });
    await closeBtn.click();

    // Brief pause — optimistic UI removes the row immediately, profit/loss
    // toast may fire.
    await page.waitForTimeout(2_000);

    // ── 10. Sign out ─────────────────────────────────────────────────────────
    // Navigate to Profile tab (bottom nav).
    await page.getByText('Profile').click();
    await expect(page.getByText('Sign Out')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Sign Out').click();

    // ── 11. Confirm redirect back to login ───────────────────────────────────
    await page.waitForURL(/login/, { timeout: 15_000 });
    await expect(page.locator('input').first()).toBeVisible();
  });
});
