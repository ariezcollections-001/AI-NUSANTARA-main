"use client";
import React, { useEffect, useState } from "react";
import { Cpu, ShieldCheck, AlertTriangle, Coins, RefreshCw, Code2, Settings, History, LogOut, UserCircle, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface HeaderProps {
  isMaintenance: boolean;
  characterBalance: number;
  activeTab: "app" | "code" | "docs";
  setActiveTab: (tab: "app" | "code" | "docs") => void;
  onRefreshStatus: () => void;
  onLogout: () => void;
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

export const Header: React.FC<HeaderProps> = ({
  isMaintenance,
  characterBalance,
  activeTab,
  setActiveTab,
  onRefreshStatus,
  onLogout,
}) => {
  const [platformName, setPlatformName] = useState("BIKIN AI");
  const [platformLogo, setPlatformLogo] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setPlatformName(getPlatformName());
    setPlatformLogo(getPlatformLogo());
    // Listen for storage changes (when founder saves config in another tab)
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

  const getInitials = (email: string) => {
    if (!email) return "U";
    const name = email.split("@")[0];
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="border-b-2 border-[#141414] bg-white sticky top-0 z-50 shadow-[0_2px_0_0_#141414]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
            🛒 ISI ULANG SALDO / BELI PAKET
          </a>

          <button
            onClick={onRefreshStatus}
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
                      onClick={() => {
                        setShowDropdown(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-bold text-red-400 hover:bg-red-950/40 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      🚪 Keluar (Logout)
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
