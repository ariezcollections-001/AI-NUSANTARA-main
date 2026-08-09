import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyFounder } from "@/lib/supabase/founder";

const KEY_CURRENT = "release_current_version";
const KEY_PREVIOUS = "release_previous_version";
const KEY_HISTORY = "release_deployments";

type ReleaseInfo = {
  version: string;
  label: string;
  commit: string;
  deployed_at: string;
  deployed_by: string;
};

function environmentInfo() {
  return {
    commit:
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
      "",
    ref:
      process.env.VERCEL_GIT_COMMIT_REF ||
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF ||
      "",
    vercelEnv: process.env.VERCEL_ENV || "development",
  };
}

function bumpVersion(previousVersion?: string): string {
  const base = previousVersion || "v0.0.0";
  const match = base.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (match) {
    const major = Number(match[1]) || 0;
    const minor = Number(match[2]) || 0;
    const patch = Number(match[3]) || 0;
    return `v${major}.${minor}.${patch + 1}`;
  }
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, ".");
  return `v${today}.1`;
}

async function readJson(
  admin: ReturnType<typeof createAdminClient>,
  key: string,
): Promise<unknown | null> {
  const { data, error } = await admin
    .from("founder_config")
    .select("key_value")
    .eq("key_name", key)
    .maybeSingle<{ key_value: string }>();

  if (error || !data?.key_value) return null;
  try {
    return JSON.parse(data.key_value);
  } catch {
    return null;
  }
}

async function writeJson(
  admin: ReturnType<typeof createAdminClient>,
  key: string,
  value: unknown,
) {
  const client = admin.from("founder_config") as unknown as {
    upsert(
      payload: { key_name: string; key_value: string },
      options?: { onConflict?: string[] | string; returning?: string },
    ): Promise<{ error: unknown; data: unknown | null }>;
  };

  const { error } = await client.upsert(
    { key_name: key, key_value: JSON.stringify(value) },
    { onConflict: ["key_name"], returning: "representation" },
  );
  if (error) throw error;
}

async function readState(admin: ReturnType<typeof createAdminClient>) {
  const current = (await readJson(admin, KEY_CURRENT)) as ReleaseInfo | null;
  const previous = (await readJson(admin, KEY_PREVIOUS)) as ReleaseInfo | null;
  const rawHistory = (await readJson(admin, KEY_HISTORY)) as ReleaseInfo[] | null;
  return {
    current,
    previous,
    history: Array.isArray(rawHistory) ? rawHistory : [],
  };
}

async function logEvent(
  admin: ReturnType<typeof createAdminClient>,
  eventType: string,
  details: Record<string, unknown>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from("security_logs").insert({
    event_type: eventType,
    ip_address: null,
    details,
  });
}

export async function GET() {
  const verify = await verifyFounder();
  if (verify.error) {
    return NextResponse.json(
      { ok: false, error: verify.error },
      { status: verify.status },
    );
  }

  try {
    const admin = createAdminClient();
    const state = await readState(admin);

    return NextResponse.json({
      ok: true,
      data: {
        current: state.current,
        previous: state.previous,
        history: state.history,
        environment: environmentInfo(),
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal membaca status release.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const verify = await verifyFounder();
  if (verify.error) {
    return NextResponse.json(
      { ok: false, error: verify.error },
      { status: verify.status },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "").trim();

    if (!action) {
      return NextResponse.json(
        { ok: false, error: "Aksi release diperlukan." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const env = environmentInfo();

    if (action === "deploy") {
      const state = await readState(admin);
      const newVersion = bumpVersion(
        state.current?.version ?? state.previous?.version,
      );
      const now = new Date().toISOString();

      const nextCurrent: ReleaseInfo = {
        version: newVersion,
        label: "Latest",
        commit: env.commit || "HEAD",
        deployed_at: now,
        deployed_by: verify.founderEmail || verify.founderId,
      };
      const nextPrevious: ReleaseInfo | null = state.current
        ? { ...state.current, label: "Previous" }
        : state.previous;
      const nextHistory = [nextCurrent, ...state.history].slice(0, 10);

      await writeJson(admin, KEY_CURRENT, nextCurrent);
      if (nextPrevious) await writeJson(admin, KEY_PREVIOUS, nextPrevious);
      else await writeJson(admin, KEY_PREVIOUS, null);
      await writeJson(admin, KEY_HISTORY, nextHistory);

      await logEvent(admin, "founder_release_deploy", {
        version: nextCurrent.version,
        commit: nextCurrent.commit,
        founder_id: verify.founderId,
      });

      return NextResponse.json({
        ok: true,
        data: {
          current: nextCurrent,
          previous: nextPrevious,
          history: nextHistory,
          environment: env,
        },
      });
    }

    if (action === "rollback") {
      const state = await readState(admin);
      if (!state.current || !state.previous) {
        return NextResponse.json(
          {
            ok: false,
            error: "Tidak ada versi sebelumnya yang tersedia untuk rollback.",
          },
          { status: 400 },
        );
      }

      const now = new Date().toISOString();
      const nextCurrent: ReleaseInfo = {
        ...state.previous,
        label: "Latest (Rollback)",
        deployed_at: now,
        deployed_by: verify.founderEmail || verify.founderId,
      };
      const nextPrevious: ReleaseInfo = {
        ...state.current,
        label: "Previous (Rollback)",
        deployed_at: now,
      };
      const nextHistory = [
        { ...state.previous, label: "Rollback" },
        ...state.history,
      ].slice(0, 10);

      await writeJson(admin, KEY_CURRENT, nextCurrent);
      await writeJson(admin, KEY_PREVIOUS, nextPrevious);
      await writeJson(admin, KEY_HISTORY, nextHistory);

      await logEvent(admin, "founder_release_rollback", {
        from_version: state.current.version,
        to_version: nextCurrent.version,
        founder_id: verify.founderId,
      });

      return NextResponse.json({
        ok: true,
        data: {
          current: nextCurrent,
          previous: nextPrevious,
          history: nextHistory,
          environment: env,
        },
      });
    }

    if (action === "preview") {
      const state = await readState(admin);
      const target = String(body.target ?? "current").trim();

      let release: ReleaseInfo | undefined;
      if (target === "current") release = state.current ?? undefined;
      else if (target === "previous") release = state.previous ?? undefined;
      else {
        release =
          state.history.find((r) => r.version === target) ??
          state.history.find((r) =>
            String(r.label ?? "").toLowerCase().includes(target.toLowerCase()),
          );
      }

      if (!release) {
        return NextResponse.json(
          { ok: false, error: `Versi "${target}" tidak ditemukan.` },
          { status: 404 },
        );
      }

      await logEvent(admin, "founder_release_preview", {
        version: release.version,
        founder_id: verify.founderId,
      });

      return NextResponse.json({
        ok: true,
        data: { release, environment: env },
      });
    }

    return NextResponse.json(
      { ok: false, error: "Aksi release tidak dikenali." },
      { status: 400 },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal memproses aksi release.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
