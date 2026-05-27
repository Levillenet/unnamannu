import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getBuildingOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: building }, { data: apartments }, { data: thermostats }] = await Promise.all([
      supabase.from("buildings").select("*").limit(1).maybeSingle(),
      supabase.from("apartments").select("id"),
      supabase.from("thermostats").select("id,status,current_setpoint"),
    ]);

    // 24h energy
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: readings24h } = await supabase
      .from("thermostat_readings")
      .select("energy_kwh,room_temp")
      .gte("ts", since);

    const energy24h = (readings24h ?? []).reduce((s, r) => s + Number(r.energy_kwh ?? 0), 0);
    const avgRoom =
      (readings24h ?? []).length > 0
        ? (readings24h!.reduce((s, r) => s + Number(r.room_temp ?? 0), 0)) / readings24h!.length
        : null;

    return {
      building,
      apartmentCount: apartments?.length ?? 0,
      thermostatCount: thermostats?.length ?? 0,
      online: (thermostats ?? []).filter((t) => t.status === "online").length,
      offline: (thermostats ?? []).filter((t) => t.status === "offline").length,
      alarms: (thermostats ?? []).filter((t) => t.status === "alarm").length,
      energy24h,
      avgRoomTemp: avgRoom,
    };
  });

export const listApartments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: apartments, error } = await supabase
      .from("apartments")
      .select("*, thermostats(id,status,current_setpoint,last_seen_at)")
      .order("number");
    if (error) throw new Error(error.message);
    return apartments ?? [];
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
      .select("*, apartments(id,number,resident_name), schedules:current_schedule_id(id,name)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: readings } = await supabase
      .from("thermostat_readings")
      .select("ts,room_temp,floor_temp,setpoint,power_w,energy_kwh")
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
      enabled: z.boolean().optional(),
      locked: z.boolean().optional(),
      current_schedule_id: z.string().uuid().nullable().optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...patch } = data;
    const { error } = await supabase.from("thermostats").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
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

    // Daily series total
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
