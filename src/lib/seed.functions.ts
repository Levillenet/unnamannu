import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ROOMS = ["Olohuone", "Keittiö", "Kylpyhuone", "Makuuhuone", "Eteinen"];
const FIRST_NAMES = ["Anna", "Jukka", "Maija", "Pekka", "Liisa", "Matti", "Sari", "Timo", "Hanna", "Mikko"];
const LAST_NAMES = ["Virtanen", "Korhonen", "Nieminen", "Mäkinen", "Hämäläinen", "Laine", "Heikkinen", "Koskinen"];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const seedDemoData = createServerFn({ method: "POST" }).handler(async () => {
  // Idempotent: clear and recreate
  await supabaseAdmin.from("schedule_assignments").delete().gte("created_at", "1900-01-01");
  await supabaseAdmin.from("thermostat_readings").delete().gte("ts", "1900-01-01");
  await supabaseAdmin.from("thermostats").delete().gte("created_at", "1900-01-01");
  await supabaseAdmin.from("apartments").delete().gte("created_at", "1900-01-01");
  await supabaseAdmin.from("schedules").delete().gte("created_at", "1900-01-01");
  await supabaseAdmin.from("buildings").delete().gte("created_at", "1900-01-01");

  // Building
  const { data: building, error: be } = await supabaseAdmin
    .from("buildings")
    .insert({ name: "Kerrostalo Mäntytie 12", address: "Mäntytie 12, 00100 Helsinki" })
    .select()
    .single();
  if (be) throw new Error(be.message);

  // Schedules
  const weekProgram = (day: number, low: number, high: number) =>
    Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      setpoint: h >= 22 || h < 6 ? low : high,
      day,
    }));
  const nightSavingProgram = Array.from({ length: 7 }, (_, d) => weekProgram(d, 18, 21)).flat();
  const holidayProgram = Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => ({ hour: h, setpoint: 15, day: d })),
  ).flat();
  const comfortProgram = Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => ({ hour: h, setpoint: h >= 23 || h < 6 ? 19 : 22, day: d })),
  ).flat();

  const { data: schedules, error: se } = await supabaseAdmin
    .from("schedules")
    .insert([
      { name: "Yöalennus", description: "21°C päivällä, 18°C öisin (22–06)", weekly_program: nightSavingProgram },
      { name: "Lomatila", description: "15°C jatkuvasti", weekly_program: holidayProgram },
      { name: "Mukavuus", description: "22°C päivällä, 19°C öisin (23–06)", weekly_program: comfortProgram },
    ])
    .select();
  if (se) throw new Error(se.message);

  // 26 apartments, 2-4 thermostats each
  const apartmentRows = Array.from({ length: 26 }, (_, i) => ({
    building_id: building.id,
    number: `${Math.floor(i / 4) + 1}${String.fromCharCode(65 + (i % 4))}`,
    floor: Math.floor(i / 4) + 1,
    resident_name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    size_m2: Math.round(rand(45, 95)),
  }));
  const { data: apartments, error: ae } = await supabaseAdmin
    .from("apartments")
    .insert(apartmentRows)
    .select();
  if (ae) throw new Error(ae.message);

  // Thermostats
  const thermostatRows: any[] = [];
  for (const apt of apartments!) {
    const count = 2 + Math.floor(Math.random() * 3); // 2-4
    const usedRooms = new Set<string>();
    for (let i = 0; i < count; i++) {
      let room = pick(ROOMS);
      while (usedRooms.has(room)) room = pick(ROOMS);
      usedRooms.add(room);
      const offline = Math.random() < 0.05;
      const alarm = !offline && Math.random() < 0.03;
      thermostatRows.push({
        apartment_id: apt.id,
        ebeco_device_id: `EBT500-${apt.number}-${i + 1}`,
        name: `${room} – ${apt.number}`,
        room,
        status: offline ? "offline" : alarm ? "alarm" : "online",
        enabled: !offline,
        locked: false,
        current_setpoint: Number(rand(19, 23).toFixed(1)),
        current_schedule_id: Math.random() < 0.6 ? pick(schedules!).id : null,
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

  // Readings: hourly for last 7 days for each thermostat
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
  // Bulk insert in chunks
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
