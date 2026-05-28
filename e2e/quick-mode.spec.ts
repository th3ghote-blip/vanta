/**
 * QA-1.2 — VANTA Quick Mode E2E test
 *
 * Flow: register (via API) → sign in (UI) → switch to Quick tab →
 *       select $10 stake → select 60s duration → click Up (BTC) →
 *       verify round appears in active list → sign out.
 *
 * We do NOT wait for settlement (60s round would time out CI).
 * Instead we verify the round row is present with correct data right after placing it.
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

test.describe('VANTA Quick Mode', () => {
  test('register → sign in → Quick tab → place $10 BTC Up 60s → verify active round → sign out', async ({ page }) => {
    // ── 1. Register a fresh demo account via the backend API ─────────────────
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
    await page.waitForURL(/tabs\/trade/, { timeout: 25_000 });

    // ── 5. Dismiss onboarding carousel if it appears ─────────────────────────
    try {
      const getStarted = page.getByText("I've saved them", { exact: false });
      if (await getStarted.isVisible({ timeout: 2_000 })) {
        await getStarted.click();
        await page.waitForURL(/tabs\/trade|onboarding/, { timeout: 10_000 });
      }
      const continueBtn = page.getByText('Get started', { exact: false });
      if (await continueBtn.isVisible({ timeout: 2_000 })) {
        await continueBtn.click();
        await page.waitForURL(/tabs\/trade/, { timeout: 10_000 });
      }
    } catch {
      // onboarding not shown — continue
    }

    // ── 6. Switch to Quick mode ───────────────────────────────────────────────
    // New accounts default to Pro mode. Click the "Quick" segment to switch.
    const quickTab = page.locator('[data-testid="mode-quick"]');
    await expect(quickTab).toBeVisible({ timeout: 15_000 });
    await quickTab.click();

    // ── 7. Verify the Up button is present (QuickTradeScreen rendered) ────────
    const upBtn = page.locator('[data-testid="quick-up-button"]');
    await expect(upBtn).toBeVisible({ timeout: 20_000 });

    // ── 8. Select $10 stake (it's the default, but click explicitly) ──────────
    const stake10 = page.locator('[data-testid="stake-10"]');
    await expect(stake10).toBeVisible({ timeout: 10_000 });
    await stake10.click();

    // ── 9. Select 60s duration ────────────────────────────────────────────────
    const dur60 = page.locator('[data-testid="duration-60s"]');
    await expect(dur60).toBeVisible({ timeout: 10_000 });
    await dur60.click();

    // ── 10. Place the Up round ────────────────────────────────────────────────
    await upBtn.click();

    // ── 11. Verify success feedback banner appears ────────────────────────────
    const feedbackOk = page.locator('[data-testid="quick-feedback-ok"]');
    await expect(feedbackOk).toBeVisible({ timeout: 15_000 });

    // ── 12. Verify the round row appears in Active Rounds ─────────────────────
    // The ActiveRounds component shows "ACTIVE ROUNDS (N)" and a row with the
    // symbol name and direction arrow.
    await expect(page.getByText(/ACTIVE ROUNDS/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('BTCUSD').first()).toBeVisible({ timeout: 10_000 });
    // The row shows "▲ UP" for a buy direction
    await expect(page.getByText(/▲ UP/).first()).toBeVisible({ timeout: 5_000 });

    // ── 13. Sign out ─────────────────────────────────────────────────────────
    await page.getByText('Profile').click();
    await expect(page.getByText('Sign Out')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Sign Out').click();

    // ── 14. Confirm redirect back to login ────────────────────────────────────
    await page.waitForURL(/login/, { timeout: 15_000 });
    await expect(page.locator('input').first()).toBeVisible();
  });
});
