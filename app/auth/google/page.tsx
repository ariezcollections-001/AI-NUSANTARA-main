"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function GoogleAuthContent() {
  const router = useRouter();

  useEffect(() => {
    const initiateGoogleOAuth = async () => {
      try {
        const supabase = (await import("@/lib/supabase/client")).supabase;
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/api/auth/callback`,
            queryParams: {
              prompt: "select_account",
            },
          },
        });
      } catch (error) {
        console.error("OAuth error:", error);
        router.push(`/login?error=${encodeURIComponent("Gagal masuk dengan Google")}`);
      }
    };

    initiateGoogleOAuth();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-amber-400 animate-spin mx-auto mb-4" />
        <h1 className="text-2xl font-black text-white mb-2">Mengarahkan ke Google...</h1>
        <p className="text-sm text-slate-400">Mohon tunggu sebentar</p>
      </div>
    </div>
  );
}

export default function GoogleAuthPage() {
  return <GoogleAuthContent />;
}