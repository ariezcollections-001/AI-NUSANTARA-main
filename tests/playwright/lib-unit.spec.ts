import { test, expect } from "@playwright/test";
import { retrieveSumber, SUMBER_FEATURES } from "../../lib/sumberValid";
import { rateLimit, _clearRateLimitStore } from "../../lib/rateLimit";

// Spec ini PAGE-LESS (tidak memakai `page`/browser): murni transpile TS oleh
// Playwright/esbuild, jalan tanpa dev-server, API key, atau Supabase.
// Menjaga semua asersi deterministik dan cepat.

test.describe("sumberValid :: retrieveSumber", () => {
  test("cocokkan berdasarkan kata kunci fitur & kembalikan label akurat", () => {
    const out = retrieveSumber(
      "gen-rpp",
      "saya butuh RPP untuk pembelajaran Kurikulum Merdeka",
    );
    expect(out).not.toBe("");
    expect(out).toContain("Struktur umum Modul Ajar / RPP Kurikulum Merdeka");
        expect(out).toContain("Komponen");
  });

  test("deteksi kata kunci HOTS/Bloom pada fitur buat-soal", () => {
    const out = retrieveSumber("buat-soal", "buatkan soal HOTS tipe 4");
    expect(out).toContain("Taksonomi Bloom");
  });

  test("fitur tidak terdaftar (chat-ai) kembalikan string kosong", () => {
    const out = retrieveSumber("chat-ai", "bagaimana kabarmu?");
    expect(out).toBe("");
  });

  test("fitur dikenal tapi tidak ada keyword yang cocok → fallback panduan umum", () => {
    const out = retrieveSumber("gen-rpp", "qwerty angga pixel benda");
    expect(out).not.toBe("");
    expect(out).not.toContain("__"); // placeholder tak boleh lolot ke output
  });

  test("jumlah fitur sumber terdaftar cukup", () => {
    expect(SUMBER_FEATURES).toBeGreaterThanOrEqual(12);
  });
});

test.describe("rateLimit :: gate per user/IP", () => {
  test.afterEach(() => _clearRateLimitStore());

  test("izinkan hingga limit, blokir setelahnya dengan retryAfter > 0", () => {
    let blocked = false;
    let retry = 0;
    for (let i = 0; i < 7; i++) {
      const r = rateLimit("user@demo.local", 5, 60_000);
      if (!r.ok) {
        blocked = true;
        retry = r.retryAfterSec;
      }
    }
    expect(blocked).toBe(true);
    expect(Number.isInteger(retry)).toBe(true);
    expect(retry).toBeGreaterThan(0);
  });

  test("kunci berbeda diproses independen", () => {
    expect(rateLimit("user-a", 3, 60_000).ok).toBe(true);
    expect(rateLimit("user-b", 3, 60_000).ok).toBe(true);
    expect(rateLimit("user-a", 3, 60_000).ok).toBe(true);
    expect(rateLimit("user-a", 3, 60_000).ok).toBe(true); // 4th → blocked
    expect(rateLimit("user-a", 3, 60_000).ok).toBe(false);
    expect(rateLimit("user-b", 3, 60_000).ok).toBe(true); // masih aman, belum ke limit
  });

  test("_clearRateLimitStore mereset jendela", () => {
    rateLimit("reset-key", 1, 60_000);
    expect(rateLimit("reset-key", 1, 60_000).ok).toBe(false);
    _clearRateLimitStore();
    expect(rateLimit("reset-key", 1, 60_000).ok).toBe(true);
  });
});
