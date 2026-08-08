import { test, expect } from '@playwright/test';

test.describe('Auth UI checks', () => {
  test('Login page: Google button active, manual gated by checkbox', async ({ page }) => {
    await page.goto('/login');

    const googleBtn = page.locator('button:has-text("Masuk dengan Akun Google")');
    const manualBtn = page.locator('button:has-text("Masuk Aplikasi")');
    const checkbox = page.locator('input[type=checkbox]#terms-validation');

    await expect(googleBtn).toBeVisible();
    await expect(googleBtn).toBeEnabled();

    await expect(manualBtn).toBeVisible();
    await expect(manualBtn).toBeDisabled();

    await checkbox.check();
    await expect(manualBtn).toBeEnabled();
  });

  test('Clicking Google triggers signInWithOAuth', async ({ page }) => {
    await page.goto('/login');

    // Inject a stub for supabase.auth.signInWithOAuth to observe calls
    await page.addInitScript(() => {
      // @ts-ignore
      window.__PLAYWRIGHT_STUB_CALLED = false;
      // @ts-ignore
      window.supabase = window.supabase || {};
      // @ts-ignore
      window.supabase.auth = window.supabase.auth || {};
      // @ts-ignore
      window.supabase.auth.signInWithOAuth = () => { // eslint-disable-line
        // @ts-ignore
        window.__PLAYWRIGHT_STUB_CALLED = true;
        return Promise.resolve({ data: null, error: null });
      };
    });

    const googleBtn = page.locator('button:has-text("Masuk dengan Akun Google")');
    await googleBtn.click();

    const called = await page.evaluate(() => (window as any).__PLAYWRIGHT_STUB_CALLED === true);
    expect(called).toBe(true);
  });

  test('Unauthenticated access to /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('GET /api/auth/resolve-redirect returns /login for unauthenticated', async ({ page, request }) => {
    const resp = await page.request.get('/api/auth/resolve-redirect');
    const json = await resp.json();
    expect(json.target).toBe('/login');
  });

  test('LoginForm component: Google active and info text present', async ({ page }) => {
    await page.goto('/');
    const googleBtn = page.locator('button:has-text("Masuk Cepat dengan Google")');
    await expect(googleBtn).toBeVisible();
    await expect(googleBtn).toBeEnabled();
  });

  test('Founder login: checkbox required for submit', async ({ page }) => {
    await page.goto('/founder-login');
    const submit = page.locator('button:has-text("Masuk Founder")');
    const founderCheckbox = page.locator('input#founder-login-terms');

    await expect(submit).toBeVisible();
    await expect(submit).toBeDisabled();
    await founderCheckbox.check();
    await expect(submit).toBeEnabled();
  });

  test('Auth confirm: mock resolve-redirect to dashboard and continue', async ({ page }) => {
    // Provide a mocked authenticated user to the client before any script runs
    await page.addInitScript(() => {
      // @ts-ignore - test hook
      window.__PLAYWRIGHT_MOCK_USER = {
        id: 'mock-user-id',
        email: 'mock@example.com',
        user_metadata: { full_name: 'Mock User' }
      };
    });

    // Intercept server API to return dashboard target
    await page.route('**/api/auth/resolve-redirect', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ target: '/dashboard' }),
      });
    });

    await page.goto('/auth/confirm');
    const continueBtn = page.locator('button:has-text("Lanjutkan ke Dashboard")');
    const terms = page.locator('input#terms-confirm');

    await expect(continueBtn).toBeVisible();
    await expect(continueBtn).toBeDisabled();
    await terms.check();
    await expect(continueBtn).toBeEnabled();

    // click and assert navigation
    await Promise.all([
      page.waitForURL('/dashboard', { timeout: 5000 }),
      continueBtn.click(),
    ]);
    await expect(page).toHaveURL(/dashboard/);
  });
});
