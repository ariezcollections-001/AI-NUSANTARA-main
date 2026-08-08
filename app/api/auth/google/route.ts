import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    // Generate OAuth URL for Google
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${appUrl}/api/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

      if (error) {
        return NextResponse.json(
          { error: error.message || "Gagal memulai login Google." },
          { status: 400 },
        );
      }

      if (data.url) {
        return NextResponse.json({ url: data.url }, { status: 200 });
      }

      return NextResponse.json(
        { error: "Gagal memulai login Google." },
        { status: 500 },
      );
    } catch (error) {
      return NextResponse.json(
        { error: "Terjadi kesalahan server. Coba lagi nanti." },
        { status: 500 },
      );
    }
  }