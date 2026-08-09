"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, Mail, Lock, Loader2, Eye, EyeOff, ShieldCheck, Globe } from "lucide-react";
import { manualLoginWithPassword } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";

export default function FounderLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const [auditEvents, setAuditEvents] = useState<Array<{ timestamp: string; email: string; success: boolean; message: string; target: string }>>([]);

  useEffect(() => {
    setIsMounted(true);

    try {
      const raw = localStorage.getItem("founder_login_audit");
      const events = raw ? (JSON.parse(raw) as Array<{ timestamp: string; email: string; success: boolean; message: string; target: string }>) : [];
      setAuditEvents(events.slice(0, 20));
    } catch {
      setAuditEvents([]);
    }
  }, []);

  const writeAuditEvent = (entry: {
    email: string;
    success: boolean;
    message: string;
    target: string;
  }) => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("founder_login_audit");
      const events = raw ? (JSON.parse(raw) as Array<{ timestamp: string; email: string; success: boolean; message: string; target: string }>) : [];
      const next = [{ timestamp: new Date().toISOString(), ...entry }, ...events].slice(0, 100);
      localStorage.setItem("founder_login_audit", JSON.stringify(next));
      setAuditEvents(next.slice(0, 20));
    } catch {
      // ignore audit failures
    }
  };

  const handleFounderLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!isAgreed) {
      setError("Setujui Syarat Layanan Founder sebelum masuk.");
      setLoading(false);
      return;
    }

    try {
      const result = await manualLoginWithPassword(email, password);

      if (!result.success) {
        setError(result.error);
        writeAuditEvent({ email, success: false, message: result.error, target: "" });
        setLoading(false);
        return;
      }

      if (result.target !== "/x-founder-control-99f7jK") {
        await supabase.auth.signOut();
        document.cookie = "bikinai_session=; path=/; max-age=0";
        const message = "Akun ini tidak terdaftar sebagai Founder. Gunakan login user biasa.";
        setError(message);
        writeAuditEvent({ email, success: false, message, target: result.target || "/login" });
        setLoading(false);
        return;
      }

      writeAuditEvent({ email, success: true, message: "Login Founder berhasil", target: result.target });
      setSuccess("Login Founder berhasil. Mengarahkan ke panel Founder...");
      document.cookie = "bikinai_session=true; path=/; max-age=86400";
      router.replace(result.target);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Terjadi kesalahan saat masuk.";
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleFounderGoogleLogin = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const currentOrigin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${currentOrigin}/api/auth/callback`,
          queryParams: {
            hl: "id",
            prompt: "select_account",
          },
        },
      });

      if (error) {
        setError("Google OAuth gagal: " + error.message);
        writeAuditEvent({ email: "", success: false, message: error.message, target: "" });
        setLoading(false);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Terjadi kesalahan saat login dengan Google.";
      setError(errorMessage);
      setLoading(false);
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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-10 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-emerald-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-lg">
        <div className="mb-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center shadow-[0_12px_60px_rgba(16,185,129,0.12)]">
          <h1 className="text-3xl font-black text-emerald-300">Founder Secure Login</h1>
          <p className="mt-3 text-sm text-slate-300">Akses khusus Founder Control Panel. Hanya email Founder yang terdaftar di sistem yang dapat masuk.</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-slate-900 px-4 py-2 text-xs uppercase tracking-[0.35em] text-emerald-200">
            <ShieldCheck className="w-4 h-4" /> Total security audit enabled
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          {error && (
            <div className="mb-4 rounded-xl border border-red-700/60 bg-red-950/70 p-4 text-sm text-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-xl border border-emerald-500/60 bg-emerald-950/60 p-4 text-sm text-emerald-200">
              {success}
            </div>
          )}

          <form onSubmit={handleFounderLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Email Founder</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-300" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="founder@domain.com"
                  required
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-3 pl-11 pr-4 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Kata Sandi Founder</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-300" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-3 pl-11 pr-12 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                id="founder-login-terms"
                checked={isAgreed}
                onChange={(e) => setIsAgreed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-400 focus:ring-emerald-400"
              />
              <label htmlFor="founder-login-terms" className="select-none">
                Saya mengonfirmasi bahwa ini adalah akun Founder resmi dan saya mengerti keamanan login Founder terpisah dari user biasa.
              </label>
            </div>

            <button
              type="submit"
              disabled={!isAgreed || loading}
              className="w-full rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-bold uppercase tracking-wider text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Memproses...</span>
              ) : (
                <span className="inline-flex items-center gap-2"><LogIn className="h-4 w-4" /> Masuk Founder</span>
              )}
            </button>
          </form>

          {/* Google OAuth Login for Founder */}
          <div className="mt-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-900 text-slate-400">atau</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleFounderGoogleLogin}
              disabled={loading}
              className="mt-4 w-full rounded-2xl bg-white px-5 py-3 text-sm font-bold uppercase tracking-wider text-slate-900 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Globe className="h-4 w-4" />
              <span>Masuk dengan Google (Founder)</span>
            </button>
          </div>

          <div className="mt-6 border-t border-slate-800 pt-5 text-center text-sm text-slate-400">
            <p>Jika Anda bukan Founder, gunakan login user biasa di <Link href="/login" className="text-emerald-300 hover:text-emerald-200 font-semibold">halaman login user</Link>.</p>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-300">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Audit Login Founder</p>
                <p className="text-[11px] text-slate-500">Riwayat login Founder terakhir disimpan secara lokal.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  try {
                    const raw = localStorage.getItem("founder_login_audit");
                    const events = raw ? (JSON.parse(raw) as Array<{ timestamp: string; email: string; success: boolean; message: string; target: string }>) : [];
                    setAuditEvents(events.slice(0, 20));
                  } catch {
                    setAuditEvents([]);
                  }
                }}
                className="rounded-full border border-emerald-500/40 px-3 py-1 text-[11px] uppercase tracking-[0.35em] text-emerald-300 hover:bg-emerald-500/10"
              >
                Refresh
              </button>
            </div>
            {auditEvents.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada event audit Founder.</p>
            ) : (
              <div className="space-y-3 max-h-44 overflow-y-auto pr-2">
                {auditEvents.map((event, idx) => (
                  <div key={`${event.timestamp}-${idx}`} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                    <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.3em] text-slate-500">
                      <span>{event.success ? "BERHASIL" : "GAGAL"}</span>
                      <span>{new Date(event.timestamp).toLocaleString("id-ID")}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-300">{event.email}</p>
                    <p className="mt-1 text-xs text-slate-400">{event.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
