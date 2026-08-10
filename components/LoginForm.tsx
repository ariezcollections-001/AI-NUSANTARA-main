"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { manualLoginWithPassword } from "@/lib/auth";
import { LogIn, Mail, Lock, Loader2, Eye, EyeOff, Globe, ShieldCheck, ArrowRight } from "lucide-react";

const supabase = createClient();

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleLoginManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAgreed) {
      setError("Setujui Syarat Layanan dan Kebijakan Privasi terlebih dahulu.");
      return;
    }
    setLoading(true);
    setError(null);

    const result = await manualLoginWithPassword(email, password);
    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    document.cookie = "bikinai_session=true; path=/; max-age=86400";
    window.location.href = result.target;
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    try {
      const currentOrigin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: currentOrigin + "/api/auth/callback" },
      });
      if (error) {
        setError(error.message || "Login Google gagal. Coba lagi.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat login dengan Google.");
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <div className="w-14 h-14 rounded-xl bg-amber-500 border-2 border-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <div className="w-7 h-7 bg-slate-950 rounded" />
          </div>
        </div>

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">Selamat Datang</h1>
          <p className="mt-2 text-sm text-slate-400">Masuk ke akun AI Nusantara Anda</p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
          <form onSubmit={handleLoginManual} className="grid gap-5">
            {/* Email Field */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="0 0 0 0 0 0 0 0"
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 py-3 pl-10 pr-10 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="terms-validation"
                checked={isAgreed}
                onChange={(e) => setIsAgreed(e.target.checked)}
                className="mt-1 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="terms-validation" className="text-xs text-slate-400 cursor-pointer select-none leading-relaxed">
                Saya setuju dengan Syarat Layanan dan Kebijakan Privasi resmi BIKIN AI
              </label>
            </div>
            {/* Error message */}
            {error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                {error}
              </div>
            ) : null}

            {/* Manual Login Button (dark) */}
            <button
              type="submit"
              disabled={!isAgreed || loading}
              className={
                !isAgreed
                  ? "w-full py-3 px-4 font-mono font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 rounded-xl bg-slate-800 text-slate-500 font-normal cursor-not-allowed pointer-events-none shadow-none"
                  : "w-full py-3 px-4 font-mono font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer transition-all active:scale-95"
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

          {/* Divider */}
          <div className="mt-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-xs text-slate-500 select-none">&mdash; atau &mdash;</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          {/* Google Login */}
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

        {/* Register Link */}
        <div className="mt-5 pt-4 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-400">
            Belum punya akun?{" "}
            <Link href="/register" className="text-amber-400 hover:text-amber-300 font-bold">
              Daftar sekarang <ArrowRight className="inline-block w-3 h-3" />
            </Link>
          </p>
        </div>

        {/* Back to Home */}
        <div className="mt-4 text-center">
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            &larr; Kembali ke Beranda
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-3 text-center">
          <p className="text-[10px] text-slate-600">
            <ShieldCheck className="inline-block w-3 h-3 mr-1" />
            Secure login protected by Google Cloud OAuth protocol.
          </p>
        </div>
      </div>
    </div>
  );
}
