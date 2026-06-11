/**
 * QA-1.3 — VANTA Pending Limit Order E2E test
 *
 * Flow: register (via API) → sign in (UI) → Pro mode → Limit tab in OrderEntry →
 *       place BTC buy-limit 5% below current price (guaranteed not to fill) →
 *       verify it appears in the Pending tab of TradeBook →
 *       cancel it → verify it disappears → sign out.
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

test.describe('VANTA Limit Order', () => {
  test('register → sign in → Limit tab → place BTC buy-limit → verify Pending → cancel → verify gone → sign out', async ({ page }) => {
    // ── 1. Register a fresh demo account via the backend API (email auth) ─────
    const email = `e2e+lim${Date.now()}@vanta.test`;
    const password = 'e2e-limit-pw-1';
    const regRes = await page.request.post(`${API_URL}/api/auth/register`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email, password },
    });
    expect(regRes.ok(), `register failed: ${regRes.status()} ${regRes.statusText()}`).toBeTruthy();

    // ── 2. Get current BTC price for computing the limit trigger ─────────────
    // We use this to set the trigger 5% below ask so it won't fill immediately.
    let triggerPrice = 60000; // fallback
    try {
      const quotesRes = await page.request.get(`${API_URL}/api/quotes`);
      if (quotesRes.ok()) {
        const quotesBody = await quotesRes.json() as any;
        // Response shape: { quotes: [...] } or array
        const quotes = Array.isArray(quotesBody) ? quotesBody : (quotesBody.quotes ?? []);
        const btc = quotes.find((q: any) => q.symbol === 'BTCUSD');
        if (btc?.ask) {
          triggerPrice = Math.floor(btc.ask * 0.95); // 5% below ask
        }
      }
    } catch {
      // use fallback — the server validates; if the fallback is wrong we'll see an error
    }

    // ── 3. Open the app ───────────────────────────────────────────────────────
    await page.goto(BASE_URL);
    await page.waitForURL(/login/, { timeout: 20_000 });

    // ── 4. Sign in ───────────────────────────────────────────────────────────
    await page.locator('[data-testid="login-email-input"]').fill(email);
    await page.locator('[data-testid="login-password-input"]').fill(password);
    await page.locator('[data-testid="login-submit"]').click();

    // ── 5. Wait for redirect to trade tab ────────────────────────────────────
    await page.waitForURL(/tabs\/trade/, { timeout: 25_000 });

    // ── 6. Dismiss onboarding carousel if it appears ─────────────────────────
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

    // ── 7. Ensure we're in Pro mode ───────────────────────────────────────────
    // The buy-button and Limit tab are part of the ProTradeScreen / OrderEntry.
    const proTab = page.locator('[data-testid="mode-pro"]');
    await expect(proTab).toBeVisible({ timeout: 15_000 });
    // Click Pro only if not already active (new accounts default to Pro,
    // but guard in case state persisted from a previous run)
    const isProActive = await proTab.evaluate((el) =>
      el.getAttribute('data-testid') === 'mode-pro'
    );
    if (isProActive) await proTab.click();

    // ── 8. Switch OrderEntry to Limit mode ───────────────────────────────────
    const limitTabBtn = page.locator('[data-testid="order-kind-limit"]');
    await expect(limitTabBtn).toBeVisible({ timeout: 20_000 });
    await limitTabBtn.click();

    // ── 9. Enter the trigger price ────────────────────────────────────────────
    const triggerInput = page.locator('[data-testid="limit-trigger-price"]');
    await expect(triggerInput).toBeVisible({ timeout: 10_000 });
    await triggerInput.fill(String(triggerPrice));

    // ── 10. Place the buy-limit order ─────────────────────────────────────────
    const buyBtn = page.locator('[data-testid="buy-button"]');
    await expect(buyBtn).toBeVisible({ timeout: 10_000 });
    await buyBtn.click();

    // ── 11. Switch to Pending tab in TradeBook ────────────────────────────────
    const pendingTab = page.locator('[data-testid="tab-pending"]');
    await expect(pendingTab).toBeVisible({ timeout: 10_000 });
    await pendingTab.click();

    // ── 12. Verify the pending order appears ──────────────────────────────────
    // Row shows the symbol and BUY LIMIT text.
    await expect(page.getByText('BTCUSD').first()).toBeVisible({ timeout: 15_000 });
    // The row subtitle contains "BUY LIMIT" for a buy limit order
    await expect(page.getByText(/BUY LIMIT/i).first()).toBeVisible({ timeout: 10_000 });

    // ── 13. Cancel the pending order ─────────────────────────────────────────
    // close-trade-button works for both open and pending (TradeBook calls
    // api.cancelPendingOrder for pending status).
    const closeBtn = page.locator('[data-testid="close-trade-button"]').first();
    await expect(closeBtn).toBeVisible({ timeout: 10_000 });
    await closeBtn.click();

    // ── 14. Verify it disappears from Pending tab ─────────────────────────────
    // After cancellation the row is removed. We wait briefly for optimistic UI.
    await page.waitForTimeout(2_000);

    // The row with "BUY LIMIT" should be gone, OR the pending tab shows "No pending orders"
    const pendingRowGone =
      (await page.getByText(/BUY LIMIT/i).count()) === 0 ||
      (await page.getByText('No pending orders').isVisible({ timeout: 3_000 }).catch(() => false));
    expect(pendingRowGone, 'pending order should be gone after cancellation').toBeTruthy();

    // ── 15. Sign out ─────────────────────────────────────────────────────────
    await page.getByText('Profile').click();
    await expect(page.getByText('Sign Out')).toBeVisible({ timeout: 10_000 });
    await page.getByText('Sign Out').click();

    // ── 16. Confirm redirect back to login ────────────────────────────────────
    await page.waitForURL(/login/, { timeout: 15_000 });
    await expect(page.locator('input').first()).toBeVisible();
  });
});
