import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyFounder } from "@/lib/supabase/founder";

function inMaintenanceValue(mode: unknown): string {
  return mode === true || mode === "true" ? "true" : "false";
}

export async function GET() {
  const verify = await verifyFounder();
  if (verify.error) {
    return NextResponse.json({ success: false, error: verify.error }, { status: verify.status });
  }

  try {
    const admin = createAdminClient();
    const response = await admin
      .from("founder_config")
      .select("key_value")
      .eq("key_name", "global_maintenance_mode")
      .maybeSingle<{ key_value: string }>();

    const enabled = response.data?.key_value === "true";
    return NextResponse.json({ success: !response.error, enabled }, { status: response.error ? 500 : 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal membaca maintenance mode.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const verify = await verifyFounder();
  if (verify.error) {
    return NextResponse.json({ success: false, error: verify.error }, { status: verify.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const enabled = inMaintenanceValue(body.enabled);

    const admin = createAdminClient();
    const payload = { key_name: "global_maintenance_mode", key_value: enabled };
    const founderConfigClient = admin.from("founder_config") as unknown as {
      upsert(
        payload: { key_name: string; key_value: string },
        options?: { onConflict?: string[] | string; returning?: string },
      ): Promise<{ error: unknown; data: unknown | null }>;
    };
    const response = await founderConfigClient.upsert(
      payload,
      { onConflict: ["key_name"], returning: "representation" },
    );

    if (response.error) {
      throw response.error;
    }

    return NextResponse.json({ success: true, enabled: enabled === "true" }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan maintenance mode.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}