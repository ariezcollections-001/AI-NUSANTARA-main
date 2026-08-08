import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyFounder } from "@/lib/supabase/founder";

export async function GET(request: NextRequest) {
  const verify = await verifyFounder();
  if (verify.error) {
    return NextResponse.json({ ok: false, error: verify.error }, { status: verify.status });
  }

  try {
    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (key) {
      const response = await admin
        .from("founder_config")
        .select("key_name,key_value")
        .eq("key_name", key)
        .maybeSingle();

      if (response.error) {
        throw response.error;
      }

      if (!response.data) {
        return NextResponse.json({ ok: false, error: "Konfigurasi tidak ditemukan." }, { status: 404 });
      }

      return NextResponse.json({ ok: true, data: response.data });
    }

    const response = await admin.from("founder_config").select("key_name,key_value");
    if (response.error) {
      throw response.error;
    }

    type FounderConfigRow = {
      key_name: string;
      key_value: string | null;
    };

    const rows = (response.data || []) as FounderConfigRow[];
    const configObj: Record<string, string> = {};

    rows.forEach((item) => {
      configObj[item.key_name] = item.key_value || "";
    });

    return NextResponse.json({ ok: true, data: configObj });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Gagal membaca konfigurasi";
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const verify = await verifyFounder();
  if (verify.error) {
    return NextResponse.json({ ok: false, error: verify.error }, { status: verify.status });
  }

  try {
    const body = await request.json();
    const { key_name, key_value } = body;

    if (!key_name) {
      return NextResponse.json({ ok: false, error: "Parameter 'key_name' wajib diisi" }, { status: 400 });
    }

    const admin = createAdminClient();

    const founderConfigClient = admin.from("founder_config") as unknown as {
      upsert(
        payload: { key_name: string; key_value: string },
        options?: { onConflict?: string[] | string; returning?: string },
      ): Promise<{ error: unknown; data: unknown | null }>;
    };

    const response = await founderConfigClient.upsert(
      { key_name, key_value: String(key_value ?? "") },
      { onConflict: ["key_name"], returning: "representation" }
    );

    if (response.error) {
      throw response.error;
    }

    return NextResponse.json({ ok: true, data: { key_name, key_value: String(key_value ?? "") } });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Gagal menyimpan konfigurasi";
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}