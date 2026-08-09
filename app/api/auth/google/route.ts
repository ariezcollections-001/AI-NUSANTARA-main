import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || requestUrl.host;
    const protocol = request.headers.get("x-forwarded-proto") || (requestUrl.protocol.replace(":", "") || "https");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? process.env.NEXT_PUBLIC_SITE_URL
      ?? `${protocol}://${forwardedHost}`;

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