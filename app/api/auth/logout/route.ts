import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return NextResponse.json({ success: true, message: "Berhasil keluar." });
  } catch (error) {
    return NextResponse.json(
      { error: "Gagal keluar. Coba lagi nanti." },
      { status: 500 },
    );
  }
}