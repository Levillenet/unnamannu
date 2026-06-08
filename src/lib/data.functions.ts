import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeAudit } from "./audit.server";
import {
  fetchDevices,
  fetchDevicesDetailed,
  fetchDeviceById,
  updateDevice,
  pickRoomTemp,
  pickFloorTemp,
  EBECO_PATCH_FIELDS,
  ebecoPatchToColumns,
  type EbecoPatch,
} from "./ebeco.server";
import { z } from "zod";

// Zod schema for any subset of Ebeco-forwardable fields.
const ebecoPatchSchema = z
  .object({
    displayName: z.string().min(1).max(100).optional(),
    powerOn: z.boolean().optional(),
    temperatureSet: z.number().min(5).max(35).optional(),
    minSetpoint: z.number().min(5).max(35).optional(),
    maxSetpoint: z.number().min(5).max(35).optional(),
    sensorApplication: z.enum(["floor", "room", "roomAndFloor"]).optional(),
    sensorType: z.string().min(1).max(20).optional(),
    minFloorTemp: z.number().min(5).max(40).optional(),
    maxFloorTemp: z.number().min(5).max(40).optional(),
    floorTempCutOff: z.number().min(5).max(45).optional(),
    temperatureCalibrationRoom: z.number().min(-5).max(5).optional(),
    temperatureCalibrationFloor: z.number().min(-5).max(5).optional(),
    displayWhenIdle: z
      .enum(["off", "dateAndTime", "temperature", "temperatureAndTime"])
      .optional(),
    lightLedTextWhenIdle: z.number().int().min(0).max(100).optional(),
    lightLedTextDuringOperation: z.number().int().min(0).max(100).optional(),
    screenSaverEnabled: z.boolean().optional(),
    language: z.string().min(1).max(10).optional(),
    timeFormat: z.string().min(1).max(10).optional(),
    dateFormat: z.string().min(1).max(20).optional(),
    childLock: z.boolean().optional(),
    pinCodeEnabled: z.boolean().optional(),
    installerLock: z.boolean().optional(),
    selectedProgram: z.string().min(1).max(20).optional(),
    awayTemperature: z.number().min(5).max(35).optional(),
    vacationFrom: z.string().max(40).optional(),
    vacationTo: z.string().max(40).optional(),
    vacationTemperature: z.number().min(5).max(35).optional(),
    installedEffect: z.number().int().min(0).max(10000).optional(),
    adaptiveStart: z.boolean().optional(),
    openWindowDetection: z.boolean().optional(),
    openWindowSensitivity: z.number().int().min(0).max(10).optional(),
    regulatorMode: z.string().min(1).max(20).optional(),
    pwmPeriod: z.number().int().min(0).max(120).optional(),
  })
  .strict();



async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_admin", { _user_id: userId });
  if (!data) throw new Error("Vain admin voi tehdä tämän muutoksen");
}

const MAX_EXCEEDANCE_EVENTS = ["guest_max_exceeded", "guest_max_enforced", "max_hold_expired"];

export const getBuildingOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: building }, { data: apartments }, { data: thermostats }] = await Promise.all([
      supabase.from("buildings").select("*").limit(1).maybeSingle(),
      supabase.from("apartments").select("id"),
      supabase.from("thermostats").select("id,status,current_setpoint,zone"),
    ]);

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: readings24h } = await supabase
      .from("thermostat_readings")
      .select("energy_kwh,room_temp,event")
      .gte("ts", since);

    const energy24h = (readings24h ?? []).reduce((s, r) => s + Number(r.energy_kwh ?? 0), 0);
    const tempReadings = (readings24h ?? []).filter((r) => r.room_temp != null);
    const avgRoom =
      tempReadings.length > 0
        ? tempReadings.reduce((s, r) => s + Number(r.room_temp), 0) / tempReadings.length
        : null;
    const enforcedCount = (readings24h ?? []).filter((r) => MAX_EXCEEDANCE_EVENTS.includes(r.event ?? "")).length;

    const ts = thermostats ?? [];
    const avgSp = ts.length
      ? ts.reduce((s, t) => s + Number(t.current_setpoint), 0) / ts.length
      : null;

    return {
      building,
      apartmentCount: apartments?.length ?? 0,
      thermostatCount: ts.length,
      online: ts.filter((t) => t.status === "online").length,
      offline: ts.filter((t) => t.status === "offline").length,
      alarms: ts.filter((t) => t.status === "alarm").length,
      energy24h,
      avgRoomTemp: avgRoom,
      enforcedCount,
      avgSetpoint: avgSp,
    };
  });

export const getMaxExceedances24h = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: readings, error: readingsError } = await supabase
      .from("thermostat_readings")
      .select("thermostat_id,ts,setpoint,event")
      .gte("ts", since)
      .in("event", MAX_EXCEEDANCE_EVENTS)
      .order("ts", { ascending: false });
    if (readingsError) throw new Error(readingsError.message);

    const thermostatIds = [...new Set((readings ?? []).map((r) => r.thermostat_id).filter((id): id is string => Boolean(id)))];
    if (thermostatIds.length === 0) return { total: 0, rows: [] };

    const { data: thermostats, error: thermostatError } = await supabase
      .from("thermostats")
      .select("id,name,room,guest_max_setpoint,apartment_id")
      .in("id", thermostatIds);
    if (thermostatError) throw new Error(thermostatError.message);

    const apartmentIds = [...new Set((thermostats ?? []).map((t) => t.apartment_id).filter((id): id is string => Boolean(id)))];
    const { data: apartments, error: apartmentError } = apartmentIds.length
      ? await supabase.from("apartments").select("id,number,floor").in("id", apartmentIds)
      : { data: [], error: null };
    if (apartmentError) throw new Error(apartmentError.message);

    const thermostatById = new Map((thermostats ?? []).map((t) => [t.id, t]));
    const apartmentById = new Map((apartments ?? []).map((a) => [a.id, a]));
    const byApartment = new Map<string, any>();

    for (const r of readings ?? []) {
      const t = thermostatById.get(r.thermostat_id);
      const a = t?.apartment_id ? apartmentById.get(t.apartment_id) : null;
      const key = a?.id ?? "unallocated";
      if (!byApartment.has(key)) {
        byApartment.set(key, {
          apartment_id: a?.id ?? null,
          apartment_number: a?.number ?? "Allokoimaton",
          floor: a?.floor ?? null,
          count: 0,
          latest_at: r.ts,
          thermostats: [],
        });
      }
      const row = byApartment.get(key);
      row.count += 1;
      if (new Date(r.ts).getTime() > new Date(row.latest_at).getTime()) row.latest_at = r.ts;
      row.thermostats.push({
        id: t?.id ?? r.thermostat_id,
        name: t?.room ?? t?.name ?? "Termostaatti",
        setpoint: r.setpoint,
        guest_max_setpoint: t?.guest_max_setpoint ?? null,
        event: r.event,
        ts: r.ts,
      });
    }

    return { total: readings?.length ?? 0, rows: [...byApartment.values()].sort((a, b) => b.count - a.count) };
  });

export const listApartments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: apartments, error } = await supabase
      .from("apartments")
      .select("*, thermostats(id,name,room,status,current_setpoint,guest_max_setpoint,zone,locked,last_seen_at,ebeco_settings)")
      .order("number");
    if (error) throw new Error(error.message);
    return apartments ?? [];
  });

export const updateApartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      notes: z.string().max(5000).nullable().optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { id, ...patch } = data;
    const { error } = await supabase.from("apartments").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    await writeAudit(supabase, userId, (claims as { email?: string }).email ?? null, {
      action: "apartment.update", entity_type: "apartment", entity_id: id, details: patch,
    });
    return { ok: true };
  });

export const applyZoneToThermostats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      zone: z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/),
      guest_max_setpoint: z.number().min(5).max(35),
      default_setpoint: z.number().min(5).max(35),
      applyDefaultSetpoint: z.boolean().optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await requireAdmin(supabase, userId);
    const patch: { guest_max_setpoint: number; current_setpoint?: number } = {
      guest_max_setpoint: data.guest_max_setpoint,
    };
    if (data.applyDefaultSetpoint) patch.current_setpoint = data.default_setpoint;
    const { data: targets, error: selErr } = await supabase
      .from("thermostats")
      .select("id,ebeco_device_id")
      .eq("zone", data.zone);
    if (selErr) throw new Error(selErr.message);
    const { error } = await supabase.from("thermostats").update(patch).eq("zone", data.zone);
    if (error) throw new Error(error.message);

    let pushed = 0;
    let failed = 0;
    if (data.applyDefaultSetpoint && (targets ?? []).length > 0) {
      const results = await Promise.allSettled(
        (targets ?? [])
          .filter((t) => t.ebeco_device_id)
          .map((t) =>
            updateDevice({ id: Number(t.ebeco_device_id), temperatureSet: data.default_setpoint }),
          ),
      );
      pushed = results.filter((r) => r.status === "fulfilled").length;
      failed = results.filter((r) => r.status === "rejected").length;
    }

    const affected = (targets ?? []).length;
    await writeAudit(supabase, userId, (claims as { email?: string }).email ?? null, {
      action: "zone.apply_to_thermostats", entity_type: "zone", entity_id: data.zone,
      details: { ...patch, affected, pushed, failed },
    });
    return { affected, pushed, failed };
  });


export const getApartment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: apt, error } = await supabase
      .from("apartments")
      .select("*, thermostats(*, schedules:current_schedule_id(id,name))")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return apt;
  });

export const getThermostat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: t, error } = await supabase
      .from("thermostats")
      .select("*, apartments(id,number), schedules:current_schedule_id(id,name)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: readings } = await supabase
      .from("thermostat_readings")
      .select("ts,room_temp,floor_temp,setpoint,power_w,energy_kwh,event")
      .eq("thermostat_id", data.id)
      .gte("ts", since)
      .order("ts");

    return { thermostat: t, readings: readings ?? [] };
  });

export const updateThermostat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      current_setpoint: z.number().min(5).max(35).optional(),
      guest_max_setpoint: z.number().min(5).max(35).optional(),
      enabled: z.boolean().optional(),
      locked: z.boolean().optional(),
      zone: z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/).optional(),
      name: z.string().min(1).max(100).optional(),
      apartment_id: z.string().uuid().nullable().optional(),
      current_schedule_id: z.string().uuid().nullable().optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { id, ...patch } = data;
    const adminOnly = ["apartment_id", "zone", "name"] as const;
    if (adminOnly.some((k) => k in patch)) await requireAdmin(supabase, userId);

    const needsEbeco =
      patch.current_setpoint != null ||
      patch.enabled != null ||
      patch.guest_max_setpoint != null;

    // Hae nykytila jos tarvitsemme guest_maxin override-laskentaan tai Ebeco-kutsuun.
    let currentRow: { ebeco_device_id: string | null; guest_max_setpoint: number } | null = null;
    if (needsEbeco || patch.current_setpoint != null) {
      const { data: t } = await supabase
        .from("thermostats")
        .select("ebeco_device_id,guest_max_setpoint")
        .eq("id", id)
        .maybeSingle();
      currentRow = t ?? null;
    }

    if (needsEbeco && currentRow) {
      const ebecoId = currentRow.ebeco_device_id ? Number(currentRow.ebeco_device_id) : null;
      if (ebecoId && !Number.isNaN(ebecoId)) {
        await updateDevice({
          id: ebecoId,
          ...(patch.current_setpoint != null ? { temperatureSet: patch.current_setpoint } : {}),
          ...(patch.enabled != null ? { powerOn: patch.enabled } : {}),
          // Asiakkaan yläraja pakotetaan aina myös termostaatin laiterajaksi.
          ...(patch.guest_max_setpoint != null
            ? { maxSetpoint: patch.guest_max_setpoint }
            : {}),
        });
        if (patch.guest_max_setpoint != null) {
          (patch as Record<string, unknown>).max_setpoint = patch.guest_max_setpoint;
        }
      }
    }

    // Override-ajastimen aloitus: jos uusi setpoint ylittää guest_maxin, aloita
    // viive heti jotta polleri laskee oikein. Jos taas asetus pudotetaan rajaan
    // tai alle, nollataan timerit.
    if (patch.current_setpoint != null && currentRow) {
      const effectiveGuestMax =
        patch.guest_max_setpoint != null
          ? Number(patch.guest_max_setpoint)
          : Number(currentRow.guest_max_setpoint);
      if (patch.current_setpoint > effectiveGuestMax) {
        (patch as Record<string, unknown>).override_started_at = new Date().toISOString();
      } else {
        (patch as Record<string, unknown>).override_started_at = null;
        if (patch.current_setpoint < effectiveGuestMax) {
          (patch as Record<string, unknown>).max_hold_started_at = null;
        }
      }
    }

    const { error } = await supabase.from("thermostats").update(patch).eq("id", id);
    if (error) throw new Error(error.message);

    await writeAudit(supabase, userId, (claims as { email?: string }).email ?? null, {
      action: "thermostat.update", entity_type: "thermostat", entity_id: id, details: patch,
    });
    return { ok: true };
  });


export const listSchedules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("schedules")
      .select("*, schedule_assignments(id,thermostat_id,apartment_id)")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional().nullable(),
      day_low: z.number().min(5).max(35),
      day_high: z.number().min(5).max(35),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const weekly = Array.from({ length: 7 }, (_, d) =>
      Array.from({ length: 24 }, (_, h) => ({
        day: d,
        hour: h,
        setpoint: h >= 22 || h < 6 ? data.day_low : data.day_high,
      })),
    ).flat();
    const row = {
      name: data.name,
      description: data.description ?? null,
      weekly_program: weekly,
    };
    if (data.id) {
      const { error } = await context.supabase.from("schedules").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase.from("schedules").insert(row).select().single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const deleteSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("schedules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getEnergyByApartment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data: apts } = await supabase.from("apartments").select("id,number,thermostats(id)");
    const { data: readings } = await supabase
      .from("thermostat_readings")
      .select("thermostat_id,energy_kwh,ts")
      .gte("ts", since);

    const byThermostat = new Map<string, number>();
    for (const r of readings ?? []) {
      byThermostat.set(r.thermostat_id, (byThermostat.get(r.thermostat_id) ?? 0) + Number(r.energy_kwh ?? 0));
    }

    const rows = (apts ?? []).map((a) => {
      const total = (a.thermostats as any[]).reduce(
        (s, t) => s + (byThermostat.get(t.id) ?? 0),
        0,
      );
      return { apartment: a.number, energy_kwh: Number(total.toFixed(1)) };
    });

    const byDay = new Map<string, number>();
    for (const r of readings ?? []) {
      const day = (r.ts as string).slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + Number(r.energy_kwh ?? 0));
    }
    const daily = [...byDay.entries()]
      .sort()
      .map(([day, kwh]) => ({ day, energy_kwh: Number(kwh.toFixed(1)) }));

    return { byApartment: rows.sort((a, b) => b.energy_kwh - a.energy_kwh), daily };
  });

// ---------- ZONES ----------

export const listZoneDefaults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: building }, { data: defaults }, { data: thermostats }] = await Promise.all([
      supabase.from("buildings").select("*").limit(1).maybeSingle(),
      supabase.from("zone_defaults").select("*").order("label"),
      supabase.from("thermostats").select("id,zone,locked"),
    ]);
    const counts: Record<string, number> = {};
    const lockedCounts: Record<string, number> = {};
    for (const t of thermostats ?? []) {
      counts[t.zone] = (counts[t.zone] ?? 0) + 1;
      if (t.locked) lockedCounts[t.zone] = (lockedCounts[t.zone] ?? 0) + 1;
    }
    return { building, defaults: defaults ?? [], counts, lockedCounts };
  });

export const saveZoneDefault = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      building_id: z.string().uuid(),
      zone: z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/),
      label: z.string().min(1).max(60),
      guest_max_setpoint: z.number().min(5).max(35),
      override_grace_minutes: z.number().int().min(0).max(120),
      default_setpoint: z.number().min(5).max(35),
      max_hold_minutes: z.number().int().min(0).max(1440),
      applyToAll: z.boolean().optional(),
      lockAll: z.boolean().optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { applyToAll, lockAll, ...row } = data;
    const { data: existing } = await supabase
      .from("zone_defaults").select("id")
      .eq("building_id", row.building_id).eq("zone", row.zone).maybeSingle();
    if (!existing) await requireAdmin(supabase, userId);
    const { error } = await supabase
      .from("zone_defaults").upsert(row, { onConflict: "building_id,zone" });
    if (error) throw new Error(error.message);
    if (applyToAll) {
      const { error: e2 } = await supabase.from("thermostats")
        .update({ guest_max_setpoint: row.guest_max_setpoint }).eq("zone", row.zone);
      if (e2) throw new Error(e2.message);
    }
    let lockPushed = 0;
    let lockFailed = 0;
    if (typeof lockAll === "boolean") {
      const { error: e3 } = await supabase.from("thermostats")
        .update({ locked: lockAll }).eq("zone", row.zone);
      if (e3) throw new Error(e3.message);

      // Pakota muutos myös Ebecon childLock-kenttään.
      const { data: zoneRows } = await supabase
        .from("thermostats")
        .select("id")
        .eq("zone", row.zone);
      const ids = (zoneRows ?? []).map((r: any) => r.id as string);
      if (ids.length > 0) {
        const pushRes = await pushPatchToTargets(supabase, ids, { childLock: lockAll });
        lockPushed = pushRes.succeeded;
        lockFailed = pushRes.failed;
      }
    }
    await writeAudit(supabase, userId, (claims as { email?: string }).email ?? null, {
      action: existing ? "zone.update" : "zone.create",
      entity_type: "zone", entity_id: row.zone,
      details: { ...row, applyToAll, lockAll, lockPushed, lockFailed },
    });
    return { ok: true, lockPushed, lockFailed };
  });


export const deleteZoneDefault = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await requireAdmin(supabase, userId);
    const { error } = await supabase.rpc("delete_zone_default", { _id: data.id });
    if (error) throw new Error(error.message);
    await writeAudit(supabase, userId, (claims as { email?: string }).email ?? null, {
      action: "zone.delete", entity_type: "zone", entity_id: data.id,
    });
    return { ok: true };
  });

// ---------- DEVICES (Ebeco sync + allocation) ----------

// Syncs the Ebeco account's device list into public.thermostats keyed by ebeco_device_id.
// Upserts new devices (apartment_id = null → allocate later from Laitteet view),
// refreshes status, current_setpoint, last_seen_at for known ones, and logs one
// reading per device into thermostat_readings.
export const syncEbecoDevices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;

    const devices = await fetchDevicesDetailed();

    const { data: existing } = await supabase
      .from("thermostats")
      .select("id,ebeco_device_id");
    const existingByEbecoId = new Map<string, string>(
      (existing ?? [])
        .filter((t) => t.ebeco_device_id)
        .map((t) => [String(t.ebeco_device_id), t.id]),
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

      // Build column patch from any Ebeco fields present on the device.
      const ebecoCols = ebecoPatchToColumns(d as unknown as EbecoPatch);

      if (existingId) {
        const patch: Record<string, unknown> = {
          status,
          ebeco_settings: d as unknown as Record<string, unknown>,
          ...ebecoCols,
        };
        // Only refresh last_seen_at when the device is actually reachable.
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
      const confirmedIds = new Set((confirmed ?? []).map((t) => t.id));
      const safeReadings = validReadings.filter((r) => confirmedIds.has(r.thermostat_id));
      if (safeReadings.length > 0) {
        const { error: readingsError } = await supabase
          .from("thermostat_readings")
          .insert(safeReadings);
        if (readingsError) {
          console.error("[syncEbecoDevices] readings insert failed:", readingsError.message);
        }
      }
    }

    await writeAudit(supabase, userId, (claims as { email?: string }).email ?? null, {
      action: "ebeco.sync",
      entity_type: "ebeco",
      entity_id: null,
      details: { total: devices.length, created, updated },
    });

    return { created, updated, total: devices.length };
  });


export const listDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: thermostats }, { data: apartments }, { data: building }] = await Promise.all([
      supabase
        .from("thermostats")
        .select(
          "id,name,ebeco_device_id,apartment_id,zone,status,last_seen_at,enabled,current_setpoint,display_when_idle,child_lock,sensor_application,selected_program,adaptive_start,open_window_detection,light_idle,light_active,language,apartments(id,number)",
        )
        .order("ebeco_device_id"),
      supabase.from("apartments").select("id,number").order("number"),
      supabase.from("buildings").select("id,name").limit(1).maybeSingle(),
    ]);
    return {
      thermostats: thermostats ?? [],
      apartments: apartments ?? [],
      building: building ?? null,
    };
  });


export const allocateThermostat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      apartment_id: z.string().uuid(),
      name: z.string().min(1).max(100),
      zone: z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await requireAdmin(supabase, userId);
    const { id, ...patch } = data;
    const { error } = await supabase.from("thermostats").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    await writeAudit(supabase, userId, (claims as { email?: string }).email ?? null, {
      action: "thermostat.allocate", entity_type: "thermostat", entity_id: id, details: patch,
    });
    return { ok: true };
  });

export const unallocateThermostat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await requireAdmin(supabase, userId);
    const { error } = await supabase.from("thermostats").update({ apartment_id: null }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(supabase, userId, (claims as { email?: string }).email ?? null, {
      action: "thermostat.unallocate", entity_type: "thermostat", entity_id: data.id,
    });
    return { ok: true };
  });

export const createApartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      number: z.string().min(1).max(20),
      floor: z.string().min(1).max(10),
      apartment_type: z.string().max(200).optional().nullable(),
      bedrooms: z.number().int().min(0).max(20).optional().nullable(),
      size_m2: z.number().min(0).max(10000).optional().nullable(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await requireAdmin(supabase, userId);
    const { data: bs } = await supabase.from("buildings").select("id").order("created_at").limit(1);
    const building_id = bs?.[0]?.id;
    if (!building_id) throw new Error("Rakennusta ei ole vielä luotu");
    const { data: created, error } = await supabase
      .from("apartments")
      .insert({ ...data, building_id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await writeAudit(supabase, userId, (claims as { email?: string }).email ?? null, {
      action: "apartment.create", entity_type: "apartment", entity_id: created.id, details: data,
    });
    return created;
  });

// ---------- Ebeco settings: single + broadcast ----------

const scopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("self") }),
  z.object({ kind: z.literal("all") }),
  z.object({ kind: z.literal("zone"), zone: z.string().min(1).max(40) }),
  z.object({ kind: z.literal("apartment"), apartment_id: z.string().uuid() }),
  z.object({ kind: z.literal("building"), building_id: z.string().uuid() }),
]);

async function pushPatchToTargets(
  supabase: any,
  targetIds: string[],
  patch: EbecoPatch,
): Promise<{ succeeded: number; failed: number; errors: string[] }> {
  if (targetIds.length === 0) return { succeeded: 0, failed: 0, errors: [] };

  const { data: rows, error } = await supabase
    .from("thermostats")
    .select("id,ebeco_device_id")
    .in("id", targetIds);
  if (error) throw new Error(error.message);

  const withEbeco = (rows ?? []).filter((r: any) => r.ebeco_device_id);
  const results = await Promise.allSettled(
    withEbeco.map((r: any) =>
      updateDevice({ id: Number(r.ebeco_device_id), ...patch }).then(
        () => ({ localId: r.id as string, ebecoId: Number(r.ebeco_device_id) }),
      ),
    ),
  );

  const succeeded: { localId: string; ebecoId: number }[] = [];
  const errors: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") succeeded.push(r.value);
    else errors.push(String((r.reason as Error)?.message ?? r.reason));
  }

  // Hae onnistuneille laitteille tuore tila Ebecosta yhdellä listakutsulla
  // ja tallenna täysi snapshot + kaikki mapatut sarakkeet paikallisesti.
  // Näin Tallenna/Jaa ei vaadi erillistä "Synkronoi Ebecosta" -painalkkaa.
  if (succeeded.length > 0) {
    try {
      const fresh = await fetchDevices();
      const byEbecoId = new Map(fresh.map((d) => [d.id, d]));
      const nowIso = new Date().toISOString();

      await Promise.all(
        succeeded.map(async ({ localId, ebecoId }) => {
          const detail = byEbecoId.get(ebecoId);
          if (!detail) return;
          const cols = ebecoPatchToColumns(detail as unknown as EbecoPatch);
          const status: "online" | "offline" = detail.online === false ? "offline" : "online";
          const setpoint =
            typeof detail.temperatureSet === "number" ? detail.temperatureSet : null;
          const rowPatch: Record<string, unknown> = {
            last_seen_at: nowIso,
            status,
            ebeco_settings: detail as unknown as Record<string, unknown>,
            ...cols,
          };
          if (setpoint != null) rowPatch.current_setpoint = setpoint;
          const { error: upErr } = await (supabase.from("thermostats") as any)
            .update(rowPatch)
            .eq("id", localId);
          if (upErr) errors.push(upErr.message);
        }),
      );
    } catch (err) {
      // Jos Ebecon lista ei tule, fallback: kirjoita ainakin pyydetty patch
      // paikallisiin sarakkeisiin, jotta UI ei jää epäsynkkaan.
      console.warn("[pushPatchToTargets] tuoreen tilan haku epäonnistui:", (err as Error).message);
      const colPatch = ebecoPatchToColumns(patch);
      if (Object.keys(colPatch).length > 0) {
        const { error: upErr } = await (supabase.from("thermostats") as any)
          .update(colPatch)
          .in("id", succeeded.map((s) => s.localId));
        if (upErr) errors.push(upErr.message);
      }
    }
  }

  return { succeeded: succeeded.length, failed: results.length - succeeded.length, errors };
}

export const updateThermostatSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      patch: ebecoPatchSchema,
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const result = await pushPatchToTargets(supabase, [data.id], data.patch as EbecoPatch);
    await writeAudit(supabase, userId, (claims as { email?: string }).email ?? null, {
      action: "thermostat.settings.update",
      entity_type: "thermostat",
      entity_id: data.id,
      details: { patch: data.patch, ...result },
    });
    if (result.failed > 0 && result.succeeded === 0) {
      throw new Error(result.errors[0] ?? "Ebeco-päivitys epäonnistui");
    }
    return result;
  });

export const broadcastThermostatSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      source_id: z.string().uuid(),
      patch: ebecoPatchSchema,
      scope: scopeSchema,
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;

    // Resolve scope → target thermostat ids.
    let query = supabase.from("thermostats").select("id,zone,apartment_id");
    const scope = data.scope;
    if (scope.kind === "self") {
      query = query.eq("id", data.source_id);
    } else if (scope.kind === "zone") {
      query = query.eq("zone", scope.zone);
    } else if (scope.kind === "apartment") {
      query = query.eq("apartment_id", scope.apartment_id);
    } else if (scope.kind === "building") {
      // building → all apartments in building → thermostats
      const { data: apts } = await supabase
        .from("apartments")
        .select("id")
        .eq("building_id", scope.building_id);
      const ids = (apts ?? []).map((a: any) => a.id);
      if (ids.length === 0) return { total: 0, succeeded: 0, failed: 0, errors: [] };
      query = query.in("apartment_id", ids);
    }
    // scope.kind === "all": no filter (every thermostat).

    const { data: targets, error } = await query;
    if (error) throw new Error(error.message);
    const ids = (targets ?? []).map((t: any) => t.id as string);

    const result = await pushPatchToTargets(supabase, ids, data.patch as EbecoPatch);

    await writeAudit(supabase, userId, (claims as { email?: string }).email ?? null, {
      action: "thermostat.settings.broadcast",
      entity_type: "thermostat",
      entity_id: data.source_id,
      details: { scope: data.scope, patch: data.patch, total: ids.length, ...result },
    });

    return { total: ids.length, ...result };
  });


// Sync a single thermostat's full settings from Ebeco into the local row.
export const syncEbecoDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;

    const { data: row, error: rowErr } = await supabase
      .from("thermostats")
      .select("id,ebeco_device_id")
      .eq("id", data.id)
      .single();
    if (rowErr) throw new Error(rowErr.message);
    if (!row?.ebeco_device_id) throw new Error("Termostaatilta puuttuu Ebeco-ID");

    const ebecoId = Number(row.ebeco_device_id);
    let detail = await fetchDeviceById(ebecoId);
    if (!detail) {
      // Varakeino: hae kaikkien laitteiden lista ja poimi sieltä
      try {
        const list = await fetchDevices();
        detail = list.find((d) => d.id === ebecoId) ?? null;
      } catch (err) {
        console.error("[syncEbecoDevice] fetchDevices fallback failed:", (err as Error).message);
      }
    }
    if (!detail) {
      return {
        ok: false as const,
        message:
          "Ebecosta ei löytynyt tietoja tälle laitteelle. Tarkista että laite on yhä Ebeco-tilillä.",
      };
    }

    const ebecoCols = ebecoPatchToColumns(detail as unknown as EbecoPatch);
    const nowIso = new Date().toISOString();
    const status: "online" | "offline" = detail.online === false ? "offline" : "online";
    const setpoint = typeof detail.temperatureSet === "number" ? detail.temperatureSet : null;

    const patch: Record<string, unknown> = {
      last_seen_at: nowIso,
      status,
      ebeco_settings: detail as unknown as Record<string, unknown>,
      ...ebecoCols,
    };
    if (setpoint != null) patch.current_setpoint = setpoint;

    const { error } = await (supabase.from("thermostats") as any)
      .update(patch)
      .eq("id", data.id);
    if (error) return { ok: false as const, message: error.message };

    await writeAudit(supabase, userId, (claims as { email?: string }).email ?? null, {
      action: "ebeco.sync.device",
      entity_type: "thermostat",
      entity_id: data.id,
      details: { ebeco_device_id: row.ebeco_device_id },
    });

    return { ok: true as const, message: "Asetukset päivitetty Ebecosta" };
  });
