"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import ReleaseControlPanel from "@/components/ReleaseControlPanel";

type User = { id: string; email?: string; role?: string; character_balance?: number; is_banned?: boolean; last_seen?: string | null; last_active?: string | null };
type Feature = { id: number; feature_slug: string; feature_name: string; system_prompt: string; temperature?: number; is_active?: boolean; seo_title?: string | null; seo_description?: string | null };

// Chat ticket untuk Ruang Kendali Live Chat CS (dimuat dari tabel support_tickets)
type ChatTicket = {
  id: string;
  userEmail: string;
  subject: string;
  timestamp: string;
  messages: Array<{ from: 'user' | 'ai' | 'founder'; text: string; time: string }>;
  chatHistory: Array<{ text: string; time: string; feature: string }>;
};

export default function FounderDashboard() {
  const [maintenance, setMaintenance] = useState(false);
  const [quota, setQuota] = useState("500");
  const [price, setPrice] = useState("15000");
  const [geminiKey, setGeminiKey] = useState("");
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [loading, setLoading] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
    const [features, setFeatures] = useState<Feature[]>([]);
  const [newFeatureDraft, setNewFeatureDraft] = useState<Partial<Feature>>({
    feature_name: "",
    feature_slug: "",
    system_prompt: "",
    temperature: 0.5,
    is_active: true,
  });
  const [showFeaturesPanel, setShowFeaturesPanel] = useState(false);
  const [showTotalAccountsModal, setShowTotalAccountsModal] = useState(false);
  const [showLiveMonitorModal, setShowLiveMonitorModal] = useState(false);
  const router = useRouter();
  const [showVaultModal, setShowVaultModal] = useState(false);
  // per-user amount inputs for manual quota adjustments
  const [userAmounts, setUserAmounts] = useState<Record<string, string>>({});

  // Founder profile management (secure) - will load/save via server endpoint which uses bcrypt
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showProfileConfirmModal, setShowProfileConfirmModal] = useState(false);
  const [founderProfile, setFounderProfile] = useState<{ name: string; email: string }>({ name: 'Founder', email: 'ariezcollections@gmail.com' });
  const [founderPassword, setFounderPassword] = useState<string>('');
  const [profileLoading, _setProfileLoading] = useState(false);

  const [vaultKeys, setVaultKeys] = useState({
    gemini: [] as string[],
    openrouter: [] as string[],
    elevenlabs: [] as string[],
  });
  const [newVaultKey, setNewVaultKey] = useState("");
  const [newVaultType, setNewVaultType] = useState<"gemini" | "openrouter" | "elevenlabs">("gemini");
  const [editingKey, setEditingKey] = useState<{ type: "gemini" | "openrouter" | "elevenlabs"; index: number; value: string } | null>(null);

  // 💳 KEY BERBAYAR (Cadangan) — disimpan TERPISAH dari kolom gratis agar tidak
  // tercampur. Hanya dipakai bila SEMUA key gratis gagal (menghindari tagihan
  // saat pengguna hanya sedikit).
  const [paidGeminiKey, setPaidGeminiKey] = useState("");
  const [paidOpenRouterKey, setPaidOpenRouterKey] = useState("");
  const [paidSaving, setPaidSaving] = useState(false);

  // live users and credit guard state
  const [liveUsers, setLiveUsers] = useState<User[]>([]);
  const [creditPauseActive, _setCreditPauseActive] = useState(false);

  // 🔴 REAL-TIME METRICS (Supabase live pipelines)
    const [totalAccounts, setTotalAccounts] = useState<number>(0);
  const [openTicketCount, setOpenTicketCount] = useState<number>(0);
  const [totalOmzet, setTotalOmzet] = useState<number>(0);

  // 💬 Live Chat CS Room state — dimuat dari tabel support_tickets (bukan mock)
  const [showChatCSModal, setShowChatCSModal] = useState(false);
  const [chatTickets, setChatTickets] = useState<ChatTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<ChatTicket | null>(null);
  const [manualOverride, setManualOverride] = useState(false);
  const [founderReply, setFounderReply] = useState("");

  // 🎛️ Founder Configuration Hub state
  const [showConfigHub, setShowConfigHub] = useState(false);
  const [configHub, setConfigHub] = useState({
    package_pemula_price: "15000",
    package_pemula_chars: "5000",
    package_pro_price: "35000",
    package_pro_chars: "15000",
    package_founder_price: "75000",
    package_founder_chars: "50000",
    max_input_chars: "1000",
    qris_enabled: "true",
    platform_name: "BIKIN AI",
    platform_logo: "",
    seo_hashtags: "AI Indonesia, GPT Indonesia, AI Nusantara, AI untuk Guru, AI untuk Mahasiswa, AI untuk UMKM",
  });

  // 📁 Dynamic Logo Upload state
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  // Local-only safe-mode config persistence and handlers (no Supabase calls)
  async function postConfig(key_name: string, key_value: string) {
    setLoading(true);
    try {
            // persist in localStorage for safe-mode
            try { localStorage.setItem(`founder_config_${key_name}`, String(key_value)); } catch { /* ignore */ }
            if (key_name === 'global_maintenance_mode') setMaintenance(key_value === 'true');
            if (key_name === 'free_quota') setQuota(String(key_value));
            if (key_name === 'price_per_1k' || key_name === 'package_price_rupiah') setPrice(String(key_value));
            if (key_name === 'gemini_api_key') setGeminiKey(String(key_value));
            if (key_name === 'openrouter_api_key') setOpenRouterKey(String(key_value));
            // ⚠️ IMPORTANT: PERSIST to backend real API so changes survive reload & reflect for all users.
            try {
              await fetch('/api/founder/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key_name, key_value: String(key_value) }),
              });
            } catch (e) {
              // ignore backend errors — local already saved
            }
            return { ok: true, data: { key_name, key_value } };
    } catch (error) {
            const err = error instanceof Error ? error.message : String(error);
            console.error('local postConfig error', err);
            return { ok: false, error: err };
    } finally {
            setLoading(false);
    }
  }

  function loadLocalConfigs() {
    try {
            const gm = localStorage.getItem('founder_config_global_maintenance_mode');
            if (gm !== null) setMaintenance(gm === 'true');
            const fq = localStorage.getItem('founder_config_free_quota');
            if (fq !== null) setQuota(fq);
            const pp = localStorage.getItem('founder_config_price_per_1k') || localStorage.getItem('founder_config_package_price_rupiah');
            if (pp !== null) setPrice(pp);
            const gk = localStorage.getItem('founder_config_gemini_api_key');
            if (gk !== null) setGeminiKey(gk);
            const ok = localStorage.getItem('founder_config_openrouter_api_key');
            if (ok !== null) setOpenRouterKey(ok);
            const storedGeminiKeys = localStorage.getItem('founder_keys_gemini');
            const storedOpenRouterKeys = localStorage.getItem('founder_keys_openrouter');
            const storedElevenLabsKeys = localStorage.getItem('founder_keys_elevenlabs');
            if (storedGeminiKeys) setVaultKeys((prev) => ({ ...prev, gemini: JSON.parse(storedGeminiKeys) }));
            if (storedOpenRouterKeys) setVaultKeys((prev) => ({ ...prev, openrouter: JSON.parse(storedOpenRouterKeys) }));
            if (storedElevenLabsKeys) setVaultKeys((prev) => ({ ...prev, elevenlabs: JSON.parse(storedElevenLabsKeys) }));

            // 🔴 LOAD CONFIG FROM CLOUD (Supabase founder_config) — real production source of truth
            void loadCloudConfigs();

            // Load config hub values from localStorage
            const keys = ['package_pemula_price', 'package_pemula_chars', 'package_pro_price', 'package_pro_chars', 'package_founder_price', 'package_founder_chars', 'max_input_chars', 'qris_enabled', 'platform_name', 'platform_logo', 'seo_hashtags'];
            setConfigHub((prev) => {
              const next = { ...prev };
              keys.forEach((k) => {
                const v = localStorage.getItem(`founder_config_${k}`);
                if (v !== null) (next as Record<string, string>)[k] = v;
              });
              return next;
            });
            // Load logo preview from localStorage
            const savedLogo = localStorage.getItem('founder_config_platform_logo');
            if (savedLogo) setLogoPreview(savedLogo);
    } catch {
            // ignore
    }
  }

  // 🔴 LOAD PRODUCTION CONFIG FROM CLOUD (Supabase founder_config) — source of truth
  async function loadCloudConfigs() {
    // Cadangan lokal — agar key yang baru disimpan tidak "hilang" saat reload
    // bila akses cloud belum/belum sempat menyimpan. Cloud tetap dipertahankan bila berisi.
    const readLocalArr = (k: string): string[] => {
      try { const raw = localStorage.getItem('founder_keys_' + k); return raw ? (JSON.parse(raw) as string[]) : []; } catch { return []; }
    };
    const pickVault = (k: string, cloud: unknown): string[] => {
      const c = Array.isArray(cloud) ? (cloud as string[]) : [];
      const l = readLocalArr(k);
      return Array.from(new Set([...c, ...l])).map((x) => String(x).trim()).filter((x) => x.length > 0);
    };
    // Muat Vault langsung dari server route (service-role, bebas RLS) agar selalu
    // identik dengan apa yang tersimpan di DB — di localhost maupun Vercel.
    try {
      const vres = await fetch('/api/founder/config?key=vault_keys');
      const vdata = await vres.json();
      if (vres.ok && vdata?.ok && vdata.data?.key_value) {
        const parsed = JSON.parse(vdata.data.key_value);
        if (parsed && typeof parsed === 'object') {
          setVaultKeys({
            gemini: pickVault('gemini', parsed.gemini),
            openrouter: pickVault('openrouter', parsed.openrouter),
            elevenlabs: pickVault('elevenlabs', parsed.elevenlabs),
          });
        }
      }
    } catch { /* ignore — client fallback below */ }

    try {
      const { data, error } = await supabase
        .from("founder_config")
        .select("key_name,key_value");
      if (error || !Array.isArray(data)) return;
      const map: Record<string, string> = {};
      (data as Array<{ key_name: string; key_value: string | null }>).forEach((row) => {
        if (row?.key_name) map[row.key_name] = row.key_value ?? "";
      });

      if (map.global_maintenance_mode !== undefined) setMaintenance(map.global_maintenance_mode === "true");
      if (map.free_quota !== undefined) setQuota(map.free_quota);
      if (map.price_per_1k !== undefined) setPrice(map.price_per_1k);
      if (map.gemini_api_key) setGeminiKey(map.gemini_api_key);
      if (map.openrouter_api_key) setOpenRouterKey(map.openrouter_api_key);
      // 💳 Load key BERBAYAR (cadangan) — kolom terpisah dari gratis
      if (map.gemini_api_key_paid) setPaidGeminiKey(map.gemini_api_key_paid);
      if (map.openrouter_api_key_paid) setPaidOpenRouterKey(map.openrouter_api_key_paid);

      // Vault keys from cloud ledger
      if (map.vault_keys) {
        try {
          const parsed = JSON.parse(map.vault_keys);
          if (parsed && typeof parsed === "object") {
            setVaultKeys({
              gemini: pickVault('gemini', parsed.gemini),
              openrouter: pickVault('openrouter', parsed.openrouter),
              elevenlabs: pickVault('elevenlabs', parsed.elevenlabs),
            });
          }
        } catch {
          // ignore malformed vault data
        }
      }

      // Config hub values from cloud
      const hubKeys = [
        "package_pemula_price", "package_pemula_chars", "package_pro_price",
        "package_pro_chars", "package_founder_price", "package_founder_chars",
        "max_input_chars", "qris_enabled", "platform_name", "platform_logo", "seo_hashtags",
      ];
      setConfigHub((prev) => {
        const next = { ...prev };
        hubKeys.forEach((k) => {
          if (map[k] !== undefined) (next as Record<string, string>)[k] = map[k];
        });
        return next;
      });
      if (map.platform_logo) setLogoPreview(map.platform_logo);
    } catch {
      // ignore — fall back to localStorage
    }
  }

    async function saveVaultKeys(next: { gemini: string[]; openrouter: string[]; elevenlabs: string[] }) {
      setVaultKeys(next);
      // Cache lokal (baca cepat sebelum cloud resolve)
      try { localStorage.setItem('founder_keys_gemini', JSON.stringify(next.gemini)); } catch { /* ignore */ }
      try { localStorage.setItem('founder_keys_openrouter', JSON.stringify(next.openrouter)); } catch { /* ignore */ }
      try { localStorage.setItem('founder_keys_elevenlabs', JSON.stringify(next.elevenlabs)); } catch { /* ignore */ }
      try { localStorage.setItem('founder_config_vault_keys', JSON.stringify(next)); } catch { /* ignore */ }

      // 🔴 Persist ke founder_config via SERVER API (admin/client service-role).
      //    Ini SATU-SATUNYA jalur tulis yang valid: melewati RLS (posting lewat
      //    route server yang memakai service_role), sehingga tersimpan permanen
      //    melewati refresh/logout dan identik di localhost maupun Vercel.
      //    Kami TIDAK lagi menulis lewat client `supabase.from(...)` karena
      //    dikunci RLS `is_founder()` dan bisa gagal diam-diam.
      const res = await fetch('/api/founder/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_name: 'vault_keys', key_value: JSON.stringify(next) }),
      });
      let data: { ok?: boolean; error?: string } = {};
      try { data = await res.json(); } catch { /* ignore */ }
      if (!res.ok || data?.ok !== true) {
        throw new Error('Vault gagal tersimpan ke cloud: ' + (data?.error || `HTTP ${res.status}`));
      }
    }

  function maskKey(key: string) {
    if (!key) return '—';
    return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
  }

    // load founder profile from server
    async function loadFounderProfile() {
      try {
        _setProfileLoading(true);
        const res = await fetch('/api/founder/profile');
        const data = await res.json();
        if (res.ok && data?.ok && data.data) {
          setFounderProfile({ name: String(data.data.name || 'Founder'), email: String(data.data.email || 'ariezcollections@gmail.com') });
        }
      } catch (e) {
        // ignore
      } finally {
        _setProfileLoading(false);
      }
    }

    async function saveFounderProfile(next: { name: string; email: string }, plainPassword: string) {
      try {
        _setProfileLoading(true);
        const body = { name: next.name, email: next.email, password: String(plainPassword || '') };
        const res = await fetch('/api/founder/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) {
          alert('Gagal menyimpan profil Founder: ' + (data?.error || res.status));
          return { ok: false, error: data?.error || 'error' };
        }
        // update local state (do not store password locally)
        setFounderProfile({ name: next.name, email: next.email });
        setFounderPassword('');
        return { ok: true };
      } catch (e) {
        console.error('saveFounderProfile failed', e);
        alert('Gagal menyimpan profil Founder.');
        return { ok: false, error: String(e) };
      } finally {
        _setProfileLoading(false);
      }
    }


    async function addVaultKey() {
    if (!newVaultKey.trim()) return alert('Masukkan API key terlebih dahulu.');
    const k = newVaultKey.trim();
    // ⚠️ Penjaga format — cegah kunci masuk ke kolom yang salah tanpa sadar.
    const isGemini = /^AIza[A-Za-z0-9_-]{10,}$/.test(k);
    const isOpenRouter = /^sk-or-/i.test(k);
    const isEleven = /^sk(?:_|-)[A-Za-z0-9]{10,}$/i.test(k) && !isOpenRouter;
    if (newVaultType === 'elevenlabs' && (isGemini || isOpenRouter)) {
      return alert('Kunci ini berformat Gemini/OpenRouter, bukan ElevenLabs (`sk-…`). Kolom ElevenLabs hanya menerima kunci ElevenLabs.');
    }
    if (newVaultType !== 'elevenlabs' && isEleven) {
      return alert(`Kunci tampaknya ElevenLabs (“${k.slice(0, 10)}…”). Ganti “Jenis Kunci” ke ElevenLabs (TTS MP3) agar masuk kolom yang benar.`);
    }
    const next = { ...vaultKeys };
    if (newVaultType === 'gemini') next.gemini = [...next.gemini, k];
    else if (newVaultType === 'elevenlabs') next.elevenlabs = [...next.elevenlabs, k];
    else next.openrouter = [...next.openrouter, k];
    try {
      await saveVaultKeys(next);
      setNewVaultKey('');
      alert('API key baru berhasil ditambahkan ke Vault.');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal menyimpan API key ke cloud.');
    }
  }

    async function updateVaultKey(type: 'gemini' | 'openrouter' | 'elevenlabs', index: number, value: string) {
    const next = { ...vaultKeys };
    if (type === 'gemini') next.gemini[index] = value;
    else if (type === 'elevenlabs') next.elevenlabs[index] = value;
    else next.openrouter[index] = value;
    try {
      await saveVaultKeys(next);
      setEditingKey(null);
      alert('API key berhasil diperbarui.');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal memperbarui API key di cloud.');
    }
  }

    async function deleteVaultKey(type: 'gemini' | 'openrouter' | 'elevenlabs', index: number) {
    const next = { ...vaultKeys };
    if (type === 'gemini') next.gemini = next.gemini.filter((_, i) => i !== index);
    else if (type === 'elevenlabs') next.elevenlabs = next.elevenlabs.filter((_, i) => i !== index);
    else next.openrouter = next.openrouter.filter((_, i) => i !== index);
    try {
      await saveVaultKeys(next);
      alert('API key telah dihapus dari Vault.');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal menghapus API key dari cloud.');
    }
  }

  // 💳 SIMPAN KEY BERBAYAR (Cadangan) — ke founder_config, kolom terpisah.
  // Tidak pernah tercampur ke pool gratis. Dibaca backend Kran 2 sebagai
  // failover terakhir jika semua key gratis gagal.
  async function savePaidKeys() {
    if (!paidGeminiKey.trim() && !paidOpenRouterKey.trim()) {
      return alert('Masukkan setidaknya satu API key berbayar (Gemini atau OpenRouter).');
    }
    setPaidSaving(true);
    try {
      if (paidGeminiKey.trim()) {
        await postConfig('gemini_api_key_paid', paidGeminiKey.trim());
        try { localStorage.setItem('founder_config_gemini_api_key_paid', paidGeminiKey.trim()); } catch {}
      }
      if (paidOpenRouterKey.trim()) {
        await postConfig('openrouter_api_key_paid', paidOpenRouterKey.trim());
        try { localStorage.setItem('founder_config_openrouter_api_key_paid', paidOpenRouterKey.trim()); } catch {}
      }
      alert('✅ API key BERBAYAR (cadangan) berhasil disimpan terpisah. Hanya dipakai saat semua key gratis gagal.');
    } catch (e) {
      alert('Gagal menyimpan key berbayar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPaidSaving(false);
    }
  }

  // Load real dashboard data from backend API (users & features).
  // Falls back to local mock data only when the API is unreachable.
  async function loadDashboardData() {
    // --- Users: fetch from backend real API first ---
    try {
      const usersRes = await fetch('/api/founder/users', { cache: 'no-store' });
      const usersData = await usersRes.json();
      if (usersRes.ok && Array.isArray(usersData.users)) {
        const loadedUsers = usersData.users as User[];
        setUsers(loadedUsers);
        try { localStorage.setItem('founder_mock_users', JSON.stringify(loadedUsers)); } catch {}
      } else {
        throw new Error(usersData?.error || 'users API failed');
      }
    } catch (e) {
      // Fallback bila API gagal — kosongkan (tidak lagi menampilkan akun mock demo)
      try {
        const storedUsers = localStorage.getItem('founder_mock_users');
        if (storedUsers) setUsers(JSON.parse(storedUsers));
        else setUsers([]);
      } catch {
        setUsers([]);
      }
    }

    // --- Features: fetch from backend real API first ---
    try {
      const featRes = await fetch('/api/founder/features', { cache: 'no-store' });
      const featData = await featRes.json();
      if (featRes.ok && Array.isArray(featData.features)) {
        const loadedFeatures = featData.features as Feature[];
        setFeatures(loadedFeatures);
        try { localStorage.setItem('founder_mock_features', JSON.stringify(loadedFeatures)); } catch {}
      } else {
        throw new Error(featData?.error || 'features API failed');
      }
    } catch (e) {
      // Fallback: local mock only
      try {
        const storedFeatures = localStorage.getItem('founder_mock_features');
        if (storedFeatures) setFeatures(JSON.parse(storedFeatures));
      } catch {
        setFeatures([]);
      }
    }
  }

  function refreshLiveUsersLocal() {
    try {
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      const actives = (users || []).filter((u) => {
        const t = u.last_seen ? new Date(String(u.last_seen)).getTime() : 0;
        return t && (now - t <= fiveMinutes);
      });
      setLiveUsers(actives.slice(0, 50));
    } catch {
      setLiveUsers([]);
    }
  }

  // 🔴 REAL-TIME METRICS: total akun, tiket aktif, omzet (Supabase live query)
  async function loadRealtimeMetrics() {
    try {
      // 1) TOTAL AKUN — count all rows in users table
      const { count: accountCount, error: accountError } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true });
      if (!accountError) setTotalAccounts(Number(accountCount) || 0);

      // 1b) USER ONLINE — hitung dari kolom last_seen (real-time presence via
      //     heartbeat /app/dashboard/layout). Ini PENGGANTI presence channel
      //     yang dulu hanya menghitung berapa browser yang membuka halaman founder.
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: liveRows, error: liveErr } = await supabase
        .from("users")
        .select("id,email,role,character_balance,last_seen")
        .gte("last_seen", fiveMinAgo)
        .order("last_seen", { ascending: false });
      if (!liveErr && Array.isArray(liveRows)) setLiveUsers(liveRows as User[]);

      // 2) TIKET AKTIF — count open/unresolved support_tickets
      const { count: ticketCount, error: ticketError } = await supabase
        .from("support_tickets")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "unresolved"]);
      if (!ticketError) setOpenTicketCount(Number(ticketCount) || 0);

      // 3) TOTAL OMZET — sum successful transactions
      const { data: txRows, error: txError } = await supabase
        .from("transactions")
        .select("amount")
        .eq("status", "success");
      if (!txError && Array.isArray(txRows)) {
        const sum = txRows.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
        setTotalOmzet(sum);
      }
    } catch {
      // ignore — metrics stay at fallback values
    }
  }

  // Format angka ke format Rupiah (tanpa desimal)
  function formatRupiah(value: number): string {
    const safe = Number(value) || 0;
    const formatted = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(safe);
    return formatted.replace(/\s/g, "");
  }

  // 💬 MUAT TIKET CHAT CS dari tabel support_tickets (bukan mock)
  async function loadChatTickets() {
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id,user_email,subject,status,created_at,messages,chat_history")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!Array.isArray(data)) {
        setChatTickets([]);
        return;
      }
      const tickets: ChatTicket[] = (data as Array<{
        id: string;
        user_email: string;
        subject: string;
        status: string;
        created_at: string;
        messages: unknown;
        chat_history: unknown;
      }>).map((row) => ({
        id: String(row.id),
        userEmail: row.user_email,
        subject: row.subject,
        timestamp: row.created_at,
        messages: Array.isArray(row.messages)
          ? (row.messages as Array<{ from: "user" | "ai" | "founder"; text: string; time: string }>)
          : [],
        chatHistory: Array.isArray(row.chat_history)
          ? (row.chat_history as Array<{ text: string; time: string; feature: string }>)
          : [],
      }));
      setChatTickets(tickets);
    } catch {
      setChatTickets([]);
    }
  }

  // 🔴 SUPABASE REALTIME CHANNELS — live presence + table subscriptions
  useEffect(() => {
    let active = true;
    const channels: Array<ReturnType<typeof supabase.channel>> = [];

    // Initial live load
    void loadRealtimeMetrics();
    void loadChatTickets();

        // LIVE MONITOR online dihitung oleh loadRealtimeMetrics() dari kolom
    // last_seen di DB (real-time via heartbeat /app/dashboard/layout), bukan
    // presence channel yang hanya menghitung browser yang membuka halaman ini.


    // users table subscription (recount total akun live + refresh saldo user)
    const usersChannel = supabase
      .channel("founder-users-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => {
          if (!active) return;
          void loadRealtimeMetrics();
          // 🔴 Refresh daftar saldo user real (character_balance) dari DB,
          // agar sisa saldo user terlihat real-time di panel founder.
          void loadDashboardData().then(() => refreshLiveUsersLocal());
        }
      )
      .subscribe();
    channels.push(usersChannel);

    // support_tickets subscription (recount tiket + refresh daftar live)
    const ticketsChannel = supabase
      .channel("founder-tickets-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets" },
        () => {
          if (!active) return;
          void loadRealtimeMetrics();
          void loadChatTickets();
        }
      )
      .subscribe();
    channels.push(ticketsChannel);

    // transactions subscription (omzet live)
    const txChannel = supabase
      .channel("founder-tx-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions" },
        () => {
          if (!active) return;
          void loadRealtimeMetrics();
        }
      )
      .subscribe();
    channels.push(txChannel);

    // Regular polling fallback (30s) in case realtime is unavailable
    const iv = setInterval(() => {
      if (!active) return;
      void loadRealtimeMetrics();
    }, 30000);

    return () => {
      active = false;
      clearInterval(iv);
      channels.forEach((c) => {
        try {
          void supabase.removeChannel(c);
        } catch {
          // ignore
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const protectFounderPanel = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          router.push("/login");
          return;
        }

        let okFounder = false;
        // 1) Coba tabel `founder` (primer) — jika belum dibuat, lanjut ke users
        try {
          const { data: profileData, error: profileError } = await supabase
            .from("founder")
            .select("role")
            .eq("id", user.id)
            .maybeSingle<{ role: string }>();
          if (!profileError && profileData?.role === "founder") okFounder = true;
        } catch { /* tabel founder belum ada */ }

        // 2) Fallback ke tabel `users` (role = founder)
        if (!okFounder) {
          try {
            const { data: userProfile, error: userProfileError } = await supabase
              .from("users")
              .select("role")
              .eq("id", user.id)
              .maybeSingle<{ role: string }>();
            if (!userProfileError && userProfile?.role === "founder") okFounder = true;
          } catch { /* abaikan */ }
        }

        if (!okFounder) {
          router.push("/dashboard");
          return;
        }
      } catch {
        router.push("/login");
      }
    };

    protectFounderPanel();

    // initialize: fetch real data from backend API, fallback to local mock
    loadLocalConfigs();
    void loadDashboardData().then(() => {
      refreshLiveUsersLocal();
    });
    loadFounderProfile();
    void loadRealtimeMetrics();
    const iv = setInterval(() => {
          loadRealtimeMetrics();
    }, 15000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignOut() {
    setLoading(true);
    try {
      // Sign out from Supabase auth so founder session fully ends
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.warn('Supabase signOut error:', error.message);
        }
      } catch (signOutError) {
        console.warn('Failed to sign out Supabase:', signOutError);
      }

      // Clear common session keys and founder-local caches
      localStorage.removeItem('admin_view_as_user');
      localStorage.removeItem('founder_mock_users');
      localStorage.removeItem('founder_mock_features');
      localStorage.removeItem('founder_keys_gemini');
      localStorage.removeItem('founder_keys_openrouter');
      localStorage.removeItem('founder_config_global_maintenance_mode');
      // Remove any founder_config_ prefixed keys
      Object.keys(localStorage).forEach((k) => {
        try { if (k && String(k).startsWith('founder_config_')) localStorage.removeItem(k); } catch (e) {}
      });
      // Best-effort remove Supabase local token key if present
      try { localStorage.removeItem('supabase.auth.token'); } catch (e) {}
      document.cookie = 'bikinai_session=; path=/; max-age=0';
    } catch (e) {
      // ignore errors during cleanup
    }
    // Use replace so user cannot navigate back to the founder dashboard via back button
    window.location.replace('/founder-login');
  }

  async function toggleMaintenance() {
    const next = !maintenance;
    setMaintenance(next);
    await postConfig('global_maintenance_mode', next ? 'true' : 'false');
    // 🔴 Native Supabase mutation — lock maintenance mode into cloud DB
    try {
      await supabase.from('founder_config').upsert(
        { key_name: 'global_maintenance_mode', key_value: next ? 'true' : 'false' },
        { onConflict: 'key_name' }
      );
      alert('Perubahan Global Maintenance Mode tersimpan ke cloud.');
    } catch {
      alert('Perubahan Global Maintenance Mode tersimpan (local).');
    }
  }

  async function applyQuota() {
    const value = String(Number(quota) || 0);
    await postConfig('free_quota', value);
    // 🔴 Native Supabase mutation — lock kuota into cloud DB
    try {
      await supabase.from('founder_config').upsert(
        { key_name: 'free_quota', key_value: value },
        { onConflict: 'key_name' }
      );
      alert('Batas kuota berhasil diperbarui ke cloud.');
    } catch {
      alert('Batas kuota berhasil diperbarui (local).');
    }
  }

  async function applyPrice() {
    const value = String(Number(price) || 0);
    await postConfig('price_per_1k', value);
    // 🔴 Native Supabase mutation — lock harga into cloud DB
    try {
      await supabase.from('founder_config').upsert(
        { key_name: 'price_per_1k', key_value: value },
        { onConflict: 'key_name' }
      );
      alert('Harga paket berhasil diperbarui ke cloud.');
    } catch {
      alert('Harga paket berhasil diperbarui (local).');
    }
  }

  async function applyKeys() {
    if (!geminiKey && !openRouterKey) return alert('Masukkan setidaknya satu API key untuk diperbarui.');
    if (geminiKey) { await postConfig('gemini_api_key', geminiKey); try { await supabase.from('founder_config').upsert({ key_name: 'gemini_api_key', key_value: geminiKey }, { onConflict: 'key_name' }); } catch {} }
    if (openRouterKey) { await postConfig('openrouter_api_key', openRouterKey); try { await supabase.from('founder_config').upsert({ key_name: 'openrouter_api_key', key_value: openRouterKey }, { onConflict: 'key_name' }); } catch {} }
    setGeminiKey(''); setOpenRouterKey('');
    alert('Kunci API berhasil diperbarui dan disimpan ke cloud.');
  }

    // 🎙️ ElevenLabs (TTS MP3) — kunci dikelola di Vault (modal API Vault), tidak lagi di kolom terpisah.

  async function performUserAction(action: string, userId: string, amount?: number) {
    try {
      let alertMessage = '';
      setUsers((prev) => {
        const copy = (prev || []).map((u) => ({ ...u }));
        const idx = copy.findIndex((x) => x.id === userId);
        if (idx === -1) return copy;
        if (action === 'add_balance' && typeof amount === 'number') {
          copy[idx].character_balance = (Number(copy[idx].character_balance) || 0) + amount;
          alertMessage = `Saldo user ${copy[idx].email || copy[idx].id} berhasil ditambah +${amount}.`;
        } else if (action === 'ban') {
            // FITUR 1 & 2: Banned user — JANGAN menghapus user, jangan sentuh saldo
            // Set is_banned = true, balance tetap beku (frozen) utuh
            copy[idx].is_banned = true;
            alertMessage = `User ${copy[idx].email || copy[idx].id} berhasil dibanned. Saldo terakhir ${copy[idx].character_balance ?? 0} karakter dibekukan utuh.`;
          } else if (action === 'unban') {
            // FITUR 1 & 2: Unban — pulihkan akun, saldo yang beku cair kembali utuh
            copy[idx].is_banned = false;
            alertMessage = `User ${copy[idx].email || copy[idx].id} berhasil di-unban. Saldo ${copy[idx].character_balance ?? 0} karakter kembali aktif.`;
          }
          try { localStorage.setItem('founder_mock_users', JSON.stringify(copy)); } catch {}
          return copy;
      });
      refreshLiveUsersLocal();
      // Also sync to backend API
      try {
        await fetch('/api/founder/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, user_id: userId, amount: amount || 0 }),
        });
      } catch (e) {
        // ignore backend errors — local already succeeded
      }
      if (alertMessage) alert(alertMessage);
      return { ok: true };
    } catch (err) {
      console.error('performUserAction local failed', err);
      return { ok: false, error: String((err as Error)?.message ?? err) };
    }
  }

  async function saveFeature(feature: Feature) {
    if (creditPauseActive) return alert('Operasi dilarang: Sistem sedang dijeda karena credit OpenRouter menipis.');
    try {
            setFeatures((prev) => {
              const copy = (prev || []).map((p) => ({ ...p }));
              const idx = copy.findIndex((p) => p.id === feature.id);
              if (idx === -1) copy.push(feature);
              else copy[idx] = feature;
              try { localStorage.setItem('founder_mock_features', JSON.stringify(copy)); } catch {}
              return copy;
            });
            alert('Feature tersimpan (local).');
            return { ok: true };
    } catch (err) {
            console.error('saveFeature local failed', err);
            alert('Gagal menyimpan feature: ' + String(err));
                        return { ok: false, error: String(err) };
    }
  }

  /* ➕ Tambah fitur baru dari UI founder (prompt manual + temperatur) */
  function addFeatureManual() {
    if (!newFeatureDraft.feature_slug?.trim() || !newFeatureDraft.feature_name?.trim()) {
      alert('Slug dan Nama fitur wajib diisi.');
      return;
    }
    const newFeature: Feature = {
      id: Date.now(),
      feature_slug: newFeatureDraft.feature_slug!.trim(),
      feature_name: newFeatureDraft.feature_name!.trim(),
      system_prompt: newFeatureDraft.system_prompt?.trim() ?? '',
      temperature: Number(newFeatureDraft.temperature ?? 0),
      is_active: Boolean(newFeatureDraft.is_active ?? true),
      seo_title: null,
      seo_description: null,
    };
    saveFeature(newFeature);
    setNewFeatureDraft({
      feature_name: '',
      feature_slug: '',
      system_prompt: '',
      temperature: 0.5,
      is_active: true,
    });
  }

  // 🎛️ Founder Configuration Hub save
  async function saveConfigHub() {
    try {
      const keys = Object.keys(configHub);
      for (const key of keys) {
        const val = (configHub as Record<string, string>)[key];
        await postConfig(key, val);
        localStorage.setItem(`founder_config_${key}`, val);
        // Sync to backend API for persistence
        try {
          await fetch('/api/founder/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key_name: key, key_value: val }),
          });
        } catch (e) {
          // ignore backend errors — local already saved
        }
      }
      alert('🎛️ Konfigurasi Hub berhasil disimpan secara lokal & server!');
    } catch (e) {
      alert('Gagal menyimpan konfigurasi: ' + String(e));
    }
  }

  // 📁 Handle logo file selection and instant preview
  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'].includes(file.type)) {
      alert('Format file tidak didukung. Gunakan PNG, JPG, atau SVG.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file melebihi batas 2MB.');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === 'string') setLogoPreview(result);
    };
    reader.readAsDataURL(file);
  }

  // 📁 Save logo: upload to server, persist path to config
  async function saveLogo() {
    if (!logoFile) return alert('Pilih file logo terlebih dahulu sebelum menyimpan.');
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', logoFile);
      const res = await fetch('/api/founder/logo', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert('Gagal mengunggah logo: ' + (data?.error || res.status));
        return;
      }
      const logoPath = data.data.platform_logo;
      setConfigHub((prev) => ({ ...prev, platform_logo: logoPath }));
      try {
        localStorage.setItem('founder_config_platform_logo', logoPath);
      } catch { /* ignore */ }
      setLogoPreview(logoPath);
      setLogoFile(null);
      // Broadcast real-time update to other tabs/components
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('founder-config-updated'));
      alert('📁 Logo resmi platform berhasil disimpan! Seluruh tampilan user akan otomatis memperbarui logo.');
    } catch (e) {
      alert('Gagal menyimpan logo: ' + String(e));
    } finally {
      setLogoUploading(false);
    }
  }

  // 💬 Chat CS: Send founder manual reply
  function sendFounderReply() {
    if (!selectedTicket || !founderReply.trim()) return;
    const updated = { ...selectedTicket };
    updated.messages = [...updated.messages, { from: 'founder' as const, text: founderReply.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }];
    setSelectedTicket(updated);
    setFounderReply('');
    // Update the ticket in the tickets list
    setChatTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    alert('✅ Balasan Founder terkirim!');
  }

  // 💬 Chat CS: Quick action buttons
  async function chatQuickAction(action: 'unban' | 'add_balance' | 'ban', userEmail: string) {
    if (!selectedTicket) return;
    // Find user by email
    const user = users.find((u) => u.email === userEmail);
    if (!user) return alert('User tidak ditemukan dalam daftar.');
    if (action === 'unban') {
      await performUserAction('unban', user.id);
      alert('🟢 Akun user ' + userEmail + ' berhasil dipulihkan!');
    } else if (action === 'add_balance') {
      const amount = 5000;
      await performUserAction('add_balance', user.id, amount);
      alert('💰 Saldo ' + amount + ' berhasil diisi manual ke ' + userEmail);
    } else if (action === 'ban') {
      await performUserAction('ban', user.id);
      alert('❌ Akun user ' + userEmail + ' berhasil diban permanen!');
    }
  }

  const allUsers = users;
  const activeUsers = users.filter((u) => !u.is_banned);
  const onlineUsers = liveUsers;

  function openModal(name: 'all' | 'live' | 'vault' | 'profile' | 'chatcs' | 'confighub') {
      // ensure modals are mutually exclusive
      setShowTotalAccountsModal(false);
      setShowLiveMonitorModal(false);
      setShowVaultModal(false);
      setShowProfileModal(false);
      setShowChatCSModal(false);
      setShowConfigHub(false);
      if (name === 'all') setShowTotalAccountsModal(true);
      if (name === 'live') setShowLiveMonitorModal(true);
      if (name === 'vault') setShowVaultModal(true);
      if (name === 'profile') setShowProfileModal(true);
      if (name === 'chatcs') setShowChatCSModal(true);
      if (name === 'confighub') setShowConfigHub(true);
    }

    function impersonateUser(user: User) {
      const target = user.email || user.id;
      try {
              localStorage.setItem('admin_view_as_user', target);
              window.location.replace('/dashboard');
      } catch (e) {
              console.warn('Impersonasi gagal', e);
      }
    }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="border-b border-amber-500/20 bg-gradient-to-b from-slate-900/80 to-slate-900/60 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <span className="text-2xl">👑</span>
          <div>
            <h1 className="text-lg font-bold tracking-wider text-amber-400">👑 {configHub.platform_name} COMMAND CENTER (FOUNDER MODE)</h1>
            <p className="text-xs text-slate-400 font-mono">FOUNDER EXECUTIVE CONTROL PANEL</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-semibold text-amber-400 font-mono">ariezcollections@gmail.com</span>
            <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full font-bold">ROOT ADMIN</span>
          </div>

          <button
            onClick={handleSignOut}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1"
            disabled={loading}
          >
            🚪 KELUAR SISTEM
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8"> 
        {/* Credit Guard Banner */}
        {creditPauseActive && (
          <div className="max-w-7xl mx-auto px-6">
            <div className="bg-amber-600 text-slate-900 font-bold p-3 rounded-md animate-pulse text-center">
                    ⚠️ [REM DARURAT AKTIF] Bensin Kredit Anda Tinggal Sedikit! Proses koding sengaja DIJEDA demi keamanan file. Sila suntikkan API Key berawalan {`'AQ'`} atau sk-or yang baru di menu Settings untuk melanjutkan kodingan secara mulus!
            </div>
          </div>
        )}
 
        {/* Summary Cards */}

        {/* 🔒 FOUNDER PROFILE MANAGEMENT - panel premium */}
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-amber-400">🔒 FOUNDER PROFILE MANAGEMENT</div>
              <div className="text-lg font-bold text-white">{founderProfile.name}</div>
              <div className="text-xs text-slate-400">{founderProfile.email}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => openModal('profile')} className="px-4 py-2 bg-emerald-500 text-slate-900 rounded font-bold">⚙️ Kelola Profile</button>
            </div>
          </div>
        </div>

        {/* 🚀 RELEASE CONTROL PANEL - founder-only */}
        <div className="max-w-7xl mx-auto px-6">
          <ReleaseControlPanel />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6">
          <button onClick={() => openModal('all')} className="group bg-slate-900 p-5 rounded-3xl border border-slate-800 hover:border-emerald-500 transition-all cursor-pointer text-left">
            <div className="text-xs uppercase tracking-[0.3em] text-emerald-400">📊 TOTAL AKUN TERDAFTAR</div>
            <div className="mt-3 text-4xl font-bold text-slate-100 animate-pulse">{totalAccounts || activeUsers.length}</div>
            <div className="mt-2 text-xs text-slate-500">Klik untuk melihat semua akun dan interaksi manajemen real-time.</div>
          </button>
          <button onClick={() => openModal('live')} className="group bg-slate-900 p-5 rounded-3xl border border-slate-800 hover:border-sky-500 transition-all cursor-pointer text-left">
            <div className="text-xs uppercase tracking-[0.3em] text-sky-400">🟢 LIVE MONITOR</div>
            <div className="mt-3 text-4xl font-bold text-emerald-300 animate-pulse">{onlineUsers.length} USER</div>
            <div className="mt-2 text-xs text-slate-500">Klik untuk melihat siapa yang aktif dalam 5 menit terakhir.</div>
          </button>
        </div>
 
        {showTotalAccountsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
            <div className="w-full max-w-5xl rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Daftar Akun Terdaftar</div>
                  <div className="text-lg font-bold text-white">{allUsers.length} Akun</div>
                </div>
                <button onClick={() => setShowTotalAccountsModal(false)} className="text-slate-300 hover:text-white">Tutup</button>
              </div>
              <div className="max-h-[70vh] overflow-auto p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.15em] text-slate-500 border-b border-slate-800">
                      <th className="py-3">Email</th>
                      <th className="py-3">Status</th>
                      <th className="py-3">Kuota</th>
                      <th className="py-3">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {allUsers.map((u) => {
                      const last = u.last_seen || u.last_active || null;
                      const lastText = last ? new Date(String(last)).toLocaleString() : '—';
                      return (
                        <tr key={u.id} className="align-top">
                          <td className="py-3">
                            <div className="font-bold">{u.email || u.id}</div>
                            <div className="text-[11px] text-slate-500">{lastText}</div>
                          </td>
                          <td className="py-3 text-xs text-slate-300">{u.is_banned ? 'Banned' : 'Active'}</td>
                          <td className="py-3 text-emerald-300">{u.character_balance ?? 0}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                placeholder="Jumlah"
                                value={userAmounts[u.id] ?? ''}
                                onChange={(e) => setUserAmounts((prev) => ({ ...prev, [u.id]: e.target.value }))}
                                className="w-24 p-1 rounded bg-slate-800 text-xs text-center text-amber-400"
                              />
                              <button onClick={async () => {
                                const raw = userAmounts[u.id] ?? '';
                                const amount = Number(raw || 0);
                                if (!amount || Number.isNaN(amount) || amount <= 0) return alert('Masukkan nominal kuota yang valid (lebih dari 0).');
                                const confirmed = window.confirm(`Apakah Anda yakin ingin menambahkan ${amount} kuota ke user ${u.email || u.id}?`);
                                if (!confirmed) return;
                                const r = await performUserAction('add_balance', u.id, amount);
                                if (!r.ok) alert('Gagal menambahkan saldo: ' + r.error);
                                else {
                                  setUserAmounts((prev) => ({ ...prev, [u.id]: '' }));
                                }
                              }} className="px-3 py-1 bg-amber-500 rounded text-xs font-bold">Apply</button>

                              {u.is_banned ? (
                                /* FITUR 1: 🟢 AKTIFKAN KEMBALI (Unban) button — muncul jika user sedang banned */
                                <button onClick={async () => {
                                  const confirmed = window.confirm(`Apakah Anda yakin ingin mengaktifkan kembali (unban) user ${u.email || u.id}? Saldo ${u.character_balance ?? 0} akan kembali aktif.`);
                                  if (!confirmed) return;
                                  const r = await performUserAction('unban', u.id);
                                  if (!r.ok) alert('Gagal mengaktifkan kembali user: ' + r.error);
                                }} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-bold">🟢 AKTIFKAN KEMBALI</button>
                              ) : (
                                /* Tombol Ban — hanya muncul jika user tidak sedang banned */
                                <button onClick={async () => {
                                  const confirmed = window.confirm(`Apakah Anda yakin ingin membanned user ${u.email || u.id}? Saldo ${u.character_balance ?? 0} akan dibekukan.`);
                                  if (!confirmed) return;
                                  const r = await performUserAction('ban', u.id);
                                  if (!r.ok) alert('Gagal membanned user: ' + r.error);
                                }} className="px-3 py-1 bg-rose-600 rounded text-xs font-bold">🚫 BAN USER</button>
                              )}

                              <button onClick={() => impersonateUser(u)} className="px-3 py-1 bg-sky-500 rounded text-xs font-bold">👁️ Intip</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
 
        {showLiveMonitorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
            <div className="w-full max-w-4xl rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Live Monitor Online</div>
                  <div className="text-lg font-bold text-white">{onlineUsers.length} User Aktif</div>
                </div>
                <button onClick={() => setShowLiveMonitorModal(false)} className="text-slate-300 hover:text-white">Tutup</button>
              </div>
              <div className="max-h-[70vh] overflow-auto p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.15em] text-slate-500 border-b border-slate-800">
                      <th className="py-3">Email</th>
                      <th className="py-3">Terakhir</th>
                      <th className="py-3">Kuota</th>
                      <th className="py-3">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {onlineUsers.map((u) => {
                      const last = u.last_seen || u.last_active || null;
                      const lastText = last ? new Date(String(last)).toLocaleString() : '—';
                      return (
                        <tr key={u.id} className="align-top">
                          <td className="py-3">
                            <div className="font-bold">{u.email || u.id}</div>
                            <div className="text-[11px] text-slate-500">Online</div>
                          </td>
                          <td className="py-3 text-[13px] text-slate-300">{lastText}</td>
                          <td className="py-3 text-emerald-300">{u.character_balance ?? 0}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                placeholder="Jumlah"
                                value={userAmounts[u.id] ?? ''}
                                onChange={(e) => setUserAmounts((prev) => ({ ...prev, [u.id]: e.target.value }))}
                                className="w-24 p-1 rounded bg-slate-800 text-xs text-center text-amber-400"
                              />
                              <button onClick={async () => {
                                const raw = userAmounts[u.id] ?? '';
                                const amount = Number(raw || 0);
                                if (!amount || Number.isNaN(amount) || amount <= 0) return alert('Masukkan nominal kuota yang valid (lebih dari 0).');
                                const confirmed = window.confirm(`Apakah Anda yakin ingin menambahkan ${amount} kuota ke user ${u.email || u.id}?`);
                                if (!confirmed) return;
                                const r = await performUserAction('add_balance', u.id, amount);
                                if (!r.ok) alert('Gagal menambahkan saldo: ' + r.error);
                                else {
                                  setUserAmounts((prev) => ({ ...prev, [u.id]: '' }));
                                }
                              }} className="px-3 py-1 bg-amber-500 rounded text-xs font-bold">Apply</button>
                              <button onClick={async () => {
                                const confirmed = window.confirm(`Apakah Anda yakin ingin membanned user ${u.email || u.id}?`);
                                if (!confirmed) return;
                                const r = await performUserAction('ban', u.id);
                                if (!r.ok) alert('Gagal membanned user: ' + r.error);
                              }} className="px-3 py-1 bg-rose-600 rounded text-xs font-bold">🚫 BAN USER</button>
                              <button onClick={() => impersonateUser(u)} className="px-3 py-1 bg-sky-500 rounded text-xs font-bold">👁️ Intip</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {showVaultModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
            <div className="w-full max-w-4xl rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-400">API Vault Rahasia</div>
                  <div className="text-lg font-bold text-white">Google Gemini, OpenRouter & ElevenLabs (Vault)</div>
                </div>
                <button onClick={() => setShowVaultModal(false)} className="text-slate-300 hover:text-white">Tutup</button>
              </div>
              <div className="max-h-[70vh] overflow-auto p-4 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800">
                    <div className="text-xs uppercase tracking-[0.3em] text-amber-400 mb-3">Google Gemini Keys</div>
                    <div className="space-y-3">
                      {vaultKeys.gemini.map((key, index) => (
                        <div key={`gemini-${index}`} className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                          {editingKey?.type === 'gemini' && editingKey.index === index ? (
                            <input value={editingKey.value} onChange={(e) => setEditingKey({ ...editingKey, value: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm" />
                          ) : (
                            <span className="text-sm text-slate-200 font-mono">{maskKey(key)}</span>
                          )}
                          <div className="flex items-center gap-2">
                            {editingKey?.type === 'gemini' && editingKey.index === index ? (
                              <>
                                <button onClick={() => updateVaultKey('gemini', index, editingKey.value)} className="px-2 py-1 bg-emerald-500 rounded text-xs font-bold">Simpan</button>
                                <button onClick={() => setEditingKey(null)} className="px-2 py-1 bg-slate-700 rounded text-xs">Batal</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => setEditingKey({ type: 'gemini', index, value: key })} className="px-2 py-1 bg-amber-500 rounded text-xs font-bold">📝 Edit</button>
                                <button onClick={() => deleteVaultKey('gemini', index)} className="px-2 py-1 bg-rose-600 rounded text-xs font-bold">🗑️ Hapus</button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                      {vaultKeys.gemini.length === 0 && <div className="text-xs text-slate-500">Belum ada Gemini key tersimpan.</div>}
                    </div>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800">
                    <div className="text-xs uppercase tracking-[0.3em] text-emerald-400 mb-3">OpenRouter Keys</div>
                    <div className="space-y-3">
                      {vaultKeys.openrouter.map((key, index) => (
                        <div key={`openrouter-${index}`} className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                          {editingKey?.type === 'openrouter' && editingKey.index === index ? (
                            <input value={editingKey.value} onChange={(e) => setEditingKey({ ...editingKey, value: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm" />
                          ) : (
                            <span className="text-sm text-slate-200 font-mono">{maskKey(key)}</span>
                          )}
                          <div className="flex items-center gap-2">
                            {editingKey?.type === 'openrouter' && editingKey.index === index ? (
                              <>
                                <button onClick={() => updateVaultKey('openrouter', index, editingKey.value)} className="px-2 py-1 bg-emerald-500 rounded text-xs font-bold">Simpan</button>
                                <button onClick={() => setEditingKey(null)} className="px-2 py-1 bg-slate-700 rounded text-xs">Batal</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => setEditingKey({ type: 'openrouter', index, value: key })} className="px-2 py-1 bg-amber-500 rounded text-xs font-bold">📝 Edit</button>
                                <button onClick={() => deleteVaultKey('openrouter', index)} className="px-2 py-1 bg-rose-600 rounded text-xs font-bold">🗑️ Hapus</button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                      {vaultKeys.openrouter.length === 0 && <div className="text-xs text-slate-500">Belum ada OpenRouter key tersimpan.</div>}
                    </div>
                  </div>

                  <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800">
                    <div className="text-xs uppercase tracking-[0.3em] text-sky-400 mb-3">ElevenLabs Keys (TTS MP3)</div>
                    <div className="space-y-3">
                      {vaultKeys.elevenlabs.map((key, index) => (
                        <div key={`elevenlabs-${index}`} className="flex items-center gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                          {editingKey?.type === 'elevenlabs' && editingKey.index === index ? (
                            <input value={editingKey.value} onChange={(e) => setEditingKey({ ...editingKey, value: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm" />
                          ) : (
                            <span className="text-sm text-slate-200 font-mono">{maskKey(key)}</span>
                          )}
                          <div className="flex items-center gap-2">
                            {editingKey?.type === 'elevenlabs' && editingKey.index === index ? (
                              <>
                                <button onClick={() => updateVaultKey('elevenlabs', index, editingKey.value)} className="px-2 py-1 bg-emerald-500 rounded text-xs font-bold">Simpan</button>
                                <button onClick={() => setEditingKey(null)} className="px-2 py-1 bg-slate-700 rounded text-xs">Batal</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => setEditingKey({ type: 'elevenlabs', index, value: key })} className="px-2 py-1 bg-amber-500 rounded text-xs font-bold">📝 Edit</button>
                                <button onClick={() => deleteVaultKey('elevenlabs', index)} className="px-2 py-1 bg-rose-600 rounded text-xs font-bold">🗑️ Hapus</button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                      {vaultKeys.elevenlabs.length === 0 && <div className="text-xs text-slate-500">Belum ada ElevenLabs key tersimpan.</div>}
                    </div>
                  </div>
                </div>

                {/* 💳 KEY BERBAYAR (Cadangan) — kolom terpisah, TIDAK tercampur gratis */}
                <div className="mt-4 bg-slate-900 p-4 rounded-3xl border border-amber-500/40">
                  <div className="flex items-center gap-2 border-b border-amber-700/40 pb-2 mb-3">
                    <span className="text-lg">💳</span>
                    <div>
                      <div className="text-xs uppercase tracking-[0.3em] text-amber-400 font-bold">KEY BERBAYAR (CADANGAN)</div>
                      <div className="text-[11px] text-slate-400">Kolom terpisah — hanya dipakai bila SEMUA key gratis gagal, agar tagihan diminimalkan.</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-slate-300">Gemini Berbayar</label>
                      <input
                        value={paidGeminiKey}
                        onChange={(e) => setPaidGeminiKey(e.target.value)}
                        placeholder="Masukkan Gemini API key berbayar (cadangan)..."
                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded p-3 text-sm text-slate-100 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-300">OpenRouter Berbayar</label>
                      <input
                        value={paidOpenRouterKey}
                        onChange={(e) => setPaidOpenRouterKey(e.target.value)}
                        placeholder="Masukkan OpenRouter API key berbayar (cadangan)..."
                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded p-3 text-sm text-slate-100 font-mono"
                      />
                    </div>
                    <button
                      onClick={savePaidKeys}
                      disabled={paidSaving}
                      className="w-full py-3 bg-amber-500 text-slate-950 font-bold rounded-xl hover:bg-amber-600 transition-all disabled:opacity-50"
                    >
                      {paidSaving ? '💾 Menyimpan...' : '💾 SIMPAN KEY BERBAYAR (CADANGAN)'}
                    </button>
                  </div>
                </div>

                {/* 🎙️ ElevenLabs (TTS MP3) kini dikelola di Vault — lihat kolom "ElevenLabs Keys (TTS MP3)" di atas. */}

                <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-slate-300">Jenis Kunci</label>
                      <select value={newVaultType} onChange={(e) => setNewVaultType(e.target.value as 'gemini' | 'openrouter' | 'elevenlabs')} className="bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-100">
                        <option value="gemini">Google Gemini AQ</option>
                        <option value="openrouter">OpenRouter sk-or</option>
                        <option value="elevenlabs">ElevenLabs (sk-)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-slate-300">Kunci Baru</label>
                      <input value={newVaultKey} onChange={(e) => setNewVaultKey(e.target.value)} placeholder="Masukkan API key baru..." className="w-full mt-2 bg-slate-950 border border-slate-800 rounded p-3 text-sm text-slate-100" />
                    </div>
                    <button onClick={addVaultKey} className="w-full py-3 bg-emerald-500 text-slate-950 font-bold rounded-xl hover:bg-emerald-600 transition-all">➕ TAMBAH API KEY BARU</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showProfileModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-xl bg-slate-950 rounded-2xl border border-slate-800 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">🔒 Founder Profile Management</h3>
                <button onClick={() => setShowProfileModal(false)} className="text-slate-300 hover:text-white">Tutup</button>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Nama Founder</label>
                  <input value={founderProfile.name} onChange={(e) => setFounderProfile({ ...founderProfile, name: e.target.value })} className="w-full mt-1 bg-slate-900 border border-slate-800 rounded p-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Email Admin Utama</label>
                  <input value={founderProfile.email} onChange={(e) => setFounderProfile({ ...founderProfile, email: e.target.value })} className="w-full mt-1 bg-slate-900 border border-slate-800 rounded p-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Password Master (baru)</label>
                  <input type="password" value={founderPassword} onChange={(e) => setFounderPassword(e.target.value)} placeholder="Masukkan password baru (minimal 8 karakter)" className="w-full mt-1 bg-slate-900 border border-slate-800 rounded p-2 text-sm" />
                </div>

                <div className="flex justify-between items-center">
                  <button onClick={() => {
                    try {
                      localStorage.removeItem('admin_view_as_user');
                      localStorage.removeItem('founder_mock_users');
                      localStorage.removeItem('founder_mock_features');
                      localStorage.removeItem('founder_keys_gemini');
                      localStorage.removeItem('founder_keys_openrouter');
                      Object.keys(localStorage).forEach((k) => { try { if (k && String(k).startsWith('founder_config_')) localStorage.removeItem(k); } catch (e) {} });
                    } catch (e) {
                      // ignore
                    }
                    // navigate to user dashboard
                    window.location.replace('/dashboard');
                  }} className="px-4 py-2 bg-rose-600 text-white rounded font-bold">🚪 LOGOUT & PINDAH HALAMAN</button>

                  <div>
                    <button onClick={() => setShowProfileConfirmModal(true)} className="px-4 py-2 bg-emerald-500 text-slate-900 rounded font-bold">💾 PERBARUI KREDENSI MASTER</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showProfileConfirmModal && (
          <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md bg-slate-950 rounded-2xl border border-slate-800 p-6">
              <h4 className="font-bold">Konfirmasi Keamanan</h4>
              <p className="text-sm text-slate-400 mt-2">Anda akan memperbarui kredensial master Founder. Lanjutkan?</p>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setShowProfileConfirmModal(false)} className="px-4 py-2 bg-slate-700 rounded">Batal</button>
                <button onClick={async () => {
                  setShowProfileConfirmModal(false);
                  try {
                    const r = await saveFounderProfile(founderProfile, founderPassword);
                    if (r?.ok) {
                      alert('Kredensial Founder berhasil diperbarui (server).');
                    }
                  } catch (e) {
                    console.error(e);
                    alert('Gagal memperbarui kredensial.');
                  }
                  setShowProfileModal(false);
                }} className="px-4 py-2 bg-rose-600 text-white rounded font-bold">Ya, Simpan</button>
              </div>
            </div>
          </div>
        )}

        {/* 💬 FITUR 3: RUANG KENDALI LIVE CHAT CS */}
        <div className="bg-slate-900 rounded-3xl border border-cyan-500/30 p-6 shadow-2xl space-y-4 cursor-pointer" onClick={() => openModal('chatcs')}>
          <div className="flex items-center gap-2 border-b border-cyan-800 pb-3">
            <span className="text-xl">💬</span>
            <h3 className="text-md font-bold tracking-wide text-cyan-300">RUANG KENDALI LIVE CHAT CS</h3>
            <span className="ml-auto text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full">{openTicketCount} Tiket Aktif</span>
          </div>
          <p className="text-sm text-slate-400">Klik untuk membuka panel Live Chat CS. Pantau tiket aduan user, lihat riwayat chat, dan ambil alih secara manual.</p>
          <div className="flex justify-end">
            <button type="button" onClick={(e) => { e.stopPropagation(); openModal('chatcs'); }} className="px-6 py-3 bg-cyan-600 text-white font-bold text-xs rounded-xl shadow-lg hover:bg-cyan-500 transition-all">💬 BUKA RUANG KENDALI CHAT</button>
          </div>
        </div>

        {/* 💬 Chat CS Modal */}
        {showChatCSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
            <div className="w-full max-w-6xl rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden" style={{ maxHeight: '90vh' }}>
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-cyan-400">💬 Ruang Kendali Live Chat CS</div>
                  <div className="text-lg font-bold text-white">Tiket Aduan User</div>
                </div>
                <button onClick={() => { setShowChatCSModal(false); setSelectedTicket(null); setManualOverride(false); setFounderReply(''); }} className="text-slate-300 hover:text-white">Tutup</button>
              </div>

              {!selectedTicket ? (
                /* Daftar tiket */
                <div className="max-h-[70vh] overflow-auto p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-[0.15em] text-slate-500 border-b border-slate-800">
                        <th className="py-3">User</th>
                        <th className="py-3">Subjek</th>
                        <th className="py-3">Waktu</th>
                        <th className="py-3">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {chatTickets.map((ticket) => (
                        <tr key={ticket.id} className="align-top hover:bg-slate-900/50">
                          <td className="py-3 font-bold">{ticket.userEmail}</td>
                          <td className="py-3 text-slate-300">{ticket.subject}</td>
                          <td className="py-3 text-xs text-slate-400">{new Date(ticket.timestamp).toLocaleString()}</td>
                          <td className="py-3">
                            <button onClick={() => setSelectedTicket(ticket)} className="px-3 py-1 bg-cyan-600 rounded text-xs font-bold">🔍 BUKA</button>
                          </td>
                        </tr>
                      ))}
                      {chatTickets.length === 0 && (
                        <tr><td colSpan={4} className="py-6 text-center text-slate-500">Belum ada tiket aduan masuk.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Layar pemantauan ganda: KOLOM KIRI (Chat CS) + KOLOM KANAN (Chat History / Mata Dewa) */
                <div className="flex flex-col md:flex-row max-h-[70vh] overflow-hidden">
                  {/* KOLOM KIRI: Aduan user + balasan AI CS */}
                  <div className="flex-1 p-4 border-r border-slate-800 flex flex-col overflow-hidden">
                    <div className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-2">🎫 Tiket: {selectedTicket.subject}</div>
                    <div className="text-[11px] text-slate-500 mb-3">User: {selectedTicket.userEmail}</div>
                    <div className="flex-1 overflow-y-auto space-y-3 mb-3" style={{ maxHeight: '350px' }}>
                      {selectedTicket.messages.map((msg, i) => (
                        <div key={i} className={`p-3 rounded-xl text-sm ${msg.from === 'user' ? 'bg-slate-800 ml-6' : msg.from === 'ai' ? 'bg-emerald-900/30 border border-emerald-800/30 mr-6' : 'bg-cyan-900/30 border border-cyan-800/30 mr-6'}`}>
                          <div className="text-[10px] text-slate-500 mb-1">
                            {msg.from === 'user' ? '👤 User' : msg.from === 'ai' ? '🤖 AI CS' : '👑 Founder'} · {msg.time}
                          </div>
                          <div>{msg.text}</div>
                        </div>
                      ))}
                      {manualOverride && (
                        <div className="text-xs text-cyan-400 animate-pulse text-center">⏳ Manual Override Aktif — AI CS dibekukan</div>
                      )}
                    </div>

                    {/* Input balasan Founder / Manual Override */}
                    {manualOverride ? (
                      <div className="space-y-2">
                        <textarea
                          value={founderReply}
                          onChange={(e) => setFounderReply(e.target.value)}
                          placeholder="Ketik balasan personal Anda sebagai Founder..."
                          className="w-full bg-slate-900 border border-cyan-600 rounded p-3 text-sm text-slate-100 min-h-[80px]"
                        />
                        <div className="flex gap-2">
                          <button onClick={sendFounderReply} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded text-xs font-bold">📤 KIRIM BALASAN</button>
                          <button onClick={() => setManualOverride(false)} className="px-4 py-2 bg-slate-700 rounded text-xs font-bold">🔁 KEMBALIKAN KE AI CS</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setManualOverride(true)} className="w-full py-3 bg-rose-600 hover:bg-rose-700 rounded text-xs font-bold animate-pulse">🛑 AMBIL ALIH CHAT (MANUAL OVERRIDE)</button>
                    )}

                    {/* 3 tombol shortcut eksekusi */}
                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-800">
                      <button onClick={() => chatQuickAction('unban', selectedTicket.userEmail)} className="flex-1 px-2 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-[10px] font-bold">🟢 PULIHKAN AKUN</button>
                      <button onClick={() => chatQuickAction('add_balance', selectedTicket.userEmail)} className="flex-1 px-2 py-2 bg-amber-600 hover:bg-amber-500 rounded text-[10px] font-bold">💰 ISI MANUAL SALDO</button>
                      <button onClick={() => chatQuickAction('ban', selectedTicket.userEmail)} className="flex-1 px-2 py-2 bg-rose-600 hover:bg-rose-500 rounded text-[10px] font-bold">❌ BAN PERMANEN</button>
                    </div>
                  </div>

                  {/* KOLOM KANAN: Mata Dewa — seluruh riwayat ketikan user */}
                  <div className="flex-1 p-4 flex flex-col overflow-hidden bg-slate-900/30">
                    <div className="text-xs uppercase tracking-[0.3em] text-amber-400 mb-2">👁️ MATA DEWA — RIWAYAT CHAT USER</div>
                    <div className="text-[11px] text-slate-500 mb-3">Seluruh aktivitas {selectedTicket.userEmail} di aplikasi</div>
                    <div className="flex-1 overflow-y-auto space-y-2" style={{ maxHeight: '350px' }}>
                      {selectedTicket.chatHistory.map((entry, i) => (
                        <div key={i} className="p-2 bg-slate-800/50 rounded border border-slate-700/30 text-sm">
                          <div className="text-[10px] text-slate-500 mb-1">🕐 {entry.time} · Fitur: {entry.feature}</div>
                          <div className="text-slate-200">{entry.text}</div>
                        </div>
                      ))}
                      <div className="text-[10px] text-slate-600 mt-4 p-2 italic border-t border-slate-700">
                        🔍 Investigasi: Jika user ter-ban karena typo tidak sengaja, gunakan tombol 🟢 PULIHKAN AKUN. Jika sengaja menyerang sistem, gunakan ❌ BAN PERMANEN.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 🎛️ FITUR 4: FOUNDER CONFIGURATION HUB */}
        <div className="bg-slate-900 rounded-3xl border border-purple-500/30 p-6 shadow-2xl space-y-4 cursor-pointer" onClick={() => openModal('confighub')}>
          <div className="flex items-center gap-2 border-b border-purple-800 pb-3">
            <span className="text-xl">🎛️</span>
            <h3 className="text-md font-bold tracking-wide text-purple-300">FOUNDER CONFIGURATION HUB</h3>
          </div>
          <p className="text-sm text-slate-400">Klik untuk mengubah harga paket, batas input karakter, dan sakelar QRIS langsung dari browser.</p>
          <div className="flex justify-end">
            <button type="button" onClick={(e) => { e.stopPropagation(); openModal('confighub'); }} className="px-6 py-3 bg-purple-600 text-white font-bold text-xs rounded-xl shadow-lg hover:bg-purple-500 transition-all">🎛️ BUKA CONFIG HUB</button>
          </div>
        </div>

        {showConfigHub && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
            <div className="w-full max-w-4xl rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-purple-400">🎛️ Founder Configuration Hub</div>
                  <div className="text-lg font-bold text-white">Edit Pengaturan Platform</div>
                </div>
                <button onClick={() => setShowConfigHub(false)} className="text-slate-300 hover:text-white">Tutup</button>
              </div>
              <div className="max-h-[70vh] overflow-auto p-6 space-y-6">
                {/* Harga 3 Paket Cuan */}
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                  <h4 className="font-bold text-sm text-amber-400 mb-4">💰 Harga 3 Paket Cuan & Jatah Karakter AI</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                      <div className="text-xs font-bold text-slate-300">📦 Paket Pemula</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">Rp</span>
                        <input value={configHub.package_pemula_price} onChange={(e) => setConfigHub({ ...configHub, package_pemula_price: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-center text-amber-400" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">Karakter</span>
                        <input value={configHub.package_pemula_chars} onChange={(e) => setConfigHub({ ...configHub, package_pemula_chars: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-center text-emerald-400" />
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                      <div className="text-xs font-bold text-slate-300">📦 Paket Pro</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">Rp</span>
                        <input value={configHub.package_pro_price} onChange={(e) => setConfigHub({ ...configHub, package_pro_price: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-center text-amber-400" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">Karakter</span>
                        <input value={configHub.package_pro_chars} onChange={(e) => setConfigHub({ ...configHub, package_pro_chars: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-center text-emerald-400" />
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                      <div className="text-xs font-bold text-slate-300">📦 Paket Founder Choice</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">Rp</span>
                        <input value={configHub.package_founder_price} onChange={(e) => setConfigHub({ ...configHub, package_founder_price: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-center text-amber-400" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">Karakter</span>
                        <input value={configHub.package_founder_chars} onChange={(e) => setConfigHub({ ...configHub, package_founder_chars: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-center text-emerald-400" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Batasan Maksimal Input Karakter */}
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                  <h4 className="font-bold text-sm text-cyan-400 mb-4">✏️ Batasan Maksimal Input Karakter User</h4>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={100}
                      max={10000}
                      value={configHub.max_input_chars}
                      onChange={(e) => setConfigHub({ ...configHub, max_input_chars: e.target.value })}
                      className="w-32 bg-slate-800 border border-slate-700 rounded p-2 text-sm text-center text-cyan-400 font-mono"
                    />
                    <span className="text-xs text-slate-400">Karakter per input (maksimal)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">Filter frontend maxLength akan menyesuaikan secara dinamis. Nilai default: 1000</p>
                </div>

                {/* Sakelar ON/OFF Darurat Gerbang QRIS */}
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                  <h4 className="font-bold text-sm text-emerald-400 mb-4">🔒 Sakelar Darurat Gerbang QRIS</h4>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-mono font-bold px-3 py-1 rounded ${configHub.qris_enabled === 'true' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {configHub.qris_enabled === 'true' ? '✅ QRIS AKTIF' : '❌ QRIS NONAKTIF (MAINTENANCE)'}
                      </span>
                    </div>
                    <button
                      onClick={() => setConfigHub({ ...configHub, qris_enabled: configHub.qris_enabled === 'true' ? 'false' : 'true' })}
                      className={`w-14 h-7 rounded-full p-1 transition-colors duration-200 focus:outline-none ${configHub.qris_enabled === 'true' ? 'bg-emerald-600' : 'bg-rose-600'}`}
                    >
                      <div className={`bg-white w-5 h-5 rounded-full shadow-md transform duration-200 ${configHub.qris_enabled === 'true' ? 'translate-x-7' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">Jika OFF, tombol pembayaran QRIS di halaman checkout user otomatis tersembunyi dan menampilkan notifikasi maintenance.</p>
                </div>

                {/* ✏️ UBAH NAMA MEREK PLATFORM */}
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                  <h4 className="font-bold text-sm text-orange-400 mb-4">✏️ UBAH NAMA MEREK PLATFORM</h4>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={configHub.platform_name}
                      onChange={(e) => setConfigHub({ ...configHub, platform_name: e.target.value })}
                      placeholder="BIKIN AI"
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-center text-amber-400 font-bold"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">Nama merek ini akan muncul di seluruh tampilan depan user (Header, Footer, Dashboard, Title). Default: BIKIN AI</p>
                </div>

                {/* 📁 UPLOAD & MANAGEMENT LOGO RESMI PLATFORM */}
                <div className="bg-slate-900 p-4 rounded-2xl border border-amber-500/30">
                  <h4 className="font-bold text-sm text-amber-400 mb-4">📁 UPLOAD & MANAGEMENT LOGO RESMI PLATFORM</h4>
                  <div className="space-y-4">
                    {/* Logo Preview */}
                    <div className="flex flex-col items-center gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Preview Logo Saat Ini</div>
                      {logoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoPreview} alt="Logo Preview" className="h-20 w-auto max-w-[200px] object-contain border border-slate-700 rounded-lg p-1" />
                      ) : (
                        <div className="h-20 w-32 flex items-center justify-center border border-dashed border-slate-700 rounded-lg text-slate-600 text-xs text-center">
                          Belum ada logo. Upload file baru di bawah.
                        </div>
                      )}
                    </div>

                    {/* Custom File Input */}
                    <div className="space-y-2">
                      <label className="block text-xs text-slate-400">Pilih File Gambar Logo (.png, .jpg, .svg — maks 2MB)</label>
                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/40 rounded-lg text-xs font-bold text-amber-400 hover:bg-amber-500/30 transition-all">
                          📁 Pilih File Logo
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                            onChange={handleLogoFileChange}
                            className="hidden"
                          />
                        </label>
                        {logoFile && (
                          <span className="text-xs text-slate-300 font-mono">{logoFile.name} ({(logoFile.size / 1024).toFixed(1)} KB)</span>
                        )}
                      </div>
                    </div>

                    {/* Save Logo Button */}
                    <button
                      onClick={saveLogo}
                      disabled={!logoFile || logoUploading}
                      className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold rounded-xl hover:from-amber-400 hover:to-orange-400 transition-all text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {logoUploading ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent animate-spin" />
                          Mengunggah Logo...
                        </span>
                      ) : (
                        <>💾 SIMPAN LOGO</>
                      )}
                    </button>
                    <p className="text-[10px] text-slate-500 mt-1">Logo yang disimpan akan otomatis menggantikan logo lama di seluruh tampilan user (Header, Sidebar, Footer) secara real-time. File lama akan dihapus otomatis.</p>
                  </div>
                </div>

                {/* 📁 HUB MANAGEMENT SEO & HASHTAG GOOGLE */}
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                  <h4 className="font-bold text-sm text-sky-400 mb-4">📁 HUB MANAGEMENT SEO & HASHTAG GOOGLE</h4>
                  <textarea
                    value={configHub.seo_hashtags}
                    onChange={(e) => setConfigHub({ ...configHub, seo_hashtags: e.target.value })}
                    placeholder="AI Indonesia, GPT Indonesia, AI Nusantara..."
                    rows={4}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-200"
                  />
                  <p className="text-[10px] text-slate-500 mt-2">Hashtag / keywords ini akan dipasang di meta tag {'<meta name="keywords">'} HTML secara otomatis. GHAIB tidak terlihat di layar, tapi terdeteksi Google. Pisahkan dengan koma.</p>
                </div>

                <button onClick={saveConfigHub} className="w-full py-4 bg-gradient-to-r from-purple-600 to-emerald-600 text-white font-bold rounded-xl hover:from-purple-500 hover:to-emerald-500 transition-all text-sm">💾 SIMPAN SEMUA KONFIGURASI</button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
            <div className="text-2xl">🚨</div>
            <h2 className="text-sm font-medium text-slate-400">Global Maintenance Mode</h2>
            <div className="flex items-center justify-between pt-2">
              <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${maintenance ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {maintenance ? "SERVER MATI (ON)" : "SERVER AKTIF (OFF)"}
              </span>
              <button onClick={toggleMaintenance} className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${maintenance ? 'bg-rose-600' : 'bg-slate-700'}`}>
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ${maintenance ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-2 shadow-xl">
            <div className="text-2xl">💰</div>
            <h2 className="text-sm font-medium text-slate-400">Total Omzet Live (QRIS)</h2>
            <p className="text-2xl font-bold text-emerald-400 pt-2 font-mono">{formatRupiah(totalOmzet)}</p>
            <p className="text-[10px] text-slate-500 font-mono">Auto-Sync dengan Midtrans</p>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
            <div className="text-2xl">📊</div>
            <h2 className="text-sm font-medium text-slate-400">Kuota Karakter Gratis</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={quota}
                  onChange={(e) => setQuota(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-center font-mono text-amber-400 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 whitespace-nowrap">Huruf / Sesi</span>
              </div>
              <button onClick={applyQuota} className="w-full py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] rounded transition-all">💾 TERAPKAN ATURAN</button>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
            <div className="text-2xl">💳</div>
            <h2 className="text-sm font-medium text-slate-400">Harga Paket per 1K Karakter</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">Rp</span>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-center font-mono text-emerald-400 focus:outline-none"
                />
              </div>
              <button onClick={applyPrice} className="w-full py-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-[10px] rounded transition-all">💾 UPDATE HARGA</button>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl space-y-6 cursor-pointer" onClick={() => openModal('vault')}>
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <span className="text-xl">🔑</span>
            <h3 className="text-md font-bold tracking-wide text-slate-200">KOLAM TOKEN GLOBAL (VAULT API KEY RAHASIA)</h3>
          </div>
 
          <p className="text-sm text-slate-400">Klik untuk membuka Vault API yang aman. Simpan dan kelola kunci Google Gemini, OpenRouter, maupun ElevenLabs (TTS MP3) secara terpisah, tanpa menampilkan nilai sensitif di tampilan utama.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
              <div className="text-xs uppercase tracking-[0.3em] text-amber-400">Google Gemini Keys</div>
              <div className="mt-3 text-2xl font-bold text-slate-100">{vaultKeys.gemini.length}</div>
              <div className="text-[11px] text-slate-500">Kunci AQ tersimpan di Vault.</div>
            </div>
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
              <div className="text-xs uppercase tracking-[0.3em] text-emerald-400">OpenRouter Keys</div>
              <div className="mt-3 text-2xl font-bold text-slate-100">{vaultKeys.openrouter.length}</div>
              <div className="text-[11px] text-slate-500">Kunci sk-or tersimpan di Vault.</div>
            </div>
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
              <div className="text-xs uppercase tracking-[0.3em] text-sky-400">ElevenLabs Keys (TTS MP3)</div>
              <div className="mt-3 text-2xl font-bold text-slate-100">{vaultKeys.elevenlabs.length}</div>
              <div className="text-[11px] text-slate-500">Kunci sk- (TTS MP3) tersimpan di Vault.</div>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="button" onClick={(e) => { e.stopPropagation(); openModal('vault'); }} className="px-6 py-3 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg hover:bg-emerald-600 transition-all">🔐 BUKA VAULT API</button>
          </div>
        </div>

        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
            <span className="text-xl">🛠️</span>
            <h3 className="text-md font-bold tracking-wide text-slate-200">PLATFORM MANAGEMENT HUB (AKSES KONTROL MUTLAK)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button onClick={() => openModal('all')} className="p-6 bg-slate-800/40 hover:bg-slate-800 rounded-2xl border border-slate-700/50 text-left transition-all group space-y-2">
              <div className="text-xl group-hover:scale-110 transition-transform">👥</div>
              <h4 className="font-bold text-sm text-slate-200">👥 Manajemen Pengguna & Banned</h4>
              <p className="text-xs text-slate-400">Kelola akun user, tambah saldo kuota, atau ban akun dari antarmuka ini.</p>
            </button>

            <button onClick={() => window.location.href = '/x-founder-control-99f7jK/audit-log'} className="p-6 bg-slate-800/40 hover:bg-slate-800 rounded-2xl border border-slate-700/50 text-left transition-all group space-y-2">
              <div className="text-xl group-hover:scale-110 transition-transform">📋</div>
              <h4 className="font-bold text-sm text-slate-200">📋 Audit Log & Security Monitor</h4>
              <p className="text-xs text-slate-400">Akses log keamanan, insiden siber, dan deteksi bot.</p>
            </button>

            <button onClick={() => setShowFeaturesPanel(!showFeaturesPanel)} className="p-6 bg-slate-800/40 hover:bg-slate-800 rounded-2xl border border-slate-700/50 text-left transition-all group space-y-2">
                            <div className="text-xl group-hover:scale-110 transition-transform">📑</div>
              <h4 className="font-bold text-sm text-slate-200">📑 Manajemen Konten {features.length} Fitur</h4>
              <p className="text-xs text-slate-400">Ubah atau tambahkan system prompt {features.length} Fitur langsung dari browser tanpa menyentuh kode.</p>
            </button>
          </div>


          {showFeaturesPanel && (
            <div className="mt-6 bg-slate-900/50 p-4 rounded-lg border border-slate-800 space-y-4">
                                                        <h4 className="font-bold">{features.length} Fitur - System Prompts</h4>
              <div className="space-y-4 max-h-96 overflow-auto">
                {/* Kolom Tambah / Edit Prompt Manual beserta aturan temperatur */}
                <div className="p-3 rounded-lg border border-dashed border-slate-700 bg-slate-800/30 space-y-3">
                  <div className="text-xs font-bold text-amber-400">➕ Tambah Fitur Manual (Prompt + Temperature)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] text-slate-400 mb-0.5">Nama Fitur</label>
                      <input type="text" value={newFeatureDraft.feature_name ?? ""} onChange={(e) => setNewFeatureDraft({ ...newFeatureDraft, feature_name: e.target.value })} className="w-full px-2 py-1 text-sm bg-slate-900 rounded" placeholder="💬 Chat AI" />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-400 mb-0.5">Slug (huruf kecil &amp; -)</label>
                      <input type="text" value={newFeatureDraft.feature_slug ?? ""} onChange={(e) => setNewFeatureDraft({ ...newFeatureDraft, feature_slug: e.target.value })} className="w-full px-2 py-1 text-sm bg-slate-900 rounded" placeholder="chat-ai" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-400 mb-0.5">System Prompt (aturan keaijian)</label>
                    <textarea value={newFeatureDraft.system_prompt ?? ""} onChange={(e) => setNewFeatureDraft({ ...newFeatureDraft, system_prompt: e.target.value })} className="w-full min-h-[70px] px-2 py-1 text-sm bg-slate-900 rounded" placeholder="Kamu adalah..." />
                  </div>
                  <div className="flex items-end gap-4">
                    <div>
                      <label className="block text-[9px] text-slate-400 mb-0.5">Temperature</label>
                      <input type="number" min={0} max={1} step={0.1} value={Number(newFeatureDraft.temperature ?? 0)} onChange={(e) => setNewFeatureDraft({ ...newFeatureDraft, temperature: Number(e.target.value) })} className="w-24 px-2 py-1 text-sm bg-slate-900 rounded" />
                      <div className="text-[9px] text-slate-500">0.0 = ketat/presisi · 0.5 = netral · 0.7 = kreatif · 1.0 = bebas</div>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] text-slate-300 mt-4">
                      <input type="checkbox" checked={Boolean(newFeatureDraft.is_active)} onChange={(e) => setNewFeatureDraft({ ...newFeatureDraft, is_active: e.target.checked })} /> Aktif
                    </div>
                    <button onClick={addFeatureManual} className="ml-auto mt-3.5 px-3 py-1 bg-amber-400 rounded text-xs font-bold text-slate-950">Tambah Fitur</button>
                  </div>
                </div>
                {features.map((f) => (
                  <div key={f.id} className="p-3 bg-slate-800/30 rounded space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold">{f.feature_name} ({f.feature_slug})</div>
                      <div className="text-xs text-slate-400">Active: {f.is_active ? 'Yes' : 'No'}</div>
                    </div>
                    <textarea value={f.system_prompt} onChange={(e) => setFeatures((prev) => prev.map(p => p.id === f.id ? { ...p, system_prompt: e.target.value } : p))} className="w-full min-h-[80px] bg-slate-900 p-2 rounded text-sm" />
                    <div className="flex items-center gap-2">
                      <input type="number" value={Number(f.temperature ?? 0)} onChange={(e) => setFeatures((prev) => prev.map(p => p.id === f.id ? { ...p, temperature: Number(e.target.value) } : p))} className="w-24 p-1 text-sm rounded bg-slate-900/40" />
                      <button onClick={() => saveFeature(f)} className="px-3 py-1 bg-emerald-500 rounded text-xs font-bold">Simpan</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}