// Server-only audit-log helper. Import only from *.functions.ts modules.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AuditEntry = {
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  details?: Record<string, unknown> | null;
};

export async function writeAudit(
  supabase: SupabaseClient<Database>,
  userId: string,
  email: string | null,
  entry: AuditEntry,
) {
  // Best-effort: never block the main mutation on a failed audit insert
  try {
    await supabase.from("audit_log").insert({
      user_id: userId,
      user_email: email,
      action: entry.action,
      entity_type: entry.entity_type ?? null,
      entity_id: entry.entity_id ?? null,
      details: (entry.details ?? null) as never,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[audit] insert failed:", e);
  }
}
