import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Endpoint auth lokal dinonaktifkan. Gunakan login Supabase resmi di /login.",
    },
    { status: 404 },
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      error: "Endpoint auth lokal dinonaktifkan. Gunakan login Supabase resmi di /login.",
    },
    { status: 404 },
  );
}

export async function GET() {
  return NextResponse.json(
    { error: "Endpoint tidak ditemukan." },
    { status: 404 },
  );
}
