"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardLiveContext } from "@/components/DashboardLiveContext";

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

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const [characterBalance, setCharacterBalance] = useState<number>(0);
  const [platformName, setPlatformName] = useState("BIKIN AI");
  const [userEmail, setUserEmail] = useState("");
  const [isMaintenance, setIsMaintenance] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setPlatformName(getPlatformName());
    const handler = () => {
      setPlatformName(getPlatformName());
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
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

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
          const msg = String(profileError?.message || "");
          const profileErrorCode =
            typeof profileError === "object" &&
            profileError !== null &&
            "code" in profileError
              ? String((profileError as { code?: unknown }).code)
              : "";
          if (
            msg.includes("Could not find the table") ||
            msg.includes("does not exist") ||
            profileErrorCode === "42P01"
          ) {
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
            const founderErrorCode =
              typeof founderProfile.error === "object" &&
              founderProfile.error !== null &&
              "code" in founderProfile.error
                ? String(
                    (founderProfile.error as { code?: unknown }).code
                  )
                : "";
            if (
              fmsg.includes("Could not find the table") ||
              fmsg.includes("does not exist") ||
              founderErrorCode === "42P01"
            ) {
              if (user.email) setUserEmail(user.email);
              return;
            }
            console.error(
              "Failed to load founder role:",
              founderProfile.error.message
            );
            router.push("/login");
            return;
          }

          if (founderProfile.data?.role === "founder") {
            router.push("/x-founder-control-99f7jK");
            return;
          }

          if (user.email) {
            setUserEmail(user.email);
          }
          return;
        }

        if (profileData.role === "founder") {
          router.push("/x-founder-control-99f7jK");
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
          const supabase = createClient();
          const nowISO = new Date().toISOString();
          let fromDb = false;
          // SOURCE-OF-TRUTH: baca karakter balance langsung dari DB
          // (public.users.character_balance) agar selaras dengan yg dikelola Founder.
          // Juga update last_seen = heartbeat presence real-time.
          try {
            await supabase
              .from("users")
              .update({ last_seen: nowISO })
              .eq("id", user.id);
            const { data: profileRow } = await supabase
              .from("users")
              .select("character_balance")
              .eq("id", user.id)
              .maybeSingle<{ character_balance: number }>();
            if (profileRow?.character_balance != null) {
              const realBalance = Number(profileRow.character_balance) || 0;
              setCharacterBalance(realBalance);
              fromDb = true;
              try { localStorage.setItem("ai_nusantara_balance", String(realBalance)); } catch {}
            }
          } catch {
            // fall through ke cache lokal di bawah
          }
          // Fallback visual bila DB belum responsif
          if (!fromDb) {
            const persistedBalance = Number(localStorage.getItem("ai_nusantara_balance") ?? NaN);
            if (!Number.isNaN(persistedBalance) && persistedBalance >= 0) {
              setCharacterBalance(persistedBalance);
            } else {
              const stored = localStorage.getItem("founder_mock_users");
              if (stored) {
                try {
                  const users = JSON.parse(stored) as Array<{ character_balance?: number }>;
                  if (users.length > 0 && typeof users[0].character_balance === "number") {
                    setCharacterBalance(users[0].character_balance);
                  }
                } catch {
                  // ignore parse errors
                }
              }
            }
          }
        } catch {
          // ignore
        }

        const mm = localStorage.getItem("founder_config_global_maintenance_mode");
        setIsMaintenance(mm === "true");
      } catch {
        // ignore
      }
    };
    fetchUser();
    }, [router]);

  // 💓 Heartbeat: update last_seen tiap user ke DB agar LIVE MONITOR founder akurat.
  // Kolom last_seen diperluhi karena presence channel hanya menghitung browser
  // yang membuka halaman founder (tidak merefleksikan user yang online di aplikasi).
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const tick = async () => {
      if (!active) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        try {
          await supabase
            .from("users")
            .update({ last_seen: new Date().toISOString() })
            .eq("id", user.id);
        } catch { /* ignore — presence bersifat dekoratif */ }
      }
    };
    tick(); // initial ping saat mount
    const iv = setInterval(tick, 30000); // refresh tiap 30s
    return () => { active = false; clearInterval(iv); };
  }, []);

  // 🔴 SALDO REAL-TIME: dengarkan event dari komponen generate agar saldo
  // langsung berkurang di UI user tanpa perlu reload halaman.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      if (typeof detail === "number" && detail >= 0) {
        setCharacterBalance(detail);
        try { localStorage.setItem("ai_nusantara_balance", String(detail)); } catch {}
      } else {
        // Refresh dari DB sebagai sumber kebenaran.
        const refresh = async () => {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user?.id) return;
          const { data: row } = await supabase
            .from("users")
            .select("character_balance")
            .eq("id", user.id)
            .maybeSingle<{ character_balance: number }>();
          if (row?.character_balance != null) {
            const b = Number(row.character_balance) || 0;
            setCharacterBalance(b);
            try { localStorage.setItem("ai_nusantara_balance", String(b)); } catch {}
          }
        };
        void refresh();
      }
    };
    window.addEventListener("ai-balance-updated", handler);
    return () => window.removeEventListener("ai-balance-updated", handler);
  }, []);


  const handleRefreshStatus = () => {
    window.location.reload();
  };

  const handleLogoutClick = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      localStorage.removeItem("ai_nusantara_balance");
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "⚠️ PERINGATAN FINAL!\n\nTindakan ini akan MENGHAPUS PERMANEN akun Anda beserta seluruh data di database cloud Supabase.\n\nSaldo kuota karakter yang tersisa akan DIHANCURKAN dan tidak bisa dikembalikan.\n\nAnda tidak akan bisa masuk kembali dengan email yang sama.\n\nYakin ingin melanjutkan?"
    );

    if (!confirmed) return;

    try {
      const supabase = createClient();

      const { error: deleteError } = await supabase.auth.admin.deleteUser(
        userEmail
      );

      if (deleteError) {
        alert("Gagal menghapus akun: " + deleteError.message);
        return;
      }

      localStorage.clear();
      document.cookie = "bikinai_session=; path=/; max-age=0";

      alert(
        "✅ Akun berhasil dihapus secara permanen.\n\nAnda akan diarahkan ke halaman pendaftaran. Gunakan email baru jika ingin mendaftar kembali."
      );
      router.push("/register");
      router.refresh();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menghapus akun.";
      alert("Error: " + errorMessage);
    }
  };

  return (
    <DashboardLiveContext.Provider
      value={{
        characterBalance,
        platformName,
        userEmail,
        isMaintenance,
        onRefresh: handleRefreshStatus,
        onLogout: handleLogoutClick,
        onDeleteAccount: handleDeleteAccount,
      }}
    >
      <div className="w-full h-screen max-h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col">
        <main className="w-full flex-1 min-h-0 overflow-hidden">
          {children}
        </main>
      </div>
    </DashboardLiveContext.Provider>
  );
}

