// Server-only helpers for guest-max enforcement.
import { updateDevice } from "./ebeco.server";

export type EnforceAction = {
  id: string;
  name: string;
  from: number;
  to: number;
  reason: "guest_max" | "max_hold";
};

export type ThermostatRow = {
  id: string;
  name: string;
  zone: string;
  ebeco_device_id: string | null;
  current_setpoint: number;
  guest_max_setpoint: number;
  override_started_at: string | null;
  max_hold_started_at: string | null;
};

export type ZoneCfg = {
  zone: string;
  default_setpoint: number;
  override_grace_minutes: number;
  max_hold_minutes: number;
};

export async function runEnforcementForRows(
  supabase: any,
  rows: ThermostatRow[],
  zones: ZoneCfg[],
): Promise<EnforceAction[]> {
  const nowIso = new Date().toISOString();
  const now = Date.now();
  const zoneByName = new Map(zones.map((z) => [z.zone, z]));
  const actions: EnforceAction[] = [];

  for (const t of rows) {
    const z = zoneByName.get(t.zone);
    if (!z) continue;

    const setpoint = Number(t.current_setpoint);
    const guestMax = Number(t.guest_max_setpoint);
    const ebecoId = t.ebeco_device_id ? Number(t.ebeco_device_id) : null;

    // 1) Override-clamp: setpoint > guest_max
    if (setpoint > guestMax) {
      // Set override_started_at if not set yet
      if (!t.override_started_at) {
        await supabase
          .from("thermostats")
          .update({ override_started_at: nowIso })
          .eq("id", t.id);
        t.override_started_at = nowIso;
      }

      const startedMs = t.override_started_at
        ? new Date(t.override_started_at).getTime()
        : now;
      const grace = (z.override_grace_minutes ?? 0) * 60_000;

      if (now - startedMs >= grace) {
        // Clamp
        if (ebecoId && !Number.isNaN(ebecoId)) {
          try {
            await updateDevice({ id: ebecoId, temperatureSet: guestMax });
          } catch (e) {
            console.error(
              `[enforce] Ebeco clamp epäonnistui id=${t.id}:`,
              (e as Error).message,
            );
            continue;
          }
        }
        await supabase
          .from("thermostats")
          .update({
            current_setpoint: guestMax,
            override_started_at: null,
            max_hold_started_at: nowIso,
          })
          .eq("id", t.id);
        await supabase.from("thermostat_readings").insert({
          thermostat_id: t.id,
          ts: nowIso,
          setpoint: guestMax,
          event: "guest_max_enforced",
        });
        actions.push({
          id: t.id,
          name: t.name,
          from: setpoint,
          to: guestMax,
          reason: "guest_max",
        });
        continue;
      }
    }

    // 2) Max-hold demote: setpoint >= guest_max for hold_minutes
    if (setpoint >= guestMax && (z.max_hold_minutes ?? 0) > 0) {
      // Ensure max_hold_started_at set
      if (!t.max_hold_started_at) {
        await supabase
          .from("thermostats")
          .update({ max_hold_started_at: nowIso })
          .eq("id", t.id);
        t.max_hold_started_at = nowIso;
      }
      const startedMs = t.max_hold_started_at
        ? new Date(t.max_hold_started_at).getTime()
        : now;
      const hold = z.max_hold_minutes * 60_000;

      if (now - startedMs >= hold) {
        const fallback = Number(z.default_setpoint);
        if (ebecoId && !Number.isNaN(ebecoId)) {
          try {
            await updateDevice({
              id: ebecoId,
              temperatureSet: fallback,
              selectedProgram: "manual",
            });
          } catch (e) {
            console.error(
              `[enforce] Ebeco demote epäonnistui id=${t.id}:`,
              (e as Error).message,
            );
            continue;
          }
        }
        await supabase
          .from("thermostats")
          .update({
            current_setpoint: fallback,
            max_hold_started_at: null,
            override_started_at: null,
            selected_program: "manual",
            current_schedule_id: null,
          })
          .eq("id", t.id);
        await supabase.from("thermostat_readings").insert({
          thermostat_id: t.id,
          ts: nowIso,
          setpoint: fallback,
          event: "max_hold_expired",
        });
        actions.push({
          id: t.id,
          name: t.name,
          from: setpoint,
          to: fallback,
          reason: "max_hold",
        });
      }
    } else if (setpoint < guestMax && t.max_hold_started_at) {
      // Reset hold timer if user dropped below max
      await supabase
        .from("thermostats")
        .update({ max_hold_started_at: null })
        .eq("id", t.id);
    }
  }

  return actions;
}
