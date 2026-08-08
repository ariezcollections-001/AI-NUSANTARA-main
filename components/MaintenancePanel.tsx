import React, { useState } from "react";
import { Wrench, ShieldAlert, Coins, RefreshCw, CheckCircle2, ShieldCheck, Database } from "lucide-react";

interface MaintenancePanelProps {
  isMaintenance: boolean;
  characterBalance: number;
  onMaintenanceToggled: (enabled: boolean) => void;
  onBalanceUpdated: (newBalance: number) => void;
}

export const MaintenancePanel: React.FC<MaintenancePanelProps> = ({
  isMaintenance,
  characterBalance,
  onMaintenanceToggled,
  onBalanceUpdated,
}) => {
  const [loadingAction, setLoadingAction] = useState(false);
  const [customBalanceInput, setCustomBalanceInput] = useState("");

  const handleToggleMaintenance = async () => {
    setLoadingAction(true);
    const targetState = !isMaintenance;
    try {
      const res = await fetch("/api/config/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: targetState }),
      });
      const data = await res.json();
      if (data.success) {
        onMaintenanceToggled(targetState);
      }
    } catch (err) {
      console.error("Gagal mengubah maintenance mode:", err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleTopUp = async (amount: number) => {
    setLoadingAction(true);
    try {
      const res = await fetch("/api/users/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user_demo_001", balance: amount }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        onBalanceUpdated(data.user.character_balance);
      }
    } catch (err) {
      console.error("Gagal memperbarui saldo:", err);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSetCustomBalance = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customBalanceInput, 10);
    if (!isNaN(val) && val >= 0) {
      handleTopUp(val);
      setCustomBalanceInput("");
    }
  };

  return (
    <div className="bg-[#D1D1CD] border-2 border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] space-y-6">
      <div className="flex items-center justify-between border-b-2 border-[#141414] pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#141414] text-white border border-[#141414]">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-[#141414] font-mono">
              Admin Control &amp; System Simulator
            </h2>
            <p className="text-xs text-[#141414]/70">
              Simulasi intercept maintenance 503 &amp; potong saldo per karakter secara real-time.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <Database className="w-4 h-4 text-[#141414]" />
          <span className="font-bold text-[#141414]">TABLES: founder_config | public.users</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Maintenance Intercept Switch */}
        <div className="bg-white border-2 border-[#141414] p-5 space-y-4 shadow-[2px_2px_0px_0px_rgba(20,20,20,1)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#141414]">
                1. Maintenance Mode (503 Intercept)
              </h3>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border ${
              isMaintenance ? "bg-red-100 text-red-800 border-red-800" : "bg-green-100 text-green-800 border-green-800"
            }`}>
              {isMaintenance ? "ACTIVE (503)" : "OFF (NORMAL)"}
            </span>
          </div>

          <p className="text-xs text-[#141414]/80 leading-relaxed font-sans">
            Ketika aktif (<code className="bg-[#E4E3E0] px-1 font-mono font-bold">global_maintenance_mode = true</code>), semua request ke backend <code className="bg-[#E4E3E0] px-1 font-mono">app/api/ai/route.ts</code> dibatalkan instan dengan error 503.
          </p>

          <button
            onClick={handleToggleMaintenance}
            disabled={loadingAction}
            className={`w-full py-3 px-4 text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 border-2 border-[#141414] shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] active:translate-x-0.5 active:translate-y-0.5 ${
              isMaintenance
                ? "bg-green-400 hover:bg-green-500 text-[#141414]"
                : "bg-red-500 hover:bg-red-600 text-white"
            }`}
          >
            {loadingAction ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : isMaintenance ? (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Matikan Maintenance (Kembali Normal)</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4" />
                <span>Aktifkan Maintenance Mode (HTTP 503 Error)</span>
              </>
            )}
          </button>
        </div>

        {/* Card 2: Saldo Karakter User Controls */}
        <div className="bg-white border-2 border-[#141414] p-5 space-y-4 shadow-[2px_2px_0px_0px_rgba(20,20,20,1)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Coins className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#141414]">
                2. Monetisasi Saldo Karakter User
              </h3>
            </div>
            <span className="text-xs font-mono font-bold bg-[#E4E3E0] text-[#141414] border border-[#141414] px-2 py-0.5">
              {characterBalance.toLocaleString("id-ID")} CHARS
            </span>
          </div>

          <p className="text-xs text-[#141414]/80 leading-relaxed font-sans">
            Atur saldo karakter user untuk menguji skenario <strong className="text-[#141414]">Pre-Check (Saldo Cukup)</strong> atau <strong className="text-[#141414]">Error HTTP 402 (Saldo Habis)</strong>.
          </p>

          {/* Quick Buttons */}
          <div className="grid grid-cols-4 gap-2 font-mono">
            <button
              onClick={() => handleTopUp(0)}
              className="py-1.5 px-2 bg-red-100 hover:bg-red-200 border border-[#141414] text-red-900 font-bold text-[10px] uppercase transition-all"
            >
              Set 0 (Habis)
            </button>
            <button
              onClick={() => handleTopUp(100)}
              className="py-1.5 px-2 bg-amber-100 hover:bg-amber-200 border border-[#141414] text-amber-900 font-bold text-[10px] uppercase transition-all"
            >
              100 chars
            </button>
            <button
              onClick={() => handleTopUp(2000)}
              className="py-1.5 px-2 bg-[#F0EFEC] hover:bg-white border border-[#141414] text-[#141414] font-bold text-[10px] uppercase transition-all"
            >
              2.000 chars
            </button>
            <button
              onClick={() => handleTopUp(10000)}
              className="py-1.5 px-2 bg-[#F0EFEC] hover:bg-white border border-[#141414] text-[#141414] font-bold text-[10px] uppercase transition-all"
            >
              10.000 chars
            </button>
          </div>

          <form onSubmit={handleSetCustomBalance} className="flex gap-2 font-mono">
            <input
              type="number"
              value={customBalanceInput}
              onChange={(e) => setCustomBalanceInput(e.target.value)}
              placeholder="Jumlah saldo kustom..."
              className="flex-1 bg-[#F0EFEC] border border-[#141414] px-3 py-1.5 text-xs text-[#141414] placeholder-[#141414]/50 focus:outline-none focus:bg-white"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-[#141414] text-white font-bold text-xs uppercase hover:bg-amber-400 hover:text-[#141414] transition-all border border-[#141414]"
            >
              Set Saldo
            </button>
          </form>
        </div>
      </div>

      {/* Compliance Checklist */}
      <div className="bg-white border-2 border-[#141414] p-4 space-y-2 shadow-[2px_2px_0px_0px_rgba(20,20,20,1)]">
        <h4 className="text-xs font-mono font-bold text-[#141414] uppercase tracking-wider">
          Compliance Matrix Requirements:
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
          <div className="flex items-start gap-2 text-[#141414]">
            <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
            <div>
              <strong>1. Maintenance Mode:</strong> Intercept via Supabase founder_config table → HTTP 503.
            </div>
          </div>
          <div className="flex items-start gap-2 text-[#141414]">
            <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
            <div>
              <strong>2. Pay-per-character:</strong> Input length + Output length debited real-time in public.users.
            </div>
          </div>
          <div className="flex items-start gap-2 text-[#141414]">
            <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
            <div>
              <strong>3. Anti-Halusinasi:</strong> Temperature 0.0 lock &amp; strict system instructions.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

