// Ebeco reports both room and floor readings even when no floor sensor is wired.
// Use sensorApplication to decide which readings are meaningful.
export type SensorMode = {
  primary: "room" | "floor";
  hasFloor: boolean;
  label: string;
  roomLabel: string;
  floorLabel: string;
};

export function sensorMode(app: unknown): SensorMode {
  const a = String(app ?? "").toLowerCase();
  if (a === "room")
    return { primary: "room", hasFloor: false, label: "Huoneanturi", roomLabel: "huone", floorLabel: "ei lattia-anturia" };
  if (a === "floor")
    return { primary: "floor", hasFloor: true, label: "Lattia-anturi", roomLabel: "huone (sisäinen)", floorLabel: "lattia (ohjaava)" };
  if (a.startsWith("room") && a.includes("floor"))
    return { primary: "room", hasFloor: true, label: "Huone + rajoittava lattia", roomLabel: "huone (ohjaava)", floorLabel: "lattia (rajoittava)" };
  if (a.startsWith("floor") && a.includes("room"))
    return { primary: "floor", hasFloor: true, label: "Lattia + rajoittava huone", roomLabel: "huone (rajoittava)", floorLabel: "lattia (ohjaava)" };
  return { primary: "room", hasFloor: true, label: "", roomLabel: "huone", floorLabel: "lattia" };
}

export function readRoom(eb: Record<string, unknown> | null | undefined): number | null {
  const e = eb ?? {};
  if (typeof e.temperatureRoomDecimals === "number") return e.temperatureRoomDecimals;
  if (typeof e.temperatureRoom === "number") return e.temperatureRoom;
  return null;
}

export function readFloor(eb: Record<string, unknown> | null | undefined): number | null {
  const e = eb ?? {};
  if (!sensorMode(e.sensorApplication).hasFloor) return null;
  if (typeof e.temperatureFloorDecimals === "number") return e.temperatureFloorDecimals;
  if (typeof e.temperatureFloor === "number") return e.temperatureFloor;
  return null;
}
