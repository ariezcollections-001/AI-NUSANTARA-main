# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Auth UI checks >> Auth confirm: mock resolve-redirect to dashboard and continue
- Location: tests\playwright\auth.spec.ts:76:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 5000ms exceeded.
=========================== logs ===========================
waiting for navigation to "/dashboard" until "load"
  navigated to "http://localhost:3000/login"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]
  - alert [ref=e11]
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Selamat Datang" [level=1] [ref=e20]
      - paragraph [ref=e21]: Masuk ke akun AI Nusantara Anda
    - generic [ref=e22]:
      - generic [ref=e23]:
        - generic [ref=e24]:
          - text: Email
          - textbox "nama@email.com" [ref=e29]
        - generic [ref=e30]:
          - text: Kata Sandi
          - generic [ref=e31]:
            - textbox "••••••••" [ref=e35]
            - button "Tampilkan kata sandi" [ref=e36]
        - generic [ref=e40]:
          - checkbox "Saya setuju dengan Syarat Layanan dan Kebijakan Privasi resmi BIKIN AI" [ref=e41]
          - generic [ref=e42] [cursor=pointer]: Saya setuju dengan Syarat Layanan dan Kebijakan Privasi resmi BIKIN AI
        - button "Masuk Aplikasi" [disabled]
      - generic [ref=e43]: — atau —
      - button "Masuk dengan Akun Google" [ref=e48] [cursor=pointer]
    - paragraph [ref=e54]:
      - text: Belum punya akun?
      - link "Daftar sekarang" [ref=e55] [cursor=pointer]:
        - /url: /register
    - link "← Kembali ke Beranda" [ref=e59] [cursor=pointer]:
      - /url: /
    - paragraph [ref=e61]: 🔐 Secure login protected by Google Cloud OAuth protocol.
```

# Test source

```ts
  7   |     const googleBtn = page.locator('button:has-text("Masuk dengan Akun Google")');
  8   |     const manualBtn = page.locator('button:has-text("Masuk Aplikasi")');
  9   |     const checkbox = page.locator('input[type=checkbox]#terms-validation');
  10  | 
  11  |     await expect(googleBtn).toBeVisible();
  12  |     await expect(googleBtn).toBeEnabled();
  13  | 
  14  |     await expect(manualBtn).toBeVisible();
  15  |     await expect(manualBtn).toBeDisabled();
  16  | 
  17  |     await checkbox.check();
  18  |     await expect(manualBtn).toBeEnabled();
  19  |   });
  20  | 
  21  |   test('Clicking Google triggers signInWithOAuth', async ({ page }) => {
  22  |     await page.goto('/login');
  23  | 
  24  |     // Inject a stub for supabase.auth.signInWithOAuth to observe calls
  25  |     await page.addInitScript(() => {
  26  |       // @ts-ignore
  27  |       window.__PLAYWRIGHT_STUB_CALLED = false;
  28  |       // @ts-ignore
  29  |       window.supabase = window.supabase || {};
  30  |       // @ts-ignore
  31  |       window.supabase.auth = window.supabase.auth || {};
  32  |       // @ts-ignore
  33  |       window.supabase.auth.signInWithOAuth = () => { // eslint-disable-line
  34  |         // @ts-ignore
  35  |         window.__PLAYWRIGHT_STUB_CALLED = true;
  36  |         return Promise.resolve({ data: null, error: null });
  37  |       };
  38  |     });
  39  | 
  40  |     const googleBtn = page.locator('button:has-text("Masuk dengan Akun Google")');
  41  |     await googleBtn.click();
  42  | 
  43  |     const called = await page.evaluate(() => (window as any).__PLAYWRIGHT_STUB_CALLED === true);
  44  |     expect(called).toBe(true);
  45  |   });
  46  | 
  47  |   test('Unauthenticated access to /dashboard redirects to /login', async ({ page }) => {
  48  |     await page.goto('/dashboard');
  49  |     await expect(page).toHaveURL(/login/);
  50  |   });
  51  | 
  52  |   test('GET /api/auth/resolve-redirect returns /login for unauthenticated', async ({ page, request }) => {
  53  |     const resp = await page.request.get('/api/auth/resolve-redirect');
  54  |     const json = await resp.json();
  55  |     expect(json.target).toBe('/login');
  56  |   });
  57  | 
  58  |   test('LoginForm component: Google active and info text present', async ({ page }) => {
  59  |     await page.goto('/');
  60  |     const googleBtn = page.locator('button:has-text("Masuk Cepat dengan Google")');
  61  |     await expect(googleBtn).toBeVisible();
  62  |     await expect(googleBtn).toBeEnabled();
  63  |   });
  64  | 
  65  |   test('Founder login: checkbox required for submit', async ({ page }) => {
  66  |     await page.goto('/founder-login');
  67  |     const submit = page.locator('button:has-text("Masuk Founder")');
  68  |     const founderCheckbox = page.locator('input#founder-login-terms');
  69  | 
  70  |     await expect(submit).toBeVisible();
  71  |     await expect(submit).toBeDisabled();
  72  |     await founderCheckbox.check();
  73  |     await expect(submit).toBeEnabled();
  74  |   });
  75  | 
  76  |   test('Auth confirm: mock resolve-redirect to dashboard and continue', async ({ page }) => {
  77  |     // Provide a mocked authenticated user to the client before any script runs
  78  |     await page.addInitScript(() => {
  79  |       // @ts-ignore - test hook
  80  |       window.__PLAYWRIGHT_MOCK_USER = {
  81  |         id: 'mock-user-id',
  82  |         email: 'mock@example.com',
  83  |         user_metadata: { full_name: 'Mock User' }
  84  |       };
  85  |     });
  86  | 
  87  |     // Intercept server API to return dashboard target
  88  |     await page.route('**/api/auth/resolve-redirect', (route) => {
  89  |       route.fulfill({
  90  |         status: 200,
  91  |         contentType: 'application/json',
  92  |         body: JSON.stringify({ target: '/dashboard' }),
  93  |       });
  94  |     });
  95  | 
  96  |     await page.goto('/auth/confirm');
  97  |     const continueBtn = page.locator('button:has-text("Lanjutkan ke Dashboard")');
  98  |     const terms = page.locator('input#terms-confirm');
  99  | 
  100 |     await expect(continueBtn).toBeVisible();
  101 |     await expect(continueBtn).toBeDisabled();
  102 |     await terms.check();
  103 |     await expect(continueBtn).toBeEnabled();
  104 | 
  105 |     // click and assert navigation
  106 |     await Promise.all([
> 107 |       page.waitForURL('/dashboard', { timeout: 5000 }),
      |            ^ TimeoutError: page.waitForURL: Timeout 5000ms exceeded.
  108 |       continueBtn.click(),
  109 |     ]);
  110 |     await expect(page).toHaveURL(/dashboard/);
  111 |   });
  112 | });
  113 | 
```