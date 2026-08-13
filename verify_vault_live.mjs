import fs from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const e = {};
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).forEach((l) => {
    const m = l.trim().match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m) e[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  });
  return e;
}
const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function resolve() {
  const cols = ["vault_keys", "gemini_api_keys_free", "gemini_api_key", "gemini_api_key_paid", "openrouter_api_key"];
  const res = await supabase.from("founder_config").select("key_name,key_value").in("key_name", cols);
  const map = {};
  for (const row of res.data || []) if (row.key_name) map[row.key_name] = row.key_value || "";
  let gem = [];
  try {
    const p = map.vault_keys ? JSON.parse(map.vault_keys) : null;
    if (p && typeof p === "object" && Array.isArray(p.gemini)) gem.push(...p.gemini.map(String));
  } catch (_) {}
  try {
    const f = map.gemini_api_keys_free ? JSON.parse(map.gemini_api_keys_free) : [];
    if (Array.isArray(f)) gem.push(...f.map(String));
  } catch (_) {}
  if (map.gemini_api_key) gem.push(map.gemini_api_key);
  if (map.gemini_api_key_paid) gem.push(map.gemini_api_key_paid);
  gem = [...new Set(gem.map((k) => String(k).trim()).filter((k) => k.length > 0))];
  const accepted = gem.filter((k) => /^(AIza|AQ\.)/.test(k.trim()));
  return accepted.find((k) => k.length > 10) || process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "";
}

// (A) live write: place key into a DIFFERENT column (gemini_api_key)
let resolved = await resolve();
console.log("=== SEBELUM write kolom lain ===");
console.log("resolved_key_len:", resolved.length, "prefix:", resolved.slice(0, 8));

await supabase.from("founder_config").upsert(
  { key_name: "gemini_api_key", key_value: resolved },
  { onConflict: "key_name" }
);
console.log("=== (A) LIVE WRITE ke kolom gemini_api_key selesai ===");

resolved = await resolve();
console.log("=== SESUDAH write kolom lain ===");
console.log("resolved_key_len:", resolved.length, "prefix:", resolved.slice(0, 8));

// (C) probe generateContent across models — find a usable one for THIS key
async function timedFetch(url, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } catch (e) {
        return { status: 0, text: () => Promise.resolve("ABORT/NET:" + (e?.name || e)) };
  } finally {
    clearTimeout(t);
  }
}

const candidates = [
  "gemini-flash-latest", "gemini-pro-latest", "gemini-flash-lite-latest",
  "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash",
  "gemini-3.1-flash", "gemini-3.1-flash-lite", "gemini-2.5-pro",
  "gemini-1.5-flash",
];
for (const m of candidates) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent?key=" + resolved;
  const rr = await timedFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Balas sekata: ok" }] }] }),
  });
  const bb = await rr.text();
  const snippet = bb.slice(0, 140).replace(/\s+/g, " ");
  console.log("model:", m, "| status:", rr.status, "| body:", snippet.slice(0, 140));
}


