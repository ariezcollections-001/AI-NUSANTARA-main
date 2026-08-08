import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyFounder } from "@/lib/supabase/founder";

const ALLOWED_MIME = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

export async function POST(request: NextRequest) {
  const verify = await verifyFounder();
  if (verify.error) {
    return NextResponse.json({ ok: false, error: verify.error }, { status: verify.status });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("logo");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "File logo tidak ditemukan dalam permintaan." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Format file tidak didukung. Gunakan PNG, JPG, atau SVG." },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Ukuran file melebihi batas 2MB." },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const safeExt = ["png", "jpg", "jpeg", "svg"].includes(ext) ? ext : "png";
    const fileName = `platform-logo-${Date.now()}.${safeExt}`;

    const publicDir = path.join(process.cwd(), "public");
    try {
      await fs.mkdir(publicDir, { recursive: true });
    } catch {
      // ignore
    }

    // Clean up old logos (best-effort)
    try {
      const existing = await fs.readdir(publicDir);
      await Promise.all(
        existing
          .filter((f) => f.startsWith("platform-logo-"))
          .map((f) => fs.unlink(path.join(publicDir, f)).catch(() => {}))
      );
    } catch {
      // ignore
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(publicDir, fileName);
    await fs.writeFile(filePath, buffer);

    const logoPath = `/${fileName}`;
    const admin = createAdminClient();
    const payload = { key_name: "platform_logo", key_value: logoPath };
    const founderConfigClient = admin.from("founder_config") as unknown as {
      upsert(
        payload: { key_name: string; key_value: string },
        options?: { onConflict?: string[] | string; returning?: string },
      ): Promise<{ error: unknown; data: unknown | null }>;
    };
    const response = await founderConfigClient.upsert(payload, {
      onConflict: ["key_name"],
      returning: "representation",
    });

    if (response.error) {
      throw response.error;
    }

    return NextResponse.json({ ok: true, data: { platform_logo: logoPath } });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Gagal mengunggah logo.";
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}