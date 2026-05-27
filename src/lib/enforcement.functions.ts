import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runEnforcementForRows, type ThermostatRow, type ZoneCfg } from "./enforcement.server";

export const enforceThermostatLimits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { data: rows, error } = await supabase
      .from("thermostats")
      .select(
        "id,name,zone,ebeco_device_id,current_setpoint,guest_max_setpoint,override_started_at,max_hold_started_at",
      );
    if (error) throw new Error(error.message);

    const { data: zones, error: zErr } = await supabase
      .from("zone_defaults")
      .select("zone,default_setpoint,override_grace_minutes,max_hold_minutes");
    if (zErr) throw new Error(zErr.message);

    const actions = await runEnforcementForRows(
      supabase,
      (rows ?? []) as ThermostatRow[],
      (zones ?? []) as ZoneCfg[],
    );

    return { actions };
  });
