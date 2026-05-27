import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  runEnforcementForRows,
  type ThermostatRow,
  type ZoneCfg,
} from "@/lib/enforcement.server";

function verifySecret(provided: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function handle(request: Request): Promise<Response> {
  const secret = request.headers.get("x-cron-secret");
  if (!verifySecret(secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { data: rows, error } = await supabaseAdmin
      .from("thermostats")
      .select(
        "id,name,zone,ebeco_device_id,current_setpoint,guest_max_setpoint,override_started_at,max_hold_started_at",
      );
    if (error) throw new Error(error.message);

    const { data: zones, error: zErr } = await supabaseAdmin
      .from("zone_defaults")
      .select("zone,default_setpoint,override_grace_minutes,max_hold_minutes");
    if (zErr) throw new Error(zErr.message);

    const actions = await runEnforcementForRows(
      supabaseAdmin as any,
      (rows ?? []) as ThermostatRow[],
      (zones ?? []) as ZoneCfg[],
    );

    console.info(
      `[cron/enforce] thermostats=${rows?.length ?? 0} actions=${actions.length}`,
    );

    return Response.json({ ok: true, count: actions.length, actions });
  } catch (e) {
    console.error("[cron/enforce] failed:", (e as Error).message);
    return Response.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}

export const Route = createFileRoute("/api/public/enforce-limits")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});
