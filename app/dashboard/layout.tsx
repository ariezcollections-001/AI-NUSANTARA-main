"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Coins, RefreshCw, Settings, History, LogOut, ChevronDown, AlertTriangle, ShoppingCart } from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function getPlatformName(): string {
  if (typeof window === "undefined") return "BIKIN AI";
  try {
    return localStorage.getItem("founder_config_platform_name") || "BIKIN AI";
  } catch {
    return "BIKIN AI";
  }
}

function getPlatformLogo(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem("founder_config_platform_logo") || "";
  } catch {
    return "";
  }
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [characterBalance, setCharacterBalance] = useState<number>(0);
  const [platformName, setPlatformName] = useState("BIKIN AI");
  const [platformLogo, setPlatformLogo] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setPlatformName(getPlatformName());
    setPlatformLogo(getPlatformLogo());
    const handler = () => {
      setPlatformName(getPlatformName());
      setPlatformLogo(getPlatformLogo());
    };
    window.addEventListener("storage", handler);
    window.addEventListener("founder-config-updated", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("founder-config-updated", handler);
    };
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const supabase = createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push("/login");
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .maybeSingle<{ role: string }>();

        if (profileError) {
          // If the users table doesn't exist in this Supabase project, treat as no role row
          const msg = String(profileError?.message || "");
          const profileErrorCode = typeof profileError === "object" && profileError !== null && "code" in profileError
            ? String((profileError as { code?: unknown }).code)
            : "";
          if (msg.includes("Could not find the table") || msg.includes("does not exist") || profileErrorCode === "42P01") {
            // Allow authenticated user access when users table is missing.
            if (user.email) setUserEmail(user.email);
            return;
          }
          console.error("Failed to load user role:", profileError.message);
          router.push("/login");
          return;
        }

        if (!profileData?.role) {
          const founderProfile = await supabase
            .from("founder")
            .select("role")
            .eq("id", user.id)
            .maybeSingle<{ role: string }>();

          if (founderProfile.error) {
            const fmsg = String(founderProfile.error.message || "");
            const founderErrorCode = typeof founderProfile.error === "object" && founderProfile.error !== null && "code" in founderProfile.error
              ? String((founderProfile.error as { code?: unknown }).code)
              : "";
            if (fmsg.includes("Could not find the table") || fmsg.includes("does not exist") || founderErrorCode === "42P01") {
              if (user.email) setUserEmail(user.email);
              return;
            }
            console.error("Failed to load founder role:", founderProfile.error.message);
            router.push("/login");
            return;
          }

          if (founderProfile.data?.role === "founder") {
            router.push("/x-founder-control-99f7jK");
            return;
          }

          // Allow authenticated user access when role row is missing.
          if (user.email) {
            setUserEmail(user.email);
          }
          return;
        }

        if (profileData.role !== "user") {
          router.push("/login");
          return;
        }

        if (user.email) {
          setUserEmail(user.email);
        }

        try {
          const persistedBalance = Number(localStorage.getItem('ai_nusantara_balance') ?? NaN);
          if (!Number.isNaN(persistedBalance) && persistedBalance >= 0) {
            setCharacterBalance(persistedBalance);
          } else {
            const stored = localStorage.getItem('founder_mock_users');
            if (stored) {
              try {
                const users = JSON.parse(stored) as Array<{ email?: string; id?: string; character_balance?: number }>;
                if (users.length > 0 && typeof users[0].character_balance === 'number') {
                  setCharacterBalance(users[0].character_balance);
                }
              } catch {
                // ignore parse errors
              }
            }
          }
        } catch {
          // ignore
        }

        const mm = localStorage.getItem('founder_config_global_maintenance_mode');
        setIsMaintenance(mm === 'true');
      } catch {
        // ignore
      }
    };
    fetchUser();
  }, [router]);

  const getInitials = (email: string) => {
    if (!email) return "U";
    const name = email.split("@")[0];
    return name.slice(0, 2).toUpperCase();
  };

  const handleRefreshStatus = () => {
    window.location.reload();
  };

  const handleLogoutClick = async () => {
    setShowDropdown(false);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      localStorage.removeItem('ai_nusantara_balance');
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  const handleDeleteAccount = async () => {
    setShowDropdown(false);
    const confirmed = window.confirm(
      "⚠️ PERINGATAN FINAL!\n\nTindakan ini akan MENGHAPUS PERMANEN akun Anda beserta seluruh data di database cloud Supabase.\n\nSaldo kuota karakter yang tersisa akan DIHANCURKAN dan tidak bisa dikembalikan.\n\nAnda tidak akan bisa masuk kembali dengan email yang sama.\n\nYakin ingin melanjutkan?"
    );

    if (!confirmed) return;

    try {
      const supabase = createClient();

      const { error: deleteError } = await supabase.auth.admin.deleteUser(userEmail);

      if (deleteError) {
        alert("Gagal menghapus akun: " + deleteError.message);
        return;
      }

      localStorage.clear();
      document.cookie = "bikinai_session=; path=/; max-age=0";

      alert("✅ Akun berhasil dihapus secara permanen.\n\nAnda akan diarahkan ke halaman pendaftaran. Gunakan email baru jika ingin mendaftar kembali.");
      router.push("/register");
      router.refresh();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Terjadi kesalahan saat menghapus akun.";
      alert("Error: " + errorMessage);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Desktop Header */}
      <header className="hidden md:block border-b-2 border-[#141414] bg-white sticky top-0 z-50 shadow-[0_2px_0_0_#141414]">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            {platformLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={platformLogo}
                alt={platformName}
                className="h-10 w-auto max-w-[160px] object-contain border-2 border-[#141414] shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] shrink-0"
              />
            ) : (
              <div className="w-10 h-10 bg-[#141414] border-2 border-[#141414] flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(20,20,20,1)]">
                <div className="w-5 h-5 border-2 border-white rotate-45 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-amber-400" />
                </div>
              </div>
            )}
            <div>
              <h1 className="text-xl font-black tracking-tighter text-[#141414] font-sans">
                {platformName}
              </h1>
              <p className="text-[11px] font-mono text-[#141414]/70 uppercase tracking-tight">
                Platform Nusantara
              </p>
            </div>
          </div>

          {/* Right Status Indicators */}
          <div className="flex items-center space-x-3 self-end md:self-auto flex-wrap">
            {/* Maintenance Status Badge */}
            {isMaintenance ? (
              <div className="flex items-center space-x-1.5 bg-red-100 border-2 border-[#141414] text-red-700 px-2.5 py-1 text-xs font-mono font-bold shadow-[2px_2px_0px_0px_rgba(20,20,20,1)]">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>MAINTENANCE (503)</span>
              </div>
            ) : null}

            {/* User Balance Badge */}
            <div className="flex items-center space-x-2 bg-[#F0EFEC] border-2 border-[#141414] px-3 py-1 shadow-[2px_2px_0px_0px_rgba(20,20,20,1)]">
              <Coins className="w-4 h-4 text-amber-600" />
              <div className="text-right">
                <p className="text-[9px] text-[#141414]/60 uppercase font-mono font-bold">
                  Saldo User
                </p>
                <p className="text-xs font-black text-[#141414] font-mono">
                  {characterBalance.toLocaleString("id-ID")}{" "}
                  <span className="text-[9px] font-normal opacity-70">CHARS</span>
                </p>
              </div>
            </div>

            {/* Refill Button */}
            <a
              href="/dashboard/checkout"
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white border-2 border-[#141414] shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] hover:from-amber-400 hover:to-orange-400 transition-all"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              ISI ULANG SALDO
            </a>

            <button
              onClick={handleRefreshStatus}
              title="Refresh Status Server"
              className="p-1.5 text-[#141414] bg-white border-2 border-[#141414] shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] hover:bg-[#E4E3E0] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* Avatar Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 bg-[#141414] text-white border-2 border-[#141414] rounded-full px-2 py-1 shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] hover:bg-slate-800 transition-all"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-[10px] font-black text-slate-950">
                  {getInitials(userEmail)}
                </div>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {showDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDropdown(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-slate-800 bg-slate-900 shadow-[0_8px_30px_rgba(0,0,0,0.6)] z-50 overflow-hidden">
                    <div className="p-4 border-b border-slate-800">
                      <p className="text-xs font-mono text-slate-400 truncate">
                        {userEmail || "user@email.com"}
                      </p>
                    </div>
                    <div className="p-2 space-y-1">
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          router.push("/dashboard/settings");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        ⚙️ Pengaturan Akun
                      </button>
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          router.push("/dashboard/transactions");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        <History className="w-3.5 h-3.5" />
                        📊 Riwayat Transaksi
                      </button>
                      <button
                        onClick={handleLogoutClick}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-bold text-red-400 hover:bg-red-950/40 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        🚪 Keluar (Logout)
                      </button>
                      <div className="border-t border-slate-800 pt-1 mt-1">
                        <button
                          onClick={handleDeleteAccount}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-bold text-red-500 hover:bg-red-950/60 transition-colors"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          🗑️ Hapus Akun Selamanya
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 border-b border-slate-800 px-4 py-3">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="p-2 text-slate-300 hover:text-white transition-colors"
        >
          <ChevronDown className={`w-6 h-6 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>
        <h1 className="text-lg font-bold text-white">{platformName}</h1>
        <div className="w-10" />
      </div>

      {/* Mobile Dropdown */}
      {showDropdown && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setShowDropdown(false)}>
          <div
            className="absolute right-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 p-4 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">{platformName}</h2>
              <button onClick={() => setShowDropdown(false)} className="text-slate-400 hover:text-white">
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile User Profile Section */}
            <div className="border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-sm font-black text-slate-950">
                  {getInitials(userEmail)}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-xs text-slate-400 truncate">{userEmail || "user@email.com"}</p>
                </div>
              </div>
            </div>

            {/* Mobile Menu Items */}
            <div className="p-2 space-y-1">
              <button
                onClick={() => {
                  setShowDropdown(false);
                  router.push("/dashboard/settings");
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-bold text-slate-300 hover:bg-slate-800"
              >
                <Settings className="w-3.5 h-3.5" />
                ⚙️ Pengaturan Akun
              </button>
              <button
                onClick={() => {
                  setShowDropdown(false);
                  router.push("/dashboard/transactions");
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-bold text-slate-300 hover:bg-slate-800"
              >
                <History className="w-3.5 h-3.5" />
                📊 Riwayat Transaksi
              </button>
              <button
                onClick={handleLogoutClick}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-bold text-red-400 hover:bg-red-950/40"
              >
                <LogOut className="w-3.5 h-3.5" />
                🚪 Keluar (Logout)
              </button>
              <button
                onClick={handleDeleteAccount}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-bold text-red-500 hover:bg-red-950/60"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                🗑️ Hapus Akun Selamanya
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area - Full Width (Sidebar Dihapus Total) */}
      <main className="w-full flex-1">
        {children}
      </main>

      <footer className="w-full border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-600">
        <div className="flex flex-col items-center justify-center gap-2">
          {platformLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={platformLogo} alt={platformName} className="h-6 w-auto object-contain opacity-80" />
          ) : null}
          <span>&copy; {new Date().getFullYear()} {platformName}. Semua Hak Dilindungi.</span>
        </div>
      </footer>
    </div>
  );
}