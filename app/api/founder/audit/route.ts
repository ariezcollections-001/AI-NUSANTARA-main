import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyFounder } from "@/lib/supabase/founder";

export async function GET() {
  const verify = await verifyFounder();
  if (verify.error) {
    return NextResponse.json({ error: verify.error }, { status: verify.status });
  }

  const admin = createAdminClient();
  const logsResponse = await admin
    .from("security_logs")
    .select("id,event_type,ip_address,details,timestamp")
    .order("timestamp", { ascending: false })
    .limit(100);

  if (logsResponse.error) {
    return NextResponse.json({ error: logsResponse.error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: logsResponse.data || [] });
}
