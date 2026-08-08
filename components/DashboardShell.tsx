"use client";

import { useState, useEffect } from "react";
import { Header } from "./Header";
import { AIGenerator } from "./AIGenerator";
import { ShieldCheck, Menu, X, Settings, History, LogOut, UserCircle, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface DashboardShellProps {
  initialBalance?: number;
  isMaintenance?: boolean;
  onLogout?: () => void;
  children?: React.ReactNode;
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

export default function DashboardShell({
  initialBalance = 0,
  isMaintenance = false,
  onLogout = async () => {},
  children,
  showChrome = true,
}: DashboardShellProps & { showChrome?: boolean }) {
  const [characterBalance, setCharacterBalance] = useState<number>(initialBalance);
  const [activeTab, setActiveTab] = useState<"app" | "code" | "docs">("app");
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [platformName, setPlatformName] = useState("BIKIN AI");
  const [platformLogo, setPlatformLogo] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [showMobileProfile, setShowMobileProfile] = useState(false);
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
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          setUserEmail(user.email);
        }
      } catch {
        // ignore
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    try {
      const v = localStorage.getItem('admin_view_as_user');
      if (v) setImpersonating(v);
    } catch {
      // ignore
    }
  }, []);

  const exitImpersonation = () => {
    try {
      localStorage.removeItem('admin_view_as_user');
    } catch {
      // ignore
    }
    setImpersonating(null);
    window.location.reload();
  };

  const handleRefreshStatus = () => {
    // Refresh is client-side only for now. Future: call health endpoint or session refresh.
    window.location.reload();
  };

  const handleBalanceUpdated = (newBalance: number) => {
    setCharacterBalance(newBalance);
  };

  const getInitials = (email: string) => {
    if (!email) return "U";
    const name = email.split("@")[0];
    return name.slice(0, 2).toUpperCase();
  };

  const handleLogoutClick = async () => {
    setMobileMenuOpen(false);
    setShowMobileProfile(false);
    await onLogout();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Mobile Header with Burger Menu */}
      {showChrome && (
        <>
          <div className="md:hidden flex items-center justify-between bg-slate-900 border-b border-slate-800 px-4 py-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-300 hover:text-white transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <h1 className="text-lg font-bold text-white">{platformName}</h1>
            <div className="w-10" />
          </div>

          {/* Mobile Sidebar Overlay */}
          {mobileMenuOpen && (
            <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileMenuOpen(false)}>
              <div
                className="absolute left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 p-4 space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">{platformName}</h2>
                  <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Mobile User Profile Section */}
                <div className="border-b border-slate-800 pb-4">
                  <button
                    onClick={() => setShowMobileProfile(!showMobileProfile)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-sm font-black text-slate-950">
                      {getInitials(userEmail)}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-xs text-slate-400 truncate">{userEmail || "user@email.com"}</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>

                  {showMobileProfile && (
                    <div className="mt-2 space-y-1">
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setShowMobileProfile(false);
                          router.push("/settings");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-bold text-slate-300 hover:bg-slate-800"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        ⚙️ Pengaturan Akun
                      </button>
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setShowMobileProfile(false);
                          router.push("/dashboard/history");
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
                    </div>
                  )}
                </div>

                {/* Mobile Navigation */}
                <nav className="space-y-2">
                  <button
                    onClick={() => {
                      setActiveTab("app");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl font-mono text-sm font-bold transition-colors ${
                      activeTab === "app" ? "bg-amber-500 text-slate-950" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("code");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl font-mono text-sm font-bold transition-colors ${
                      activeTab === "code" ? "bg-amber-500 text-slate-950" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    Kode Backend
                  </button>
                </nav>
              </div>
            </div>
          )}

          {/* Desktop Header */}
          <div className="hidden md:block">
            <Header
              isMaintenance={isMaintenance}
              characterBalance={characterBalance}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onRefreshStatus={handleRefreshStatus}
              onLogout={onLogout}
            />
          </div>

          {impersonating && (
            <div className="bg-amber-500 text-slate-900 p-3 text-sm text-center">
              ⚠️ ANDA SEDANG MEMASUKI MODE KENDALI FOUNDER (VIEW AS USER) — {impersonating}
              <button onClick={exitImpersonation} className="ml-4 px-2 py-1 bg-slate-900 text-amber-400 rounded">❌ KELUAR MODE INTIP</button>
            </div>
          )}
        </>
      )}

      <main className="flex-1 container mx-auto px-4 py-6 md:py-8 max-w-7xl">
        {children ? (
          children
        ) : (
          <>
            {/* Glassmorphism Welcome Banner */}
            <div className="mb-6 p-4 md:p-6 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-base md:text-lg font-black text-white mb-1">
                    👋 Selamat Datang di {platformName}
                  </h2>
                  <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
                    Pilih salah satu dari 11 fitur AI di bawah ini untuk memulai. Saldo Anda: <strong className="text-amber-400">{characterBalance.toLocaleString("id-ID")} CHARS</strong>. Setiap permintaan akan dipotong otomatis dari saldo.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const banner = document.getElementById('welcome-banner');
                    if (banner) banner.style.display = 'none';
                  }}
                  className="shrink-0 text-slate-500 hover:text-white transition-colors"
                  aria-label="Tutup banner"
                >
                  ✕
                </button>
              </div>
            </div>

            <AIGenerator
              isMaintenance={isMaintenance}
              characterBalance={characterBalance}
              onBalanceUpdated={handleBalanceUpdated}
            />
          </>
        )}
      </main>

      {showChrome && (
        <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-600">
          <div className="flex flex-col items-center justify-center gap-2">
            {platformLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={platformLogo} alt={platformName} className="h-6 w-auto object-contain opacity-80" />
            ) : null}
            <span>&copy; {new Date().getFullYear()} {platformName}. Semua Hak Dilindungi.</span>
          </div>
        </footer>
      )}
    </div>
  );
}
