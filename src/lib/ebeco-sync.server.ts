// Shared Ebeco → Supabase sync logic, callable from either a user-context
// server function or an admin/cron context. Accepts any Supabase client.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchDevicesDetailed,
  pickRoomTemp,
  pickFloorTemp,
  ebecoPatchToColumns,
  type EbecoPatch,
} from "./ebeco.server";

export function isEbecoOffline(d: {
  online?: boolean;
  hasError?: boolean;
  errorMessage?: string | null;
}): boolean {
  if (d.online === false) return true;
  if (d.hasError === true) return true;
  if (typeof d.errorMessage === "string" && /offline/i.test(d.errorMessage)) return true;
  return false;
}

export type SyncResult = { created: number; updated: number; total: number };

export async function syncEbecoIntoSupabase(supabase: SupabaseClient): Promise<SyncResult> {
  const devices = await fetchDevicesDetailed();

  const { data: existing } = await supabase
    .from("thermostats")
    .select("id,ebeco_device_id");
  const existingByEbecoId = new Map<string, string>(
    (existing ?? [])
      .filter((t: any) => t.ebeco_device_id)
      .map((t: any) => [String(t.ebeco_device_id), t.id]),
  );

  let created = 0;
  let updated = 0;
  const nowIso = new Date().toISOString();
  const readingsToInsert: Array<{
    thermostat_id: string;
    ts: string;
    setpoint: number | null;
    room_temp: number | null;
    floor_temp: number | null;
  }> = [];

  for (const d of devices) {
    const ebecoId = String(d.id);
    const status: "online" | "offline" = isEbecoOffline(d) ? "offline" : "online";
    const setpoint = typeof d.temperatureSet === "number" ? d.temperatureSet : null;
    const existingId = existingByEbecoId.get(ebecoId);
    const ebecoCols = ebecoPatchToColumns(d as unknown as EbecoPatch);

    if (existingId) {
      const patch: Record<string, unknown> = {
        status,
        ebeco_settings: d as unknown as Record<string, unknown>,
        ...ebecoCols,
      };
      if (status === "online") patch.last_seen_at = nowIso;
      if (setpoint != null) patch.current_setpoint = setpoint;
      const { error } = await (supabase.from("thermostats") as any).update(patch).eq("id", existingId);
      if (error) throw new Error(error.message);
      updated += 1;

      readingsToInsert.push({
        thermostat_id: existingId,
        ts: nowIso,
        setpoint,
        room_temp: pickRoomTemp(d),
        floor_temp: pickFloorTemp(d),
      });
    } else {
      const { data: ins, error } = await (supabase.from("thermostats") as any)
        .insert({
          ebeco_device_id: ebecoId,
          name: d.displayName ?? `EB-${ebecoId}`,
          zone: "room",
          apartment_id: null,
          status,
          current_setpoint: setpoint ?? 21,
          last_seen_at: nowIso,
          ebeco_settings: d as unknown as Record<string, unknown>,
          ...ebecoCols,
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);
      if (!ins?.id) continue;
      created += 1;
      readingsToInsert.push({
        thermostat_id: ins.id,
        ts: nowIso,
        setpoint,
        room_temp: pickRoomTemp(d),
        floor_temp: pickFloorTemp(d),
      });
    }
  }

  const validReadings = readingsToInsert.filter((r) => !!r.thermostat_id);
  if (validReadings.length > 0) {
    const ids = Array.from(new Set(validReadings.map((r) => r.thermostat_id)));
    const { data: confirmed } = await supabase
      .from("thermostats")
      .select("id")
      .in("id", ids);
    const confirmedIds = new Set((confirmed ?? []).map((t: any) => t.id));
    const safeReadings = validReadings.filter((r) => confirmedIds.has(r.thermostat_id));
    if (safeReadings.length > 0) {
      const { error: readingsError } = await supabase
        .from("thermostat_readings")
        .insert(safeReadings);
      if (readingsError) {
        console.error("[syncEbecoIntoSupabase] readings insert failed:", readingsError.message);
      }
    }
  }

  return { created, updated, total: devices.length };
}
