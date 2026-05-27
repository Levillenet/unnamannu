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
    { building_id: building.id, zone: "room", guest_max_setpoint: 23.0, default_setpoint: 21.0 },
    { building_id: building.id, zone: "bathroom", guest_max_setpoint: 25.0, default_setpoint: 22.0 },
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

  // 26 hotel rooms
  const apartmentRows = Array.from({ length: 26 }, (_, i) => ({
    building_id: building.id,
    number: `${Math.floor(i / 10) + 1}${String(i % 10).padStart(2, "0")}`,
    floor: Math.floor(i / 10) + 1,
    size_m2: Math.round(rand(22, 38)),
  }));
  const { data: apartments, error: ae } = await supabaseAdmin
    .from("apartments")
    .insert(apartmentRows)
    .select();
  if (ae) throw new Error(ae.message);

  // Thermostats: every room has Makuuhuone, Olohuone, Eteinen, Kylpyhuone + occasional WC
  const thermostatRows: any[] = [];
  for (const apt of apartments!) {
    const layout = [
      ROOM_ZONES[0], // Makuuhuone
      ROOM_ZONES[1], // Olohuone
      ROOM_ZONES[2], // Eteinen
      ROOM_ZONES[3], // Kylpyhuone
      ...(Math.random() < 0.35 ? [ROOM_ZONES[4]] : []), // WC
    ];
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
