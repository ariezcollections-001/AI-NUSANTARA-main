"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRoleGuard } from "@/lib/useRoleGuard";
import { Mail, Lock, AlertCircle, Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";

export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [initialEmail, setInitialEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();
  const ready = useRoleGuard("user");

  useEffect(() => {
    if (!ready) return;
    setIsMounted(true);

    const loadUser = async () => {
      try {
        const supabase = createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (user?.email) {
          setEmail(user.email);
          setInitialEmail(user.email);
          return;
        }

        if (userError) {
          console.error("Supabase getUser error:", userError.message);
        }

        setError("Tidak dapat memuat data pengguna. Silakan masuk kembali.");
      } catch (err) {
        console.error("Failed to load user:", err);
        setError("Tidak dapat memuat data pengguna. Silakan masuk kembali.");
      }
    };

    loadUser();
  }, [ready]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const normalizedEmail = email.trim().toLowerCase();
    const changeEmail = normalizedEmail !== initialEmail && normalizedEmail !== "";
    const changePassword = newPassword.length > 0 || confirmPassword.length > 0;

    if (!normalizedEmail) {
      setError("Email tidak boleh kosong.");
      setLoading(false);
      return;
    }

    if (!changeEmail && !changePassword) {
      setError("Tidak ada perubahan untuk disimpan.");
      setLoading(false);
      return;
    }

    if (changePassword) {
      if (!currentPassword) {
        setError("Kata sandi saat ini wajib diisi untuk mengganti kata sandi.");
        setLoading(false);
        return;
      }
      if (newPassword.length < 6) {
        setError("Kata sandi baru minimal 6 karakter.");
        setLoading(false);
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Konfirmasi kata sandi baru tidak cocok.");
        setLoading(false);
        return;
      }
    }

    if (changeEmail && !currentPassword) {
      setError("Kata sandi saat ini wajib diisi untuk mengganti email.");
      setLoading(false);
      return;
    }

    try {
      const updates: { email?: string; password?: string } = {};

      if (changeEmail) updates.email = normalizedEmail;
      if (changePassword) updates.password = newPassword;

      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser(updates);

      if (updateError) {
        setError(updateError.message || "Gagal memperbarui pengaturan akun.");
        setLoading(false);
        return;
      }

      setInitialEmail(normalizedEmail);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      if (changeEmail && changePassword) {
        setSuccess("Email dan kata sandi berhasil diperbarui.");
      } else if (changeEmail) {
        setSuccess("Email berhasil diperbarui. Silakan cek email konfirmasi jika diperlukan.");
      } else {
        setSuccess("Kata sandi berhasil diperbarui.");
      }

      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Gagal memperbarui pengaturan.";
      setError(errorMessage);
    } finally {
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
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
        <h1 className="text-2xl font-black text-white mb-1">Pengaturan Akun</h1>
        <p className="text-sm text-slate-400 mb-6">Perbarui alamat email atau kata sandi Anda secara mandiri.</p>

        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-sm flex items-start gap-3 mb-5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-sm flex items-start gap-3 mb-5">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-300 font-mono">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-300 font-mono">Kata Sandi Saat Ini</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-11 pr-12 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-300 font-mono">Kata Sandi Baru</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-11 pr-12 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-300 font-mono">Konfirmasi Kata Sandi Baru</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi kata sandi baru"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-11 pr-12 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 font-mono font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 rounded-xl border border-amber-400 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:from-amber-400 hover:to-orange-400 shadow-[0_4px_20px_rgba(245,158,11,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <span>Simpan Perubahan</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
