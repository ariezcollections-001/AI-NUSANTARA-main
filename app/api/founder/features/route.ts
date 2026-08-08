import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyFounder } from "@/lib/supabase/founder";

function isAdminClientAvailable() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(serviceKey && typeof serviceKey === "string" && serviceKey.length > 20 && !serviceKey.includes("your-service-role-key"));
}

function getDatabaseClient(founderSupabase: unknown): unknown {
  if (isAdminClientAvailable()) {
    return createAdminClient();
  }
  return founderSupabase;
}

export async function GET() {
  const verify = await verifyFounder();
  if (verify.error) {
    return NextResponse.json({ error: verify.error }, { status: verify.status });
  }

  try {
    const db = getDatabaseClient(verify.supabase) as unknown as ReturnType<typeof createAdminClient>;
    const featuresResponse = await db
      .from("ai_settings")
      .select("id,feature_slug,feature_name,system_prompt,temperature,is_active,seo_title,seo_description")
      .order("id", { ascending: true });

    if (featuresResponse.error) {
      throw featuresResponse.error;
    }

    return NextResponse.json({ features: featuresResponse.data || [] });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Gagal mengambil daftar fitur";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const verify = await verifyFounder();
  if (verify.error) {
    return NextResponse.json({ error: verify.error }, { status: verify.status });
  }

  const body = await request.json().catch(() => ({}));
  const id = Number(body.id ?? 0);
  const featureName = String(body.feature_name ?? "").trim();
  const systemPrompt = String(body.system_prompt ?? "").trim();
  const temperature = Number(body.temperature ?? 0);
  const isActive = Boolean(body.is_active);
  const seoTitle = body.seo_title ? String(body.seo_title) : null;
  const seoDescription = body.seo_description ? String(body.seo_description) : null;

  if (!id || !featureName || !systemPrompt) {
    return NextResponse.json({ error: "ID fitur, nama, dan system prompt wajib diisi." }, { status: 400 });
  }

    try {
    const db = getDatabaseClient(verify.supabase) as unknown as ReturnType<typeof createAdminClient>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (db as any)
      .from("ai_settings")
      .update({
        feature_name: featureName,
        system_prompt: systemPrompt,
        temperature,
        is_active: isActive,
        seo_title: seoTitle,
        seo_description: seoDescription,
      })
      .eq("id", id)
      .select()
      .single();

    if (response?.error) {
      if (response.status === 404) {
        return NextResponse.json({ error: "Feature tidak ditemukan." }, { status: 404 });
      }
      throw response.error;
    }

    return NextResponse.json({ success: true, feature: response.data });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Gagal memperbarui fitur";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
