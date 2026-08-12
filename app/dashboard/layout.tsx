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
          const persistedBalance = Number(
            localStorage.getItem("ai_nusantara_balance") ?? NaN
          );
          if (!Number.isNaN(persistedBalance) && persistedBalance >= 0) {
            setCharacterBalance(persistedBalance);
          } else {
            const stored = localStorage.getItem("founder_mock_users");
            if (stored) {
              try {
                const users = JSON.parse(stored) as Array<{
                  email?: string;
                  id?: string;
                  character_balance?: number;
                }>;
                if (
                  users.length > 0 &&
                  typeof users[0].character_balance === "number"
                ) {
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

        const mm = localStorage.getItem("founder_config_global_maintenance_mode");
        setIsMaintenance(mm === "true");
      } catch {
        // ignore
      }
    };
    fetchUser();
  }, [router]);

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

