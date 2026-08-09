"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import ReleaseControlPanel from "@/components/ReleaseControlPanel";

type User = { id: string; email?: string; role?: string; character_balance?: number; is_banned?: boolean; last_seen?: string | null; last_active?: string | null };
type Feature = { id: number; feature_slug: string; feature_name: string; system_prompt: string; temperature?: number; is_active?: boolean; seo_title?: string | null; seo_description?: string | null };

const MOCK_USERS: User[] = [
  { id: 'user_mock_1', email: 'demo1@example.com', role: 'user', character_balance: 1200, is_banned: false, last_seen: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
  { id: 'user_mock_2', email: 'demo2@example.com', role: 'user', character_balance: 300, is_banned: false, last_seen: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
];

// Mock chat tickets for Live Chat CS Room
type ChatTicket = {
  id: string;
  userEmail: string;
  subject: string;
  timestamp: string;
  messages: Array<{ from: 'user' | 'ai' | 'founder'; text: string; time: string }>;
  chatHistory: Array<{ text: string; time: string; feature: string }>;
};

const MOCK_CHAT_TICKETS: ChatTicket[] = [
  {
    id: 'ticket_1',
    userEmail: 'demo1@example.com',
    subject: 'Kenapa AI saya berhenti di tengah?',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    messages: [
      { from: 'user', text: 'Halo, AI saya berhenti nulis di tengah. Kenapa ya?', time: '10:32' },
      { from: 'ai', text: 'Maaf atas ketidaknyamanannya. Silakan coba refresh halaman dan pastikan koneksi internet stabil. Jika masih terjadi, kami akan bantu periksa.', time: '10:33' },
    ],
    chatHistory: [
      { text: 'Buatkan saya RPP Matematika kelas 5', time: '10:30', feature: 'Gen RPP' },
      { text: 'Tambahin soal cerita tentang pecahan', time: '10:31', feature: 'Buat Soal' },
      { text: 'Koreksi jawaban tugas saya', time: '10:31', feature: 'Koreksi Tugas' },
    ],
  },
  {
    id: 'ticket_2',
    userEmail: 'demo2@example.com',
    subject: 'Saldo saya berkurang padahal tidak dipakai',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    messages: [
      { from: 'user', text: 'Saldo saya berkurang 200 padahal saya tidak pakai fitur apapun', time: '10:15' },
      { from: 'ai', text: 'Kami akan periksa riwayat penggunaan akun Anda. Sementara, tidak ada transaksi mencurigakan yang tercatat. Mohon tunggu investigasi lebih lanjut.', time: '10:16' },
    ],
    chatHistory: [
      { text: 'Generate caption IG untuk produk skincare', time: '09:45', feature: 'Caption IG' },
      { text: 'Buat ide bisnis kuliner', time: '09:50', feature: 'Ide Bisnis' },
      { text: 'Halo?', time: '10:10', feature: '—' },
      { text: 'Tes tes 123', time: '10:11', feature: '—' },
    ],
  },
];

export default function FounderDashboard() {
  const [maintenance, setMaintenance] = useState(false);
  const [quota, setQuota] = useState("500");
  const [price, setPrice] = useState("15000");
  const [geminiKey, setGeminiKey] = useState("");
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [loading, setLoading] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
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

  const [vaultKeys, setVaultKeys] = useState({ gemini: [] as string[], openrouter: [] as string[] });
  const [newVaultKey, setNewVaultKey] = useState("");
  const [newVaultType, setNewVaultType] = useState<"gemini" | "openrouter">("gemini");
  const [editingKey, setEditingKey] = useState<{ type: "gemini" | "openrouter"; index: number; value: string } | null>(null);

  // live users and credit guard state
  const [liveUsers, setLiveUsers] = useState<User[]>([]);
  const [creditPauseActive, _setCreditPauseActive] = useState(false);

  // 💬 Live Chat CS Room state
  const [showChatCSModal, setShowChatCSModal] = useState(false);
  const [chatTickets] = useState<ChatTicket[]>(MOCK_CHAT_TICKETS);
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
            if (storedGeminiKeys) setVaultKeys((prev) => ({ ...prev, gemini: JSON.parse(storedGeminiKeys) }));
            if (storedOpenRouterKeys) setVaultKeys((prev) => ({ ...prev, openrouter: JSON.parse(storedOpenRouterKeys) }));

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

  function saveVaultKeys(next: { gemini: string[]; openrouter: string[] }) {
    try {
      setVaultKeys(next);
      localStorage.setItem('founder_keys_gemini', JSON.stringify(next.gemini));
      localStorage.setItem('founder_keys_openrouter', JSON.stringify(next.openrouter));
    } catch {
      // ignore
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


  function addVaultKey() {
    if (!newVaultKey.trim()) return alert('Masukkan API key terlebih dahulu.');
    const next = { ...vaultKeys };
    if (newVaultType === 'gemini') next.gemini = [...next.gemini, newVaultKey.trim()];
    else next.openrouter = [...next.openrouter, newVaultKey.trim()];
    saveVaultKeys(next);
    setNewVaultKey('');
    alert('API key baru berhasil ditambahkan ke Vault.');
  }

  function updateVaultKey(type: 'gemini' | 'openrouter', index: number, value: string) {
    const next = { ...vaultKeys };
    if (type === 'gemini') next.gemini[index] = value;
    else next.openrouter[index] = value;
    saveVaultKeys(next);
    setEditingKey(null);
    alert('API key berhasil diperbarui.');
  }

  function deleteVaultKey(type: 'gemini' | 'openrouter', index: number) {
    const next = { ...vaultKeys };
    if (type === 'gemini') next.gemini = next.gemini.filter((_, i) => i !== index);
    else next.openrouter = next.openrouter.filter((_, i) => i !== index);
    saveVaultKeys(next);
    alert('API key telah dihapus dari Vault.');
  }

  // Overwrite fetching: use local in-memory mock data only
  function initLocalUsersAndFeatures() {
    try {
            const storedUsers = localStorage.getItem('founder_mock_users');
            if (storedUsers) {
              setUsers(JSON.parse(storedUsers));
            } else {
              setUsers(MOCK_USERS);
              try { localStorage.setItem('founder_mock_users', JSON.stringify(MOCK_USERS)); } catch {}
            }

            const storedFeatures = localStorage.getItem('founder_mock_features');
            if (storedFeatures) {
              setFeatures(JSON.parse(storedFeatures));
            } else {
              const defaultFeatures: Feature[] = [
                { id: 1, feature_slug: 'gen-rpp', feature_name: 'Gen RPP', system_prompt: 'Instruksi RPP...', temperature: 0.2, is_active: true },
                { id: 2, feature_slug: 'buat-soal', feature_name: 'Buat Soal', system_prompt: 'Instruksi buat soal...', temperature: 0.3, is_active: true },
                { id: 3, feature_slug: 'koreksi-tugas', feature_name: 'Koreksi Tugas', system_prompt: 'Instruksi koreksi...', temperature: 0.2, is_active: true },
                { id: 4, feature_slug: 'bahan-ajar', feature_name: 'Bahan Ajar', system_prompt: 'Instruksi bahan ajar...', temperature: 0.2, is_active: true },
                { id: 5, feature_slug: 'tiktok-viral', feature_name: 'TikTok Viral', system_prompt: 'Instruksi tiktok...', temperature: 0.6, is_active: true },
                { id: 6, feature_slug: 'caption-ig', feature_name: 'Caption IG', system_prompt: 'Instruksi caption...', temperature: 0.6, is_active: true },
                { id: 7, feature_slug: 'ide-bisnis', feature_name: 'Ide Bisnis', system_prompt: 'Instruksi ide bisnis...', temperature: 0.4, is_active: true },
                { id: 8, feature_slug: 'bahasa-formal', feature_name: 'Bahasa Formal', system_prompt: 'Instruksi bahasa formal...', temperature: 0.2, is_active: true },
                { id: 9, feature_slug: 'bedah-jurnal', feature_name: 'Bedah Jurnal', system_prompt: 'Instruksi bedah jurnal...', temperature: 0.2, is_active: true },
                { id: 10, feature_slug: 'rangkum-buku', feature_name: 'Rangkum Buku', system_prompt: 'Instruksi rangkum buku...', temperature: 0.2, is_active: true },
                { id: 11, feature_slug: 'kerangka-skripsi', feature_name: 'Kerangka Skripsi', system_prompt: 'Instruksi kerangka skripsi...', temperature: 0.2, is_active: true },
              ];
              setFeatures(defaultFeatures);
              try { localStorage.setItem('founder_mock_features', JSON.stringify(defaultFeatures)); } catch {}
            }
    } catch (e) {
            setUsers(MOCK_USERS);
            setFeatures([]);
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

  useEffect(() => {
    const protectFounderPanel = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          router.push("/login");
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("founder")
          .select("role")
          .eq("id", user.id)
          .maybeSingle<{ role: string }>();

        if (profileError || profileData?.role !== "founder") {
          router.push("/dashboard");
          return;
        }
      } catch {
        router.push("/login");
      }
    };

    protectFounderPanel();

    // initialize fully from localStorage/mock only — safe-mode
    loadLocalConfigs();
    initLocalUsersAndFeatures();
    loadFounderProfile();
    refreshLiveUsersLocal();
    const iv = setInterval(() => {
            refreshLiveUsersLocal();
    }, 10000);
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
    alert('Perubahan Global Maintenance Mode tersimpan (local).');
  }

  async function applyQuota() {
    const value = String(Number(quota) || 0);
    await postConfig('free_quota', value);
    alert('Batas kuota berhasil diperbarui (local).');
  }

  async function applyPrice() {
    const value = String(Number(price) || 0);
    await postConfig('price_per_1k', value);
    alert('Harga paket berhasil diperbarui (local).');
  }

  async function applyKeys() {
    if (!geminiKey && !openRouterKey) return alert('Masukkan setidaknya satu API key untuk diperbarui.');
    if (geminiKey) await postConfig('gemini_api_key', geminiKey);
    if (openRouterKey) await postConfig('openrouter_api_key', openRouterKey);
    setGeminiKey(''); setOpenRouterKey('');
    alert('Kunci API berhasil diperbarui dan disimpan secara lokal.');
  }

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
    const idx = chatTickets.findIndex((t) => t.id === selectedTicket.id);
    if (idx !== -1) chatTickets[idx] = updated;
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
            <div className="mt-3 text-4xl font-bold text-slate-100 animate-pulse">{activeUsers.length}</div>
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
                  <div className="text-lg font-bold text-white">Google Gemini & OpenRouter Keys</div>
                </div>
                <button onClick={() => setShowVaultModal(false)} className="text-slate-300 hover:text-white">Tutup</button>
              </div>
              <div className="max-h-[70vh] overflow-auto p-4 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                </div>

                <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-slate-300">Jenis Kunci</label>
                      <select value={newVaultType} onChange={(e) => setNewVaultType(e.target.value as 'gemini' | 'openrouter')} className="bg-slate-950 border border-slate-800 rounded p-2 text-sm text-slate-100">
                        <option value="gemini">Google Gemini AQ</option>
                        <option value="openrouter">OpenRouter sk-or</option>
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
            <span className="ml-auto text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full">{chatTickets.length} Tiket Aktif</span>
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
            <p className="text-2xl font-bold text-emerald-400 pt-2 font-mono">Rp134.500.000</p>
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
 
          <p className="text-sm text-slate-400">Klik untuk membuka Vault API yang aman. Simpan dan kelola kunci Google Gemini atau OpenRouter Anda secara terpisah, tanpa menampilkan nilai sensitif di tampilan utama.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <h4 className="font-bold text-sm text-slate-200">📑 Manajemen Konten 11 Fitur</h4>
              <p className="text-xs text-slate-400">Ubah atau tambahkan system prompt 11 Fitur langsung dari browser tanpa menyentuh kode.</p>
            </button>
          </div>


          {showFeaturesPanel && (
            <div className="mt-6 bg-slate-900/50 p-4 rounded-lg border border-slate-800 space-y-4">
              <h4 className="font-bold">11 Fitur - System Prompts</h4>
              <div className="space-y-4 max-h-96 overflow-auto">
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