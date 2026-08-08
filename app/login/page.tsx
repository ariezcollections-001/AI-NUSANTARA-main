"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Mail, Lock, AlertCircle, Loader2, ArrowRight, Eye, EyeOff, Globe } from "lucide-react";
import { manualLoginWithPassword } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";

function LoginContent() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [accountNotFound, setAccountNotFound] = useState(false);
  const [isAgreed, setIsAgreed] = useState<boolean>(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState("");
  const [resendError, setResendError] = useState("");
  const searchParams = useSearchParams();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Tangkap error umum dari URL (misal dari callback OAuth yang gagal)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const errorParam = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (errorParam) {
      const decodedError = decodeURIComponent(errorDescription || errorParam);
      setError(decodedError);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams]);

  // ============================================================
  // JALUR LOGIN MANUAL (signInWithPassword)
  // ============================================================
  const handleLoginManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setEmailNotConfirmed(false);
    setAccountNotFound(false);

    try {
      const result = await manualLoginWithPassword(email, password);

      if (!result.success) {
        setError(result.error);
        if (result.reason === "not_found") {
          setAccountNotFound(true);
        }
        if (result.reason === "not_confirmed") {
          setEmailNotConfirmed(true);
        }
        setLoading(false);
        return;
      }

      document.cookie = "bikinai_session=true; path=/; max-age=86400";
      window.location.href = result.target;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      setResendError("Masukkan email terdaftar untuk mengirim ulang verifikasi.");
      return;
    }

    setResendLoading(true);
    setResendError("");
    setResendSuccess("");

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();

      if (!res.ok) {
        setResendError(json?.error || "Gagal mengirim ulang email verifikasi.");
      } else {
        setResendSuccess(json?.message || "Email verifikasi berhasil dikirim ulang. Silakan cek kotak masuk Anda.");
      }
    } catch (err: unknown) {
      setResendError("Gagal mengirim ulang email verifikasi. Coba lagi nanti.");
    } finally {
      setResendLoading(false);
    }
  };

  // ============================================================
  // JALUR LOGIN GOOGLE OAUTH (langsung dengan parameter Bahasa Indonesia)
  // ============================================================
  const handleGoogleLogin = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
          queryParams: {
            hl: "id",
            prompt: "select_account",
          },
        },
      });
    } catch (error) {
      console.error("Google OAuth redirect error:", error);
      router.push(`/login?error=${encodeURIComponent("Gagal masuk dengan Google")}`);
    }
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 border-2 border-slate-800 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] mb-3">
            <div className="w-7 h-7 border-2 border-amber-400 rotate-45 flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-amber-400 rotate-45" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-white mb-1">
            Selamat Datang
          </h1>
          <p className="text-xs text-slate-400">
            Masuk ke akun AI Nusantara Anda
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          {/* SPANDUK ORANYE - KONDISI A: Email belum terdaftar */}
          {accountNotFound && (
            <div className="mb-4 p-4 rounded-xl bg-orange-950/60 border-2 border-orange-500/50 text-orange-200 text-sm flex flex-col gap-3 backdrop-blur-xl shadow-[0_0_30px_rgba(249,115,22,0.3)]">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-orange-400" />
                <div className="flex-1">
                  <p className="font-bold text-orange-300 mb-1">❌ Akun Anda belum terdaftar!</p>
                  <p className="text-xs leading-relaxed text-orange-200">
                    Silakan klik tombol <strong>{'"Daftar Akun Baru"'}</strong> di bawah untuk mendaftarkan email resmi Anda.
                  </p>
                </div>
              </div>
              <Link href="/register" className="inline-flex w-fit rounded-full bg-amber-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-950 hover:bg-amber-400 transition">
                Daftar Akun Baru
              </Link>
            </div>
          )}

          {/* SPANDUK MERAH - KONDISI B: Email belum dikonfirmasi */}
          {emailNotConfirmed && (
            <div className="mb-4 p-4 rounded-xl bg-red-950/60 border-2 border-red-500/50 text-red-200 text-sm backdrop-blur-xl shadow-[0_0_30px_rgba(239,68,68,0.3)] animate-pulse">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
                <div className="flex-1">
                  <p className="font-bold text-red-300 mb-1">⚠️ Akun Anda belum aktif!</p>
                  <p className="text-xs leading-relaxed text-red-200">
                    Supabase Cloud telah mengirimkan link verifikasi resmi ke email Anda. Silakan buka kotak masuk/folder spam email Anda, lalu klik <strong>{'"Confirm Email"'}</strong> terlebih dahulu agar pintu gerbang BIKIN AI terbuka!
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={!email || resendLoading}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                    resendLoading || !email
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-amber-500 text-slate-950 hover:bg-amber-400"
                  }`}
                >
                  {resendLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Mengirim ulang...
                    </span>
                  ) : (
                    "Kirim ulang email verifikasi"
                  )}
                </button>

                {resendSuccess && (
                  <p className="text-emerald-300 text-xs leading-relaxed">
                    {resendSuccess}
                  </p>
                )}
                {resendError && (
                  <p className="text-red-300 text-xs leading-relaxed">
                    {resendError}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Error Umum */}
          {error && !emailNotConfirmed && !accountNotFound && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-start gap-2 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* PRIMARY MANUAL FORM SECTION */}
          <form onSubmit={handleLoginManual} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-300 font-mono">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-300 font-mono">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-11 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* TERMS OF SERVICE CHECKBOX VALIDATOR */}
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="terms-validation"
                checked={isAgreed}
                onChange={(e) => setIsAgreed(e.target.checked)}
                className="mr-2 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="terms-validation" className="text-xs text-slate-400 cursor-pointer select-none">
                Saya setuju dengan Syarat Layanan dan Kebijakan Privasi resmi BIKIN AI
              </label>
            </div>

            {/* TOMBOL MANUAL LOGIN DENGAN DYNAMIC CLASS */}
            <button
              type="submit"
              disabled={!isAgreed}
              className={
                !isAgreed
                  ? "w-full py-3 px-4 font-mono font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 rounded-xl bg-slate-800 text-slate-500 font-normal cursor-not-allowed pointer-events-none shadow-none"
                  : "w-full py-3 px-4 font-mono font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer transition-all shadow-lg shadow-amber-500/20 active:scale-95"
              }
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Masuk Aplikasi</span>
                </>
              )}
            </button>
          </form>

          {/* VISUAL DIVIDER */}
          <div className="mt-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-xs text-slate-500 select-none">— atau —</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          {/* Google OAuth login tetap aktif tanpa perlu mencentang checkbox */}
          <div className="mt-4">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-3 px-4 font-mono font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 rounded-xl bg-amber-500 border-amber-500 text-slate-950 cursor-pointer hover:bg-amber-400 hover:border-amber-400 transition-all shadow-md"
            >
              <Globe className="w-4 h-4" />
              <span>Masuk dengan Akun Google</span>
            </button>
          </div>

        </div>

        <div className="mt-5 pt-4 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-400">
            Belum punya akun?{" "}
            <Link href="/register" className="text-amber-400 hover:text-amber-300 font-bold">
              Daftar sekarang <ArrowRight className="inline-block w-3 h-3" />
            </Link>
          </p>
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            ← Kembali ke Beranda
          </Link>
        </div>

        <div className="mt-3 text-center">
          <p className="text-[10px] text-slate-600">
            🔐 Secure login protected by Google Cloud OAuth protocol.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}