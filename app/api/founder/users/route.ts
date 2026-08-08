import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyFounder } from "@/lib/supabase/founder";

async function fetchBannedUsers(admin: ReturnType<typeof createAdminClient>) {
  const configResponse = await admin
    .from("founder_config")
    .select("key_value")
    .eq("key_name", "banned_users")
    .maybeSingle<{ key_value: string }>();

  if (configResponse.error || !configResponse.data?.key_value) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(configResponse.data.key_value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const verify = await verifyFounder();
  if (verify.error) {
    return NextResponse.json({ error: verify.error }, { status: verify.status });
  }

  try {
    const admin = createAdminClient();
    const usersResponse = await admin
      .from("users")
      .select("id,email,role,character_balance,device_fingerprint,created_at");

    if (usersResponse.error) {
      throw usersResponse.error;
    }

    const users = (usersResponse.data || []) as Array<Record<string, unknown>>;
    const bannedUsers = await fetchBannedUsers(admin);

    return NextResponse.json({
      users: users.map((user) => ({
        ...user,
        is_banned: bannedUsers.includes(String(user.id)),
      })),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Gagal memuat daftar pengguna founder.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const verify = await verifyFounder();
  if (verify.error) {
    return NextResponse.json({ error: verify.error }, { status: verify.status });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "").trim();
  const userId = String(body.user_id ?? "").trim();
  const amount = Number(body.amount ?? 0);

  if (!userId || !action) {
    return NextResponse.json({ error: "Aksi dan user_id diperlukan." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    if (action === "add_balance") {
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "Jumlah saldo tidak valid." }, { status: 400 });
      }

      const userResponse = await admin
        .from("users")
        .select("id,email,character_balance")
        .eq("id", userId)
        .single<{ id: string; email: string; character_balance?: number }>();

      if (userResponse.error || !userResponse.data) {
        return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
      }

      const currentBalance = Number(userResponse.data.character_balance || 0);
      const updatedBalance = currentBalance + amount;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateResponse = await (admin as any)
        .from("users")
        .update({ character_balance: updatedBalance })
        .eq("id", userId)
        .select()
        .single();

      if (updateResponse.error || !updateResponse.data) {
        throw updateResponse.error ?? new Error("Gagal memperbarui saldo pengguna.");
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from("security_logs").insert({
        event_type: "founder_add_balance",
        ip_address: null,
        details: { user_id: userId, amount },
      });

      return NextResponse.json({ success: true, user: updateResponse.data });
    }

    if (action === "ban" || action === "unban") {
      const isBanAction = action === "ban";
      const bannedUsers = await fetchBannedUsers(admin);
      const nextBannedUsers = isBanAction
        ? Array.from(new Set([...bannedUsers, userId]))
        : bannedUsers.filter((id) => id !== userId);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const configResponse = await (admin as any).from("founder_config").upsert(
        { key_name: "banned_users", key_value: JSON.stringify(nextBannedUsers) },
        { onConflict: ["key_name"], returning: "representation" },
      );

      if (configResponse.error) {
        throw configResponse.error;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from("security_logs").insert({
        event_type: isBanAction ? "founder_ban_user" : "founder_unban_user",
        ip_address: null,
        details: { user_id: userId, founder_id: verify.founderId },
      });

      return NextResponse.json({ success: true, is_banned: isBanAction, banned_users: nextBannedUsers });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Gagal memproses aksi founder.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

