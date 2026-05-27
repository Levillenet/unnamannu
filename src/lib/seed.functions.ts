import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ROOM_ZONES = [
  { room: "Makuuhuone", zone: "room" as const },
  { room: "Olohuone", zone: "room" as const },
  { room: "Eteinen", zone: "room" as const },
  { room: "Kylpyhuone", zone: "bathroom" as const },
  { room: "WC", zone: "bathroom" as const },
];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export const seedDemoData = createServerFn({ method: "POST" }).handler(async () => {
  await supabaseAdmin.from("schedule_assignments").delete().gte("created_at", "1900-01-01");
  await supabaseAdmin.from("thermostat_readings").delete().gte("ts", "1900-01-01");
  await supabaseAdmin.from("thermostats").delete().gte("created_at", "1900-01-01");
  await supabaseAdmin.from("apartments").delete().gte("created_at", "1900-01-01");
  await supabaseAdmin.from("zone_defaults").delete().gte("created_at", "1900-01-01");
  await supabaseAdmin.from("schedules").delete().gte("created_at", "1900-01-01");
  await supabaseAdmin.from("buildings").delete().gte("created_at", "1900-01-01");

  const { data: building, error: be } = await supabaseAdmin
    .from("buildings")
    .insert({ name: "Unna&Mannu", address: "Levi" })
    .select()
    .single();
  if (be) throw new Error(be.message);

  // Zone defaults
  await supabaseAdmin.from("zone_defaults").insert([
    { building_id: building.id, zone: "room", label: "Huone", guest_max_setpoint: 23.0, override_grace_minutes: 2 },
    { building_id: building.id, zone: "bathroom", label: "Kylpyhuone", guest_max_setpoint: 25.0, override_grace_minutes: 2 },
  ]);

  // Schedules
  const mkProgram = (low: number, high: number) =>
    Array.from({ length: 7 }, (_, d) =>
      Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        setpoint: h >= 22 || h < 6 ? low : high,
        day: d,
      })),
    ).flat();

  const { data: schedules, error: se } = await supabaseAdmin
    .from("schedules")
    .insert([
      { name: "Yöalennus", description: "21°C päivällä, 18°C öisin", weekly_program: mkProgram(18, 21) },
      { name: "Poissa", description: "16°C jatkuvasti", weekly_program: mkProgram(16, 16) },
      { name: "Mukavuus", description: "22°C päivällä, 19°C öisin", weekly_program: mkProgram(19, 22) },
    ])
    .select();
  if (se) throw new Error(se.message);

  // Real apartments (Unna & Mannu)
  const REAL_APARTMENTS: { number: string; floor: string; apartment_type: string; bedrooms: number; size_m2: number }[] = [
    { number: "A1",  floor: "2",   apartment_type: "2mh+oh/k+saunaos.", bedrooms: 2, size_m2: 59.5 },
    { number: "A2",  floor: "2",   apartment_type: "2mh+oh/k+saunaos.", bedrooms: 2, size_m2: 69 },
    { number: "A3",  floor: "2",   apartment_type: "2mh+oh/k+saunaos.", bedrooms: 2, size_m2: 56 },
    { number: "A4",  floor: "2",   apartment_type: "2mh+oh/k+saunaos.", bedrooms: 2, size_m2: 71.5 },
    { number: "A5",  floor: "2",   apartment_type: "2mh+oh/k+saunaos.", bedrooms: 2, size_m2: 70 },
    { number: "A6",  floor: "2",   apartment_type: "2mh+oh/k+saunaos.", bedrooms: 2, size_m2: 69 },
    { number: "A7",  floor: "2",   apartment_type: "2mh+oh/k+saunaos.", bedrooms: 2, size_m2: 54.5 },
    { number: "A8",  floor: "3",   apartment_type: "2mh+oh/k+saunaos.", bedrooms: 2, size_m2: 59.5 },
    { number: "A9",  floor: "3",   apartment_type: "2mh+oh/k+saunaos.", bedrooms: 2, size_m2: 69 },
    { number: "A10", floor: "3",   apartment_type: "1mh+oh/k+saunaos.", bedrooms: 1, size_m2: 42 },
    { number: "A11", floor: "3",   apartment_type: "studio+saunaos.",   bedrooms: 0, size_m2: 32 },
    { number: "A12", floor: "3",   apartment_type: "2mh+oh/k+saunaos.", bedrooms: 2, size_m2: 69 },
    { number: "A13", floor: "3",   apartment_type: "2mh+oh/k+saunaos.", bedrooms: 2, size_m2: 55 },
    { number: "A14", floor: "4",   apartment_type: "2mh+oh/k+saunaos.", bedrooms: 2, size_m2: 71.5 },
    { number: "A15", floor: "4",   apartment_type: "2mh+oh/k+saunaos.", bedrooms: 2, size_m2: 70 },
    { number: "B1",  floor: "2-3", apartment_type: "3mh+oh/k+saunaos.", bedrooms: 3, size_m2: 103 },
    { number: "B2",  floor: "2-3", apartment_type: "4mh+oh/k+saunaos.", bedrooms: 4, size_m2: 112 },
    { number: "B3",  floor: "2-3", apartment_type: "3mh+oh/k+saunaos.", bedrooms: 3, size_m2: 103 },
    { number: "C1",  floor: "2-3", apartment_type: "4mh+oh/k+saunaos.+kylpyh.", bedrooms: 4, size_m2: 107.5 },
    { number: "C2",  floor: "2",   apartment_type: "1mh+oh/k+saunaos.", bedrooms: 1, size_m2: 54 },
    { number: "C3",  floor: "2-3", apartment_type: "3mh+oh/k+takkah.+saunaos.+2kylpyh.", bedrooms: 3, size_m2: 118 },
    { number: "C4",  floor: "2-3", apartment_type: "3mh+oh/k+takkah.+saunaos.+2kylpyh.", bedrooms: 3, size_m2: 117.5 },
    { number: "C5",  floor: "2",   apartment_type: "1mh+oh/k+saunaos.", bedrooms: 1, size_m2: 54 },
    { number: "C6",  floor: "2-3", apartment_type: "3mh+oh/k+saunaos.", bedrooms: 3, size_m2: 100.5 },
  ];
  const apartmentRows = REAL_APARTMENTS.map((a) => ({ building_id: building.id, ...a }));
  const { data: apartments, error: ae } = await supabaseAdmin
    .from("apartments")
    .insert(apartmentRows)
    .select();
  if (ae) throw new Error(ae.message);

  // Thermostats: one per bedroom + Olohuone, Eteinen, Kylpyhuone (+ extra bath for big units)
  const thermostatRows: any[] = [];
  for (const apt of apartments!) {
    const bedrooms = Number((apt as any).bedrooms ?? 1);
    const sizeM2 = Number((apt as any).size_m2 ?? 0);
    const layout: { room: string; zone: "room" | "bathroom" }[] = [];
    for (let b = 0; b < Math.max(1, bedrooms); b++) {
      layout.push({ room: bedrooms > 1 ? `Makuuhuone ${b + 1}` : "Makuuhuone", zone: "room" });
    }
    layout.push({ room: "Olohuone", zone: "room" });
    layout.push({ room: "Eteinen", zone: "room" });
    layout.push({ room: "Kylpyhuone", zone: "bathroom" });
    if (sizeM2 >= 100) layout.push({ room: "Kylpyhuone 2", zone: "bathroom" });
    if (Math.random() < 0.35) layout.push({ room: "WC", zone: "bathroom" });
    for (let i = 0; i < layout.length; i++) {
      const rz = layout[i];
      const offline = Math.random() < 0.04;
      const alarm = !offline && Math.random() < 0.02;
      const guestMax = rz.zone === "bathroom" ? 25.0 : 23.0;
      const setpoint = Math.min(guestMax, Number(rand(19, 22).toFixed(1)));
      thermostatRows.push({
        apartment_id: apt.id,
        ebeco_device_id: `EBT500-${apt.number}-${i + 1}`,
        name: `${rz.room} – ${apt.number}`,
        room: rz.room,
        zone: rz.zone,
        guest_max_setpoint: guestMax,
        status: offline ? "offline" : alarm ? "alarm" : "online",
        enabled: !offline,
        locked: false,
        current_setpoint: setpoint,
        current_schedule_id: Math.random() < 0.5 ? schedules![Math.floor(Math.random() * schedules!.length)].id : null,
        last_seen_at: offline
          ? new Date(Date.now() - rand(1, 48) * 3600 * 1000).toISOString()
          : new Date().toISOString(),
      });
    }
  }
  const { data: thermostats, error: te } = await supabaseAdmin
    .from("thermostats")
    .insert(thermostatRows)
    .select();
  if (te) throw new Error(te.message);

  // 7 days hourly readings
  const now = Date.now();
  const readings: any[] = [];
  for (const t of thermostats!) {
    for (let h = 0; h < 24 * 7; h++) {
      const ts = new Date(now - h * 3600 * 1000);
      const hr = ts.getHours();
      const nightDip = hr >= 22 || hr < 6 ? -2 : 0;
      const setpoint = Number(t.current_setpoint) + nightDip;
      const roomTemp = setpoint + rand(-0.8, 0.6);
      const floorTemp = roomTemp + rand(2, 5);
      const power = t.status === "offline" ? 0 : Math.max(0, rand(0, 1200) * (setpoint - roomTemp > -0.3 ? 1 : 0.2));
      readings.push({
        thermostat_id: t.id,
        ts: ts.toISOString(),
        room_temp: Number(roomTemp.toFixed(2)),
        floor_temp: Number(floorTemp.toFixed(2)),
        setpoint: Number(setpoint.toFixed(1)),
        power_w: Number(power.toFixed(0)),
        energy_kwh: Number((power / 1000).toFixed(3)),
      });
    }
  }
  // Add a few guest_max_enforced events in last 24h
  for (let i = 0; i < 12; i++) {
    const t = thermostats![Math.floor(Math.random() * thermostats!.length)];
    readings.push({
      thermostat_id: t.id,
      ts: new Date(now - Math.random() * 24 * 3600 * 1000).toISOString(),
      setpoint: Number(t.guest_max_setpoint),
      power_w: null,
      energy_kwh: null,
      event: "guest_max_enforced",
    });
  }

  const chunkSize = 1000;
  for (let i = 0; i < readings.length; i += chunkSize) {
    const { error: re } = await supabaseAdmin
      .from("thermostat_readings")
      .insert(readings.slice(i, i + chunkSize));
    if (re) throw new Error(re.message);
  }

  return {
    apartments: apartments!.length,
    thermostats: thermostats!.length,
    readings: readings.length,
    schedules: schedules!.length,
  };
});
