"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { manualLoginWithPassword } from "@/lib/auth";
import { ShieldCheck, Mail, Lock, ArrowRight, RefreshCcw, LogIn, AlertCircle, Eye, EyeOff } from "lucide-react";

const supabase = createClient();

function getPlatformName(): string {
  if (typeof window === "undefined") return "BIKIN AI";
  try {
    return localStorage.getItem("founder_config_platform_name") || "BIKIN AI";
  } catch {
    return "BIKIN AI";
  }
}

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [platformName, setPlatformName] = useState("BIKIN AI");
  const [showPassword, setShowPassword] = useState(false);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [accountNotFound, setAccountNotFound] = useState(false);
  const [isAgreed, setIsAgreed] = useState<boolean>(false);

  useEffect(() => {
    setPlatformName(getPlatformName());
    const handler = () => setPlatformName(getPlatformName());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const loginWithPassword = async () => {
    if (!isAgreed) {
      setMessage("Silakan setujui Syarat Layanan sebelum masuk.");
      return;
    }

    setLoading(true);
    setMessage(null);
    setEmailNotConfirmed(false);
    setAccountNotFound(false);

    const result = await manualLoginWithPassword(email, password);

    if (!result.success) {
      setMessage(result.error);
      setEmailNotConfirmed(result.reason === "not_confirmed");
      setAccountNotFound(result.reason === "not_found");
      setLoading(false);
      return;
    }

    document.cookie = "bikinai_session=true; path=/; max-age=86400";
    router.replace(result.target);
    setLoading(false);
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    setMessage(null);

    const result = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (result.error) {
      setMessage(result.error.message || "Login Google gagal. Coba lagi.");
    }
    setLoading(false);
  };

  const requestPasswordReset = async () => {
    setLoading(true);
    setMessage(null);

    try {
      if (!email) {
        setMessage("Isi email untuk menerima tautan reset kata sandi.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Tautan reset password telah dikirim ke email Anda.");
      }
    } catch {
      setMessage("Gagal mengirim tautan reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl rounded-[32px] border border-[#1a1f2f] bg-[#0f172a] shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] p-8">
        <div className="mb-8 grid gap-5 md:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-amber-300 font-mono">{platformName} Secure Entry</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white">Masuk dengan Email & Kata Sandi</h1>
            <p className="mt-3 text-slate-400 leading-relaxed">
              Masuk langsung ke dashboard {platformName} menggunakan akun email. Founder dapat masuk ke panel rahasia jika sudah terdaftar sebagai founder.
            </p>
          </div>
          <div className="rounded-3xl border border-[#323c52] bg-[#111827] p-6">
            <div className="flex items-center gap-3 text-slate-300">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span className="text-xs uppercase tracking-widest">Akses Email + Password</span>
            </div>
            <div className="mt-5 grid gap-3 text-sm text-slate-400">
              <p>Login konvensional lebih stabil tanpa Custom SMTP. Email & password resmi Supabase siap digunakan.</p>
              <p>Founder akan diarahkan ke rute <code className="rounded bg-slate-900 px-2 py-0.5 text-xs">/x-founder-control-99f7jK</code> jika terdaftar.</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {accountNotFound && (
            <div className="mb-4 p-4 rounded-xl bg-orange-950/70 border border-orange-500/60 text-orange-200 text-sm flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-400 mt-0.5" />
                <div>
                  <p className="font-bold text-orange-300">❌ Akun Anda belum terdaftar!</p>
                  <p className="text-xs leading-relaxed text-orange-200">Silakan daftar terlebih dahulu untuk membuat akun resmi sebelum masuk ke beranda user.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push('/register')}
                className="inline-flex items-center justify-center rounded-full bg-amber-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-950 hover:bg-amber-400 transition"
              >
                Daftar Akun Baru
              </button>
            </div>
          )}
          {emailNotConfirmed && (
            <div className="mb-4 p-4 rounded-xl bg-red-950/70 border border-red-500/60 text-red-200 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <p className="font-bold text-red-300">⚠️ Akun Anda belum aktif!</p>
                <p className="text-xs leading-relaxed text-red-200">Silakan cek email Anda dan klik tautan verifikasi Supabase sebelum masuk.</p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={loginWithGoogle}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-[#323c52] bg-[#111827] px-6 py-3 text-sm font-bold uppercase tracking-wider text-slate-100 transition hover:border-amber-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogIn className="w-5 h-5 text-amber-300" />
            {loading ? "Mengarahkan Google..." : "Masuk Cepat dengan Google"}
          </button>

          <div className="mt-4 flex flex-col gap-2 text-sm text-slate-400">
            <div className="flex items-start gap-2">
              <input
                id="login-terms"
                type="checkbox"
                checked={isAgreed}
                onChange={(e) => setIsAgreed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="login-terms" className="select-none leading-relaxed">
                Saya menyetujui <span className="text-amber-400 font-semibold">Syarat Layanan</span> dan <span className="text-amber-400 font-semibold">Kebijakan Privasi</span> BIKIN AI.
              </label>
            </div>
            <p className="text-xs text-slate-500">Centang hanya dibutuhkan untuk login manual email/password. Login Google tetap dapat digunakan langsung.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-300">
              <span>📧 Alamat Email</span>
              <div className="flex items-center gap-2 rounded-3xl border border-[#323c52] bg-[#0f172a] p-3">
                <Mail className="w-4 h-4 text-amber-300" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@domain.com"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                />
              </div>
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>🔒 Kata Sandi Rahasia</span>
              <div className="relative flex items-center gap-2 rounded-3xl border border-[#323c52] bg-[#0f172a] p-3">
                <Lock className="w-4 h-4 text-amber-300" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kata sandi Anda"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-100"
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                >
                  {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={loginWithPassword}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowRight className="w-4 h-4" />
              {loading ? "Masuk..." : `🔓 MASUK KE DASHBOARD ${platformName}`}
            </button>
            <button
              type="button"
              onClick={requestPasswordReset}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#323c52] px-5 py-3 text-sm font-bold uppercase tracking-wider text-slate-200 transition hover:border-amber-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCcw className="w-4 h-4" />
              Lupa Kata Sandi
            </button>
          </div>

          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center text-sm text-emerald-200">
            <p>
              Founder? Gunakan <Link href="/founder-login" className="font-semibold underline">login khusus Founder</Link>.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-[#323c52] bg-[#111827] p-5 text-sm text-slate-300">
              <p className="uppercase tracking-[0.3em] text-[10px] text-amber-300 font-bold">Keamanan CAPTCHA</p>
              <p className="mt-3 text-sm leading-relaxed">Jika situs Anda terkonfigurasi, token CAPTCHA akan diverifikasi di server untuk mencegah bot dan brute-force.</p>
              <p className="mt-3 text-xs text-slate-500">Parameter `NEXT_PUBLIC_TURNSTILE_SITE_KEY` dan `CLOUDFLARE_TURNSTILE_SECRET` diperlukan untuk proteksi penuh.</p>
            </div>
            <div className="rounded-3xl border border-[#323c52] bg-[#111827] p-5 text-sm text-slate-300">
              <p className="uppercase tracking-[0.3em] text-[10px] text-amber-300 font-bold">Founder Control</p>
              <p className="mt-3 text-sm leading-relaxed">Founder memiliki rute tersembunyi <code className="rounded bg-slate-900 px-2 py-0.5 text-xs">/x-founder-control-99f7jK</code>. Akses non-founder akan menghasilkan 404 palsu.</p>
            </div>
          </div>

          {message ? (
            <div className="rounded-3xl border border-[#323c52] bg-[#0f172a] p-4 text-sm text-slate-200">{message}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}