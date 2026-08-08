import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Phone fallback auth dinonaktifkan. Gunakan Supabase auth resmi atau hapus fitur ini.",
    },
    { status: 404 },
  );
}
