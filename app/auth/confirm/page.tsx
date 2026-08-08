"use client";

import { useState, useEffect } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { CheckCircle2, XCircle, User as UserIcon, Mail } from "lucide-react";

function ConfirmContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isAgreed, setIsAgreed] = useState(false);
  const [continueLoading, setContinueLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('Failed to get session:', sessionError);
        }

        if (isMounted && session?.user) {
          setUser(session.user);
          setLoading(false);
          return;
        }

        const { data: { user }, error: getUserError } = await supabase.auth.getUser();
        if (getUserError) {
          console.error('Failed to get user:', getUserError);
        }

        if (isMounted) {
          setUser(user ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Unexpected error during auth confirmation:', error);
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    void loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted && session?.user) {
        setUser(session.user);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleContinue = async () => {
    if (!isAgreed || !user) return;
    setContinueLoading(true);

    // mark session cookie for client-side quick check
    try {
      document.cookie = "bikinai_session=true; path=/; max-age=86400";
    } catch (e) {
      // ignore
    }

    try {
      // Ask server which route is correct for this authenticated user.
      const res = await fetch('/api/auth/resolve-redirect');
      if (!res.ok) {
        router.replace('/dashboard');
        return;
      }
      const json = await res.json();
      const target = json?.target || '/dashboard';
      router.replace(target);
    } catch (err) {
      console.error('Failed to resolve redirect:', err);
      router.replace('/dashboard');
    } finally {
      // In case navigation didn't unmount this component, clear loading
      try {
        setContinueLoading(false);
      } catch {
        // ignore
      }
    }
  };

  const handleCancel = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Memuat data akun...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <p className="text-red-400 mb-4">Sesi belum siap. Tunggu sebentar lalu coba lagi.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-amber-500 text-slate-950 font-bold rounded-xl hover:bg-amber-400 transition-all"
            >
              Coba Lagi
            </button>
            <button
              onClick={() => router.push("/login")}
              className="px-6 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700 transition-all"
            >
              Kembali ke Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displayName = user.user_metadata?.full_name || user.user_metadata?.name || "Pengguna";
  const userEmail = user.email || "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-8">
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500/30 mb-4">
              <UserIcon className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-2xl font-black text-white mb-2">
              Konfirmasi Akun Google
            </h1>
            <p className="text-xs text-slate-400">
              Verifikasi identitas Anda sebelum melanjutkan
            </p>
          </div>

          {/* User Info Card */}
          <div className="mb-6 p-4 rounded-xl bg-slate-950 border border-slate-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <span className="text-lg font-bold text-amber-400">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">{displayName}</p>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Mail className="w-3 h-3" />
                  <span>{userEmail}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Terms Checkbox */}
          <div className="mb-6 p-4 rounded-xl bg-slate-950 border border-slate-700">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="terms-confirm"
                checked={isAgreed}
                onChange={(e) => setIsAgreed(e.target.checked)}
                className="mt-1 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 w-4 h-4"
              />
              <label htmlFor="terms-confirm" className="text-xs text-slate-300 cursor-pointer select-none leading-relaxed">
                Saya menyetujui <span className="text-amber-400 font-bold">Syarat Layanan</span> dan <span className="text-amber-400 font-bold">Kebijakan Privasi</span> resmi BIKIN AI. Data akun Google saya akan digunakan untuk autentikasi.
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleContinue}
              disabled={!isAgreed || continueLoading}
              className={
                isAgreed
                  ? "w-full py-3.5 px-4 font-mono font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer transition-all shadow-lg shadow-amber-500/20 active:scale-95"
                  : "w-full py-3.5 px-4 font-mono font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 rounded-xl bg-slate-800 text-slate-500 font-normal cursor-not-allowed pointer-events-none shadow-none"
              }
            >
              {continueLoading ? (
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              <span>{continueLoading ? "Sedang masuk..." : "Lanjutkan ke Dashboard"}</span>
            </button>

            <button
              onClick={handleCancel}
              className="w-full py-3 px-4 font-mono font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all"
            >
              <XCircle className="w-5 h-5" />
              <span>Batalkan</span>
            </button>
          </div>

          {/* Security Notice */}
          <div className="mt-5 pt-4 border-t border-slate-800 text-center">
            <p className="text-[10px] text-slate-600">
              🔐 Login aman dengan enkripsi end-to-end
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return <ConfirmContent />;
}
