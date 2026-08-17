/**
 * Rate limiter in-memory sederhana (per proses).
 * Edge-safe & murni (hanya globals Map/Date). Cocok untuk monolit/Edge dev.
 * Untuk multi-instance produksi, ganti dengan penyimpanan eksternal
 * (Redis/memcached) — di luar cakupan utilitas lokal ini.
 *
 * Nota: karena berada dalam memori proses, konter reset otomatis tiap
 * `windowMs`. Gunakan `_clearRateLimitStore()` hanya dalam unit test.
 */
type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

/** Bersihkan seluruh state (pemakaian: unit test & SSR-safe reset). */
export function _clearRateLimitStore(): void {
  store.clear();
}

/**
 * Eval-scope: kunci unik (email user, atau IP-anon).
 * @param key            identitas pelaku (email || ip).
 * @param limit          jumlah request maksimal dalam jendela.
 * @param windowMs       durasi jendela dalam ms.
 * @returns `{ ok: true }` bila masih di bawah kuota, atau `{ ok: false, retryAfterSec }`.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  let b = store.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    store.set(key, b);
  }
  b.count++;
  if (b.count > limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfterSec: 0 };
}
