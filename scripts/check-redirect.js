/**
 * check-redirect.js
 * -----------------------------------------------------------------------------
 * Membantu memverifikasi konfigurasi URL redirect auth sebelum commit/deploy.
 * Menjalankan:
 *   node scripts/check-redirect.js            (cek lokal, tanpa Supabase API)
 *
 * Untuk cek konfigurasi Supabase (Site URL + allowlist redirect):
 *   set SUPABASE_ACCESS_TOKEN=<personal-access-token>  lalu jalankan node scripts/check-redirect.js
 *
 * Personal Access Token: https://supabase.com/dashboard/account/tokens
 * (bukan anon key / service role key — token khusus management API)
 * -----------------------------------------------------------------------------
 */
"use strict";

const fs = require("fs");
const path = require("path");

/* ------------------------------------------------------------------ */
/* 1. Baca .env.local sederhana (tanpa dependency eksternal)          */
/* ------------------------------------------------------------------ */
function loadEnv(file) {
  const out = {};
  try {
    const raw = fs.readFileSync(file, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      // Hapus tanda kutip di nilai
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      let key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
  } catch {
    /* file tidak ada -> kosongkan */
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 2. Salinan logika getAppUrl (sama seperti lib/url.ts)              */
/* ------------------------------------------------------------------ */
// Meniru getAppUrl(req): saat development paksa localhost; lalu origin menang
// -> host (localhost=>http, else https) -> window.location.origin (tidak ada di
// Node CLI) -> NEXT_PUBLIC_APP_URL || localhost.
function resolveAppUrl(headers) {
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  const origin = headers && headers.origin;
  if (origin) return origin;
  const host = headers && headers.host;
  if (host) return host.includes("localhost") ? `http://${host}` : `https://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/* ------------------------------------------------------------------ */
/* 3. Cek konfigurasi Supabase via Management API                     */
/* ------------------------------------------------------------------ */
async function checkSupabaseAuthConfig(supabaseUrl, accessToken) {
  const ref = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : null;
  if (!ref) {
    console.log("  (project ref tidak ditemukan dari NEXT_PUBLIC_SUPABASE_URL)");
    return;
  }
  if (!accessToken) {
    console.log(
      "  (atur SUPABASE_ACCESS_TOKEN agar bisa membaca Site URL & Redirect URLs dari Supabase)"
    );
    return;
  }

  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/config/auth`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      console.log(`  Gagal memuat config auth (HTTP ${res.status}). Token salah / tidak punya akses?`);
      return;
    }
    const cfg = await res.json();
    const siteUrl = cfg.site_url || "(tidak ada)";
    const allowList = cfg.uri_allow_list || [];

    console.log("-----------------------------------------------------");
    console.log(`  Site URL Supabase   : ${siteUrl}`);
    console.log("  Redirect URLs (allowlist):");
    allowList.forEach((u) => console.log(`    - ${u}`));

    const localOk = allowList.some(
      (u) => u === "http://localhost:3000/**" || u === "http://localhost:3000" || u.includes("localhost:3000")
    );
    console.log("-----------------------------------------------------");
    console.log(`  [${localOk ? "OK" : "PERLU TAMBAH"}] http://localhost:3000/** masuk allowlist? ${localOk ? "Ya" : "TIDAK — tambahkan di Supabase Dashboard -> Authentication -> URL Configuration -> Redirect URLs"}`);
    if (siteUrl.includes("localhost")) {
      console.log("  [OK] Site URL menunjuk ke localhost (cocok untuk uji lokal).");
    } else {
      console.log("  [PERLU DIUBAH] Site URL menunjuk ke NOT-LOCALHOST. Untuk uji lokal, Set Site URL = http://localhost:3000 pada Auth -> URL Configuration. Jika dibiarkan Vercel, Supabase akan balik ke Vercel saat redirect, sehingga email/Google login nyasar ke Vercel.");
    }
  } catch (err) {
    console.log("  Gagal terkoneksi ke Supabase Management API:", err.message);
  }
}

/* ------------------------------------------------------------------ */
/* 4. Main                                                             */
/* ------------------------------------------------------------------ */
async function main() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const env = loadEnv(envPath);
  const isEnvLoaded = Object.keys(env).length > 0;

  console.log("=== VERIFIKASI URL REDIRECT / AUTH ===");
  console.log("");
  if (!isEnvLoaded) {
    console.log("Tidak menemukan .env.local di root. Buat dulu dari .env.example.");
  } else {
    console.log(".env.local ditemukan.");
    console.log("  NEXT_PUBLIC_APP_URL  =", env.NEXT_PUBLIC_APP_URL || "(kosong)");
    console.log("  NEXT_PUBLIC_SITE_URL =", env.NEXT_PUBLIC_SITE_URL || "(kosong)");
  }
  console.log("");

  // Simulasi origin sesuai environment berjalan
  console.log("Hasil resolve getAppUrl (dinamis sesuai request):");
  console.log(`  Saat di LOCALHOST   -> ${resolveAppUrl({ origin: "http://localhost:3000", host: "localhost:3000" })}`);
  console.log(`  Saat di VERCEL      -> ${resolveAppUrl({ origin: "https://ai-nusantara-main.vercel.app", host: "ai-nusantara-main.vercel.app" })}`);
  console.log(`  Saat origin kosong  -> ${resolveAppUrl({ origin: null, host: "ai-nusantara-main.vercel.app" })} (host non-localhost => https)`);
  console.log("");
  console.log("Artinya kode akan otomatis memakai localhost saat uji lokal,");
  console.log("dan domain Vercel saat diproduksi — tanpa ubah env manual.");
  console.log("");

  // Cek konfigurasi Supabase (opsional)
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN;
  if (supabaseUrl) {
    console.log(">>> Cek konfigurasi Supabase Auth:");
    await checkSupabaseAuthConfig(supabaseUrl, accessToken);
  } else {
    console.log(">>> NEXT_PUBLIC_SUPABASE_URL kosong, lewati cek Supabase.");
  }
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
