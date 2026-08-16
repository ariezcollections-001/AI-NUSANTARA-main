// scripts/kill-port.js — bersihkan SEMUA proses node/next dev yang tersisa (cegah EADDRINUSE).
// Dipanggil otomatis oleh npm melalui script "predev" sebelum `next dev`.
// Alasan: setiap `npm run dev` yang terinterupsi meninggalkan orphan node.exe yang tetap
// menggenggam port 3000/3001/.../3010; bila port ganda sudah penuh, server baru EADDRINUSE.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function configuredPort() {
  try {
    if (process.env.PORT) return String(process.env.PORT);
    const txt = fs.readFileSync(path.join(root, ".env.local"), "utf8");
    const m = txt.split(/\r?\n/).find((l) => /^\s*PORT\s*=/.test(l));
    if (m) return m.match(/\d+/)?.[0] ?? "";
  } catch {
    /* .env.local tidak ada */
  }
  return "";
}

// Port yang dibersihkan: default Next 3000 + range fallback otomatis 3000-3019 + PORT konfigurasi.
function portsToClean() {
  const range = [];
  for (let p = 3000; p <= 3019; p++) range.push(String(p));
  const cfg = configuredPort();
  if (cfg && !range.includes(cfg)) range.push(cfg);
  return range;
}

function pidsUsingPorts(ports) {
  const pids = new Set();
  try {
    const out = execSync("netstat -ano", { encoding: "utf8" });
    const re = new RegExp(":(" + ports.join("|") + ")\\s+\\S+\\s+(?:LISTENING|TIME_WAIT)\\s+(\\d+)", "g");
    let m;
    while ((m = re.exec(out))) {
      const pid = m[2];
      if (pid !== "0") pids.add(pid);
    }
  } catch {
    /* netstat gagal — abaikan */
  }
  return pids;
}

function killAll(pids) {
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      console.log(`[kill-port] Proses stale ${pid} dihentikan`);
    } catch {
      /* proses sudah mati */
    }
  }
}

const ports = portsToClean();
for (let i = 0; i < 5; i++) {
  const stale = pidsUsingPorts(ports);
  if (stale.size === 0) break;
  killAll(stale);
}

if (pidsUsingPorts(ports).size === 0) {
  console.log(`[kill-port] Port ${ports.join(", ")} bersih — siap start dev.`);
} else {
  console.warn(`[kill-port] Masih ada yang mengunci port. Matikan manual: taskkill /PID <pid> /F`);
}