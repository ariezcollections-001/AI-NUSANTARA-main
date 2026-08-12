/**
 * setup-auth-config.js
 * -----------------------------------------------------------------------------
 * Sekali-jalan: mengisi konfigurasi auth Supabase (Redirect URLs / allowlist)
 * secara otomatis, tanpa perlu klik-klik manual di dashboard — setel sekali,
 * lalu localhost & Vercel bekerja otomatis (no bolak-balik Site URL).
 *
 * Menjalankan:
 *   node scripts/setup-auth-config.js
 * atau (dipasang sebagai npm script):
 *   npm run supabase:setup-auth
 *
 * Kredensial (salah satu):
 *   SUPABASE_ACCESS_TOKEN=<personal access token>   (disarankan)
 *     -> https://supabase.com/dashboard/account/tokens
 *   ATAU otomatis fallback ke SUPABASE_SERVICE_ROLE_KEY di .env.local
 *
 * Yang dilakukan:
 *   1. Baca NEXT_PUBLIC_SUPABASE_URL dari .env.local -> tentukan project ref.
 *   2. GET  /v1/projects/{ref}/config/auth  (baca Site URL + Redirect URLs saat ini)
 *   3. Merge dengan daftar yang diinginkan (localhost + Vercel), tanpa menimpa
 *      URL lain yang sudah ada.
 *   4. PUT  /v1/projects/{ref}/config/auth  untuk menyimpan.
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
/* 2. Konfigurasi yang diinginkan                                      */
/* ------------------------------------------------------------------ */
// Redirect URLs yang HARUS selalu ada (localhost + produksi).
const WANTED_REDIRECTS = [
  "http://localhost:3000/**",
  "https://ai-nusantara-main.vercel.app/**",
];

// Domain produksi (dipakai untuk pesan/log saja; Site URL TIDAK diubah).
const PROD_URL = "https://ai-nusantara-main.vercel.app";

/* ------------------------------------------------------------------ */
/* 3. Helper API                                                       */
/* ------------------------------------------------------------------ */
async function authApi(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  return { res, body: await res.json().catch(() => null) };
}

/* ------------------------------------------------------------------ */
/* 4. Main                                                             */
/* ------------------------------------------------------------------ */
async function main() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const env = loadEnv(envPath);

  const supabaseUrl =
    env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const accessToken =
    process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN;
  const serviceRoleKey =
    env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error("✖ NEXT_PUBLIC_SUPABASE_URL tidak ditemukan di .env.local");
    process.exit(1);
  }
  if (!accessToken && !serviceRoleKey) {
    console.error(
      "✖ Tidak ada kredensial.\n" +
        "  Set SUPABASE_ACCESS_TOKEN (disarankan) atau pastikan SUPABASE_SERVICE_ROLE_KEY ada di .env.local."
    );
    process.exit(1);
  }

  const token = accessToken || serviceRoleKey;
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  const base = `https://api.supabase.com/v1/projects/${ref}/config/auth`;

  console.log("=== SETUP AUTH CONFIG SUPABASE ===");
  console.log(`  Project ref  : ${ref}`);
  console.log(
    `  Kredensial   : ${accessToken ? "SUPABASE_ACCESS_TOKEN" : "SUPABASE_SERVICE_ROLE_KEY (fallback)"}`
  );
  console.log("");

  // GET current config
  console.log("  Membaca konfigurasi saat ini ...");
  const { res: getRes, body: getBody } = await authApi(base, token);
  if (!getRes.ok) {
    console.error(`✖ Gagal membaca config auth (HTTP ${getRes.status}).`);
    console.error(
      "  Kemungkinan token tidak punya akses / salah. Pastikan memakai Personal Access Token."
    );
    if (getBody && getBody.message) console.error("  Msg:", getBody.message);
    process.exit(1);
  }

  const currentSiteUrl = getBody.site_url || "(kosong)";
  // API mengembalikan uri_allow_list bisa berupa string (dipisah koma) atau array.
  let currentAllowList = [];
  const rawList = getBody.uri_allow_list;
  if (typeof rawList === "string") {
    currentAllowList = rawList
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (Array.isArray(rawList)) {
    currentAllowList = rawList;
  }

  console.log(`  Site URL saat ini   : ${currentSiteUrl}`);
  console.log(
    `  Redirect saat ini   : ${currentAllowList.length ? currentAllowList.join(", ") : "(kosong)"}`
  );
  console.log("");

  // Merge: gabungkan yang sudah ada + yang diinginkan (tanpa duplikat)
  const mergedArr = [...new Set([...currentAllowList, ...WANTED_REDIRECTS])];
  const mergedArrAdd = mergedArr.filter((u) => !currentAllowList.includes(u));

  if (mergedArrAdd.length === 0) {
    console.log("  ✔ Semua Redirect URL yang diinginkan sudah ada. Tidak ada perubahan.");
    console.log("  Site URL dibiarkan apa adanya (tidak diubah oleh script ini).");
    return;
  }

  console.log("  Akan menambahkan Redirect URL:");
  mergedArrAdd.forEach((u) => console.log(`    + ${u}`));
  console.log("");

  // PATCH config — API mengharapkan uri_allow_list berupa STRING dengan
  // separator KOMA (baris baru tidak dipertahankan / di-strip oleh API).
  console.log("  Menyimpan ke Supabase ...");
  const { res: putRes, body: putBody } = await authApi(base, token, {
    method: "PATCH",
    body: JSON.stringify({ uri_allow_list: mergedArr.join(",") }),
  });

  if (!putRes.ok) {
    console.error(`✖ Gagal menyimpan config auth (HTTP ${putRes.status}).`);
    if (putBody && putBody.message) console.error("  Msg:", putBody.message);
    process.exit(1);
  }

  console.log("  ✔ Berhasil disimpan.");
  console.log("");
  console.log("  Daftar Redirect URL sekarang:");
  const savedList =
    typeof putBody.uri_allow_list === "string"
      ? putBody.uri_allow_list.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean)
      : Array.isArray(putBody.uri_allow_list)
        ? putBody.uri_allow_list
        : mergedArr;
  savedList.forEach((u) => console.log(`    - ${u}`));
  console.log("");
  console.log("  NOTE: Site URL tetap:", putBody.site_url || currentSiteUrl, "(tidak diubah).");
  console.log("  Localhost & Vercel kini otomatis, tanpa bolak-balik edit.");
  console.log(
    "  (Ingat: untuk login Google, pastikan callback OAuth juga mengizinkan localhost & Vercel.)"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

