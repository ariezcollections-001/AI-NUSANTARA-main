import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    platform: "NUSANTARA",
    message: "API foundation ready",
  });
}
