"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  FileText,
  Key,
  LogOut,
  Settings2,
  ShieldAlert,
  Users,
  ArrowLeftRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function getPlatformName(): string {
  if (typeof window === "undefined") return "BIKIN AI";
  try {
    return localStorage.getItem("founder_config_platform_name") || "BIKIN AI";
  } catch {
    return "BIKIN AI";
  }
}

interface FounderDashboardShellProps {
  founderEmail: string;
  initialMaintenance: boolean;
  initialPackageLimit: string;
  initialPackagePrice: string;
  initialApiKeyPreview: string;
}

interface FounderUser {
  id: string;
  email: string;
  role: string;
  character_balance: number;
  device_fingerprint: string | null;
  created_at: string;
  is_banned: boolean;
}

interface SecurityLogEntry {
  id: number;
  event_type: string;
  ip_address: string | null;
  details: Record<string, unknown> | null;
  timestamp: string;
}

interface FeatureSetting {
  id: number;
  feature_slug: string;
  feature_name: string;
  system_prompt: string;
  temperature: number;
  is_active: boolean;
  seo_title: string | null;
  seo_description: string | null;
}

export default function FounderDashboardShell({
  founderEmail,
  initialMaintenance,
  initialPackageLimit,
  initialPackagePrice,
  initialApiKeyPreview,
}: FounderDashboardShellProps) {
  const router = useRouter();
  const [maintenanceMode, setMaintenanceMode] = useState(initialMaintenance);
  const [apiKeyPreview, setApiKeyPreview] = useState(initialApiKeyPreview);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [packageLimit, setPackageLimit] = useState(initialPackageLimit);
  const [packagePrice, setPackagePrice] = useState(initialPackagePrice);
  const [founderUsers, setFounderUsers] = useState<FounderUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<SecurityLogEntry[]>([]);
  const [featureItems, setFeatureItems] = useState<FeatureSetting[]>([]);
  const [featureDrafts, setFeatureDrafts] = useState<Record<number, Partial<FeatureSetting>>>({});
  const [loadingAction, setLoadingAction] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [platformName, setPlatformName] = useState("BIKIN AI");

  useEffect(() => {
    setPlatformName(getPlatformName());
    const handler = () => setPlatformName(getPlatformName());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const packageSummary = useMemo(
    () => `Batas karakter gratis: ${packageLimit} per sesi / per permintaan`,
    [packageLimit],
  );

  const handleLoadFounderUsers = async () => {
    setLoadingAction(true);
    setStatusMessage("Memuat dashboard pengguna Founder...");
    try {
      const response = await fetch("/api/founder/users");
      const data = await response.json();

      if (!response.ok) {
        setStatusMessage(`Gagal memuat pengguna: ${data.error || response.status}`);
        return;
      }

      setFounderUsers(data.users || []);
      setStatusMessage("Daftar pengguna Founder berhasil dimuat.");
    } catch (error) {
      setStatusMessage("Kesalahan jaringan saat memuat pengguna Founder.");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleUpdateUserBalance = async (userId: string, amount: number) => {
    setLoadingAction(true);
    setStatusMessage("Memperbarui saldo pengguna...");
    try {
      const response = await fetch("/api/founder/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_balance", user_id: userId, amount }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatusMessage(`Gagal menambah saldo: ${data.error || response.status}`);
        return;
      }

      setFounderUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, ...data.user } : user)),
      );
      setStatusMessage(`Saldo pengguna berhasil ditambahkan Rp${amount}.`);
    } catch (error) {
      setStatusMessage("Kesalahan jaringan saat memperbarui saldo pengguna.");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleToggleUserBan = async (userId: string, isBanned: boolean) => {
    setLoadingAction(true);
    setStatusMessage("Memperbarui status banned pengguna...");
    try {
      const response = await fetch("/api/founder/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: isBanned ? "unban" : "ban", user_id: userId }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatusMessage(`Gagal memperbarui status banned: ${data.error || response.status}`);
        return;
      }

      setFounderUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, is_banned: !isBanned } : user)),
      );
      setStatusMessage(`Pengguna berhasil ${isBanned ? "di-unban" : "dibanned"}.`);
    } catch (error) {
      setStatusMessage("Kesalahan jaringan saat mengubah status banned pengguna.");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRefreshAuditLog = async () => {
    setLoadingAction(true);
    setStatusMessage("Memuat audit log terbaru...");
    try {
      const response = await fetch("/api/founder/audit");
      const data = await response.json();

      if (!response.ok) {
        setStatusMessage(`Gagal memuat audit log: ${data.error || response.status}`);
        return;
      }

      setAuditLogs(data.logs || []);
      setStatusMessage("Audit log Founder berhasil diperbarui.");
    } catch (error) {
      setStatusMessage("Kesalahan jaringan saat memuat audit log Founder.");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleLoadFeatureContent = async () => {
    setLoadingAction(true);
    setStatusMessage("Memuat konten fitur Founder...");
    try {
      const response = await fetch("/api/founder/features");
      const data = await response.json();

      if (!response.ok) {
        setStatusMessage(`Gagal memuat fitur: ${data.error || response.status}`);
        return;
      }

      setFeatureItems(data.features || []);
      setFeatureDrafts(
        (data.features || []).reduce((drafts: Record<number, Partial<FeatureSetting>>, feature: FeatureSetting) => {
          drafts[feature.id] = { ...feature };
          return drafts;
        }, {}),
      );
      setStatusMessage("Konten fitur Founder berhasil dimuat.");
    } catch (error) {
      setStatusMessage("Kesalahan jaringan saat memuat konten fitur Founder.");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleFeatureFieldChange = (
    featureId: number,
    field: keyof FeatureSetting,
    value: string | boolean | number | null,
  ) => {
    setFeatureDrafts((prev) => ({
      ...prev,
      [featureId]: {
        ...prev[featureId],
        [field]: value,
      },
    }));
  };

  const handleSaveFeature = async (featureId: number) => {
    const draft = featureDrafts[featureId];
    if (!draft) {
      setStatusMessage("Tidak ada perubahan fitur untuk disimpan.");
      return;
    }

    const payload = {
      id: featureId,
      feature_name: String(draft.feature_name ?? "").trim(),
      system_prompt: String(draft.system_prompt ?? "").trim(),
      temperature: Number(draft.temperature ?? 0),
      is_active: Boolean(draft.is_active),
      seo_title: draft.seo_title ?? null,
      seo_description: draft.seo_description ?? null,
    };

    setLoadingAction(true);
    setStatusMessage("Menyimpan perubahan konten fitur Founder...");
    try {
      const response = await fetch("/api/founder/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatusMessage(`Gagal menyimpan fitur: ${data.error || response.status}`);
        return;
      }

      setFeatureItems((prev) =>
        prev.map((item) => (item.id === featureId ? { ...(data.feature ?? item), feature_slug: item.feature_slug } : item)),
      );
      setStatusMessage("Perubahan konten fitur berhasil disimpan.");
    } catch (error) {
      setStatusMessage("Kesalahan jaringan saat menyimpan konten fitur Founder.");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleToggleMaintenance = async () => {
    const nextMaintenance = !maintenanceMode;
    setMaintenanceMode(nextMaintenance);
    setStatusMessage("Mengubah mode maintenance... Update akan diproses.");

    try {
      const response = await fetch("/api/founder/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key_name: "global_maintenance_mode",
          key_value: String(nextMaintenance),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatusMessage(`Gagal mengubah mode maintenance: ${data.error || response.status}`);
        setMaintenanceMode((prev) => !prev);
      } else {
        setStatusMessage("Mode maintenance telah diperbarui oleh Founder.");
      }
    } catch (error) {
      setStatusMessage("Kesalahan jaringan saat mengubah mode maintenance.");
      setMaintenanceMode((prev) => !prev);
    }
  };

  const handlePackageConfigSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("Menyimpan konfigurasi paket... Tunggu.");

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const newLimit = String(formData.get("packageLimit") || "");
      const newPrice = String(formData.get("packagePrice") || "");

      const limitResponse = await fetch("/api/founder/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key_name: "max_input_words_free",
          key_value: newLimit,
        }),
      });

      const priceResponse = await fetch("/api/founder/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key_name: "package_price_rupiah",
          key_value: newPrice,
        }),
      });

      if (!limitResponse.ok || !priceResponse.ok) {
        setStatusMessage("Gagal menyimpan konfigurasi paket. Periksa nilai yang dimasukkan dan coba lagi.");
        return;
      }

      setPackageLimit(newLimit);
      setPackagePrice(newPrice);
      setStatusMessage("Konfigurasi paket dan harga berhasil diperbarui.");
    } catch (error) {
      setStatusMessage("Kesalahan jaringan saat menyimpan paket karakter dan harga.");
    }
  };

  const handleApiKeySave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage("Menyimpan API key global... Tunggu sebentar.");

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const newKey = String(formData.get("apiKey") || "");

      const response = await fetch("/api/founder/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key_name: "gemini_api_key",
          key_value: newKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatusMessage(`Gagal menyimpan API key: ${data.error || response.status}`);
      } else {
        setApiKeyPreview(newKey ? `${newKey.slice(0, 8)}...` : "(kosong)");
        setStatusMessage("API key global berhasil diperbarui.");
      }
    } catch (error) {
      setStatusMessage("Kesalahan jaringan saat menyimpan API key founder.");
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setStatusMessage("Logout gagal. Silakan coba lagi.");
      return;
    }
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="sticky top-0 z-30 border-b border-[#22262e] bg-[#0b1221]/95 px-4 py-4 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 text-slate-100">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-amber-300">{platformName} COMMAND CENTER</p>
            <h1 className="mt-2 text-lg font-black">👑 {platformName} COMMAND CENTER (FOUNDER MODE)</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-amber-400/40 bg-[#111827] px-4 py-2 text-sm text-slate-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
              <p className="font-semibold">ariezcollections@gmail.com</p>
              <span className="mt-1 inline-flex rounded-full bg-amber-400 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-950">
                ROOT ADMIN
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-3 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-red-500"
            >
              <LogOut className="w-4 h-4" />
              🚪 KELUAR SISTEM
            </button>
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 rounded-3xl border border-[#141414] bg-[#111827] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-amber-300 font-mono">Founder Executive Control</p>
              <h2 className="mt-3 text-3xl font-black text-white">Dark-Ops Executive &amp; Global Command</h2>
              <p className="mt-2 text-slate-400 max-w-3xl text-sm">
                Jendela kontrol rahasia founder untuk mengelola server, kuota, API pool, dan pengamanan premium.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-[#141414] bg-[#111827] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex items-center justify-between gap-4 pb-5 border-b border-[#323c52]">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-amber-300 font-mono">Sakelar Darurat Server</p>
                <h2 className="mt-2 text-xl font-black text-white">Global Maintenance Mode</h2>
              </div>
              <button
                type="button"
                onClick={handleToggleMaintenance}
                className={`rounded-full px-4 py-2 text-sm font-bold uppercase tracking-wider transition ${
                  maintenanceMode
                    ? "bg-red-600 text-white"
                    : "bg-emerald-500 text-slate-950"
                }`}
              >
                {maintenanceMode ? "ON" : "OFF"}
              </button>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Jika sakelar diaktifkan, semua permintaan API token akan ditolak dengan status 503 dan pemakaian AI akan berhenti secara global.
            </p>
          </section>

          <section className="rounded-3xl border border-[#141414] bg-[#111827] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex items-center gap-3 pb-5 border-b border-[#323c52]">
              <BarChart3 className="w-6 h-6 text-amber-300" />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-amber-300 font-mono">Grafik &amp; Omzet</p>
                <h2 className="mt-2 text-xl font-black text-white">Omzet QRIS & Karakter</h2>
              </div>
            </div>
            <div className="mt-4 grid gap-4">
              <div className="rounded-3xl border border-[#1f2937] bg-[#0f172a] p-4 text-sm text-slate-300">
                <p className="text-[10px] uppercase tracking-widest text-slate-400">Performa Trading</p>
                <p className="mt-2 font-semibold text-white">Rp 134.500.000</p>
                <p className="mt-1 text-xs text-slate-500">Total omzet QRIS 30 hari terakhir</p>
              </div>
              <div className="rounded-3xl border border-[#1f2937] bg-[#0f172a] p-4 text-sm text-slate-300">
                <p className="text-[10px] uppercase tracking-widest text-slate-400">Kuota Karakter</p>
                <p className="mt-2 font-semibold text-white">{packageSummary}</p>
                <p className="mt-1 text-xs text-slate-500">Update langsung dari Founder Config</p>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-[#141414] bg-[#111827] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex items-center gap-3 pb-5 border-b border-[#323c52]">
              <Settings2 className="w-6 h-6 text-amber-300" />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-amber-300 font-mono">Kuota & Harga</p>
                <h2 className="mt-2 text-xl font-black text-white">Batas Karakter & Paket Rupiah</h2>
              </div>
            </div>
            <form onSubmit={handlePackageConfigSave} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm text-slate-300">Batas Karakter Gratis</label>
                <input
                  name="packageLimit"
                  defaultValue={packageLimit}
                  type="number"
                  min={0}
                  className="w-full rounded-2xl border border-[#323c52] bg-[#0f172a] px-4 py-3 text-sm text-white outline-none focus:border-amber-300"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300">Harga Paket (Rp)</label>
                <input
                  name="packagePrice"
                  defaultValue={packagePrice}
                  type="number"
                  min={0}
                  className="w-full rounded-2xl border border-[#323c52] bg-[#0f172a] px-4 py-3 text-sm text-white outline-none focus:border-amber-300"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-amber-400 px-5 py-3 text-sm font-bold uppercase tracking-widest text-slate-950 transition hover:bg-amber-300"
              >
                Simpan Kuota & Harga
              </button>
            </form>
            <p className="mt-4 text-sm text-slate-400">Status sekarang: {packageSummary} | Harga paket: Rp {packagePrice}</p>
          </section>

          <section className="rounded-3xl border border-[#141414] bg-[#111827] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex items-center gap-3 pb-5 border-b border-[#323c52]">
              <Key className="w-6 h-6 text-amber-300" />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-amber-300 font-mono">Panel API Key Global</p>
                <h2 className="mt-2 text-xl font-black text-white">Atur Kunci AI Global</h2>
              </div>
            </div>
            <form onSubmit={handleApiKeySave} className="mt-5 space-y-4">
              <div className="space-y-3">
              <div>
                <p className="block text-sm text-slate-300">API Key Provider</p>
                <p className="mt-2 text-xs text-slate-500">Current key: {apiKeyPreview}</p>
              </div>
              <input
                name="apiKey"
                value={apiKeyInput}
                onChange={(event) => setApiKeyInput(event.target.value)}
                type="password"
                placeholder="Masukkan kunci API baru..."
                className="w-full rounded-2xl border border-[#323c52] bg-[#0f172a] px-4 py-3 text-sm text-white outline-none focus:border-amber-300"
              />
            </div>
            <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-amber-400 px-5 py-3 text-sm font-bold uppercase tracking-widest text-slate-950 transition hover:bg-amber-300"
              >
                Simpan API Key
              </button>
            </form>
          </section>
        </div>

        <div className="mt-6 rounded-3xl border border-[#141414] bg-[#111827] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <div className="flex items-center justify-between gap-3 pb-5 border-b border-[#323c52]">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-amber-300 font-mono">Pengaturan Akun Founder</p>
              <h2 className="mt-2 text-xl font-black text-white">Akses & Recovery</h2>
            </div>
            <ArrowLeftRight className="w-6 h-6 text-amber-300" />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-[#1f2937] bg-[#0f172a] p-4 text-sm text-slate-300">
              <p className="text-[10px] uppercase tracking-widest text-slate-400">Email Founder</p>
              <p className="mt-2 font-semibold text-white">{founderEmail}</p>
            </div>
            <div className="rounded-3xl border border-[#1f2937] bg-[#0f172a] p-4 text-sm text-slate-300">
              <p className="text-[10px] uppercase tracking-widest text-slate-400">Dukungan Darurat</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Jika kehilangan akses, gunakan tombol Bantuan Darurat di halaman login untuk memulai verifikasi manual melalui admin WA.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-[#141414] bg-[#111827] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between pb-5 border-b border-[#323c52]">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-amber-300 font-mono">Platform Manajemen Hub</p>
              <h2 className="mt-2 text-2xl font-black text-white">Kontrol Penuh Founder</h2>
            </div>
            <p className="text-sm text-slate-400 max-w-2xl">Akses cepat untuk memantau pengguna, audit log, dan mengelola konten fitur tanpa menyentuh kode.</p>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-[#1f2937] bg-[#0f172a] p-6 text-slate-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6 text-emerald-400" />
                <p className="text-xs uppercase tracking-widest text-amber-300 font-black">👥 Manajemen Pengguna & Banned</p>
              </div>
              <p className="mt-4 text-sm text-slate-300">Tambahkan saldo karakter manual atau blokir akun user secara aman dari Founder Hub.</p>
              <button
                type="button"
                onClick={handleLoadFounderUsers}
                disabled={loadingAction}
                className="mt-5 inline-flex items-center justify-center rounded-full border border-amber-300 bg-amber-400/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Buka Manajemen User
              </button>
            </div>
            <div className="rounded-3xl border border-[#1f2937] bg-[#0f172a] p-6 text-slate-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-6 h-6 text-sky-400" />
                <p className="text-xs uppercase tracking-widest text-amber-300 font-black">📋 Audit Log & Security Monitor</p>
              </div>
              <p className="mt-4 text-sm text-slate-300">Pantau lalu lintas server dan deteksi AI liar serta bot scraper dengan mode pengamanan Founder.</p>
              <button
                type="button"
                onClick={handleRefreshAuditLog}
                disabled={loadingAction}
                className="mt-5 inline-flex items-center justify-center rounded-full border border-amber-300 bg-amber-400/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Refresh Audit Log
              </button>
            </div>
            <div className="rounded-3xl border border-[#1f2937] bg-[#0f172a] p-6 text-slate-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-violet-400" />
                <p className="text-xs uppercase tracking-widest text-amber-300 font-black">📑 Manajemen Konten 11 Fitur</p>
              </div>
              <p className="mt-4 text-sm text-slate-300">Ubah judul fitur, system prompt, atau sesuaikan menu AI Nusantara langsung dari Founder Control.</p>
              <button
                type="button"
                onClick={handleLoadFeatureContent}
                disabled={loadingAction}
                className="mt-5 inline-flex items-center justify-center rounded-full border border-amber-300 bg-amber-400/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Kelola Konten Fitur
              </button>
            </div>
          </div>
        </div>

        {(founderUsers.length > 0 || auditLogs.length > 0 || featureItems.length > 0) && (
          <div className="mt-6 space-y-6">
            {founderUsers.length > 0 && (
              <section className="rounded-3xl border border-[#141414] bg-[#111827] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
                <div className="flex items-center justify-between gap-4 pb-5 border-b border-[#323c52]">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-amber-300 font-mono">Founder User Dashboard</p>
                    <h2 className="mt-2 text-xl font-black text-white">Manajemen Pengguna</h2>
                  </div>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{founderUsers.length} akun</span>
                </div>
                <div className="mt-4 space-y-4 text-sm text-slate-300">
                  {founderUsers.map((user) => (
                    <div key={user.id} className="rounded-3xl border border-[#1f2937] bg-[#0f172a] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-semibold text-white">{user.email}</p>
                          <p className="text-xs text-slate-500">Role: {user.role} · Saldo: {user.character_balance} karakter</p>
                          <p className="text-xs text-slate-500">Status banned: {user.is_banned ? "Terblokir" : "Aktif"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateUserBalance(user.id, 1000)}
                            disabled={loadingAction}
                            className="rounded-full bg-amber-400 px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Tambah 1000 Karakter
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleUserBan(user.id, user.is_banned)}
                            disabled={loadingAction}
                            className={`rounded-full px-3 py-2 text-xs font-bold uppercase tracking-widest transition ${
                              user.is_banned ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400" : "bg-red-600 text-white hover:bg-red-500"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            {user.is_banned ? "Lepas Blokir" : "Blokir Akun"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {auditLogs.length > 0 && (
              <section className="rounded-3xl border border-[#141414] bg-[#111827] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
                <div className="flex items-center justify-between gap-4 pb-5 border-b border-[#323c52]">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-amber-300 font-mono">Founder Security Monitor</p>
                    <h2 className="mt-2 text-xl font-black text-white">Audit Log & Security Events</h2>
                  </div>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{auditLogs.length} record</span>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-slate-300">
                  {auditLogs.slice(0, 8).map((log) => (
                    <div key={log.id} className="rounded-3xl border border-[#1f2937] bg-[#0f172a] p-4">
                      <p className="font-semibold text-white">{log.event_type}</p>
                      <p className="mt-1 text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                      <pre className="mt-2 overflow-x-auto text-xs text-slate-300">{JSON.stringify(log.details, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {featureItems.length > 0 && (
              <section className="rounded-3xl border border-[#141414] bg-[#111827] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
                <div className="flex items-center justify-between gap-4 pb-5 border-b border-[#323c52]">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-amber-300 font-mono">Founder Feature Studio</p>
                    <h2 className="mt-2 text-xl font-black text-white">Manajemen Konten 11 Fitur</h2>
                  </div>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">{featureItems.length} fitur</span>
                </div>
                <div className="mt-4 grid gap-4">
                  {featureItems.map((feature) => {
                    const draft = featureDrafts[feature.id] ?? feature;
                    return (
                      <div key={feature.id} className="rounded-3xl border border-[#1f2937] bg-[#0f172a] p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-white">{draft.feature_name}</p>
                            <p className="text-xs text-slate-500">Slug: {feature.feature_slug}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSaveFeature(feature.id)}
                            disabled={loadingAction}
                            className="rounded-full bg-amber-400 px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Simpan Perubahan
                          </button>
                        </div>
                        <div className="mt-4 grid gap-3">
                          <label className="text-xs uppercase tracking-widest text-slate-400">System Prompt:</label>
                          <textarea
                            value={String(draft.system_prompt ?? "")}
                            onChange={(event) => handleFeatureFieldChange(feature.id, "system_prompt", event.target.value)}
                            rows={3}
                            className="w-full rounded-2xl border border-[#323c52] bg-[#111827] px-4 py-3 text-sm text-white outline-none focus:border-amber-300"
                          />
                          <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400">
                            <input
                              type="checkbox"
                              checked={Boolean(draft.is_active)}
                              onChange={(event) => handleFeatureFieldChange(feature.id, "is_active", event.target.checked)}
                              className="h-4 w-4 rounded border-[#323c52] bg-slate-900 text-amber-400"
                            />
                            Aktifkan fitur ini
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {statusMessage ? (
          <div className="mt-6 rounded-3xl border border-[#141414] bg-[#0f172a] p-4 text-sm text-slate-200 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            {statusMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}
