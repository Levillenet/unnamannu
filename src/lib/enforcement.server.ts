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

  // Termostaattikohtaiset vyöhykepoikkeukset
  const ovById = new Map<string, { def: number | null; until: string | null }>();
  if (rows.length > 0) {
    const { data: ovRows } = await supabase
      .from("thermostats")
      .select("id,zone_override,override_default_setpoint,override_until")
      .in("id", rows.map((r) => r.id))
      .eq("zone_override", true);
    for (const o of ovRows ?? []) {
      ovById.set(o.id, {
        def: o.override_default_setpoint != null ? Number(o.override_default_setpoint) : null,
        until: o.override_until,
      });
    }
  }

  for (const t of rows) {
    let z = zoneByName.get(t.zone);
    if (!z) continue;
    const ov = ovById.get(t.id);
    if (ov) {
      if (ov.until && new Date(ov.until).getTime() <= now) {
        // Poikkeus vanhentunut → palaa vyöhykkeen arvoihin
        const zFull = await supabase.from("zone_defaults").select("guest_max_setpoint").eq("zone", t.zone).limit(1).maybeSingle();
        const gm = Number(zFull.data?.guest_max_setpoint ?? t.guest_max_setpoint);
        const sp = Math.min(Number(z.default_setpoint), gm);
        const eid = t.ebeco_device_id ? Number(t.ebeco_device_id) : null;
        if (eid && !Number.isNaN(eid)) {
          try { await updateDevice({ id: eid, temperatureSet: sp, maxSetpoint: gm } as any); } catch (e) {
            console.error(`[enforce] poikkeuksen päättäminen epäonnistui id=${t.id}:`, (e as Error).message);
            continue;
          }
        }
        await supabase.from("thermostats").update({
          zone_override: false, override_default_setpoint: null, override_until: null,
          guest_max_setpoint: gm, current_setpoint: sp, override_started_at: null, max_hold_started_at: null,
        }).eq("id", t.id);
        actions.push({ id: t.id, name: t.name, from: Number(t.current_setpoint), to: sp, reason: "max_hold" });
        continue;
      }
      if (ov.def != null) z = { ...z, default_setpoint: ov.def };
    }

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

    // 2) Palautus oletukseen: mikä tahansa oletusta korkeampi asetus
    //    palautuu oletukseen max_hold_minutes jälkeen.
    const defSp = Number(z.default_setpoint);
    if (setpoint <= defSp && t.max_hold_started_at) {
      await supabase
        .from("thermostats")
        .update({ max_hold_started_at: null })
        .eq("id", t.id);
      t.max_hold_started_at = null;
    }
    if (setpoint > defSp && (z.max_hold_minutes ?? 0) > 0) {
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
