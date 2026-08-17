/**
 * Audit log terstruktur (JSON per baris ke konsol).
 * Desain: JANGAN PERNAH throw — audit tidak boleh mengganggu aliran permintaan.
 * Dapat diperluas nanti ke tabel Supabase (audit_log) bila kebutuhan muncul.
 */
export interface AuditEntry {
  actor?: string;
  feature?: string;
  action: string;
  detail?: string;
  ms?: number;
  ok?: boolean;
}

export function auditLog(entry: AuditEntry): void {
  const record = {
    t: new Date().toISOString(),
    level: "audit",
    ...entry,
  };
  try {
    console.log(JSON.stringify(record));
  } catch {
    /* no-op: audit must never break the request */
  }
}
