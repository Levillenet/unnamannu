// Server-only Ebeco Connect Cloud API client.
// Auth: POST /api/TokenAuth with Abp.TenantId header → { result: { accessToken } }
// Devices: GET /api/services/app/Devices/GetUserDevices
// Update:  PUT /api/services/app/Devices/UpdateUserDevice  { id, ...patch }

const API_URL = "https://ebecoconnect.com/api";
const TOKEN_TTL_MS = 50 * 60 * 1000; // ~50 min

type CacheSlot = { token: string | null; expiresAt: number };
const g = globalThis as unknown as { __ebecoToken?: CacheSlot };
if (!g.__ebecoToken) g.__ebecoToken = { token: null, expiresAt: 0 };

export type EbecoDevice = {
  id: number;
  displayName?: string;
  temperatureSet?: number;
  temperatureRoom?: number;
  temperatureFloor?: number;
  temperatureRoomDecimals?: number;
  temperatureFloorDecimals?: number;
  powerOn?: boolean;
  online?: boolean;
  relayOn?: boolean;
  todaysOnMinutes?: number;
  installedEffect?: number;
  selectedProgram?: string;
  building?: { name?: string } | null;
  // sensor
  sensorApplication?: string;
  sensorType?: string;
  minFloorTemp?: number;
  maxFloorTemp?: number;
  floorTempCutOff?: number;
  temperatureCalibrationRoom?: number;
  temperatureCalibrationFloor?: number;
  // setpoint range
  minSetpoint?: number;
  maxSetpoint?: number;
  // display
  displayWhenIdle?: string;
  lightLedTextWhenIdle?: number;
  lightLedTextDuringOperation?: number;
  screenSaverEnabled?: boolean;
  language?: string;
  timeFormat?: string;
  dateFormat?: string;
  // lock
  childLock?: boolean;
  pinCodeEnabled?: boolean;
  installerLock?: boolean;
  // program
  awayTemperature?: number;
  vacationFrom?: string;
  vacationTo?: string;
  vacationTemperature?: number;
  // regulator
  adaptiveStart?: boolean;
  openWindowDetection?: boolean;
  openWindowSensitivity?: number;
  regulatorMode?: string;
  pwmPeriod?: number;
  [key: string]: unknown;
};

// Whitelist of fields we forward to Ebeco UpdateUserDevice.
export const EBECO_PATCH_FIELDS = [
  "displayName",
  "powerOn",
  "temperatureSet",
  "minSetpoint",
  "maxSetpoint",
  "sensorApplication",
  "sensorType",
  "minFloorTemp",
  "maxFloorTemp",
  "floorTempCutOff",
  "temperatureCalibrationRoom",
  "temperatureCalibrationFloor",
  "displayWhenIdle",
  "lightLedTextWhenIdle",
  "lightLedTextDuringOperation",
  "screenSaverEnabled",
  "language",
  "timeFormat",
  "dateFormat",
  "childLock",
  "pinCodeEnabled",
  "installerLock",
  "selectedProgram",
  "awayTemperature",
  "vacationFrom",
  "vacationTo",
  "vacationTemperature",
  "installedEffect",
  "adaptiveStart",
  "openWindowDetection",
  "openWindowSensitivity",
  "regulatorMode",
  "pwmPeriod",
] as const;

export type EbecoPatchField = (typeof EBECO_PATCH_FIELDS)[number];
export type EbecoPatch = Partial<Record<EbecoPatchField, unknown>>;

function getCreds(): { email: string; password: string } {
  const email = process.env.EBECO_EMAIL;
  const password = process.env.EBECO_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Ebeco-tunnukset puuttuvat. Lisää EBECO_EMAIL ja EBECO_PASSWORD backendin asetuksiin.",
    );
  }
  return { email, password };
}

async function authenticate(): Promise<string> {
  const { email, password } = getCreds();
  const res = await fetch(`${API_URL}/TokenAuth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Abp.TenantId": "1",
    },
    body: JSON.stringify({
      userNameOrEmailAddress: email,
      password,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ebeco-kirjautuminen epäonnistui (HTTP ${res.status}). ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { result?: { accessToken?: string } };
  const token = json?.result?.accessToken;
  if (!token) throw new Error("Ebeco ei palauttanut accessTokenia");
  g.__ebecoToken = { token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return token;
}

async function getToken(forceRefresh = false): Promise<string> {
  const slot = g.__ebecoToken!;
  if (!forceRefresh && slot.token && slot.expiresAt > Date.now()) return slot.token;
  return authenticate();
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (res.status === 401 && retry) {
    g.__ebecoToken = { token: null, expiresAt: 0 };
    return request<T>(path, init, false);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ebeco API virhe ${res.status} ${path}: ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function fetchDevices(): Promise<EbecoDevice[]> {
  const json = await request<{ result?: EbecoDevice[] }>(
    "/services/app/Devices/GetUserDevices",
    { method: "GET" },
  );
  return json.result ?? [];
}

export async function updateDevice(input: { id: number } & EbecoPatch): Promise<void> {
  // Forward only allowed fields.
  const body: Record<string, unknown> = { id: input.id };
  for (const k of EBECO_PATCH_FIELDS) {
    if (k in input && (input as Record<string, unknown>)[k] !== undefined) {
      body[k] = (input as Record<string, unknown>)[k];
    }
  }
  await request<unknown>("/services/app/Devices/UpdateUserDevice", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// Convenience: normalize device into fields we store
export function pickRoomTemp(d: EbecoDevice): number | null {
  if (typeof d.temperatureRoomDecimals === "number") return d.temperatureRoomDecimals;
  if (typeof d.temperatureRoom === "number") return d.temperatureRoom;
  return null;
}
export function pickFloorTemp(d: EbecoDevice): number | null {
  if (typeof d.temperatureFloorDecimals === "number") return d.temperatureFloorDecimals;
  if (typeof d.temperatureFloor === "number") return d.temperatureFloor;
  return null;
}

// Mapping between Ebeco patch field names and our local thermostats columns.
// Used so a single broadcast/update reflects in both the API call and the DB row.
export const EBECO_TO_COLUMN: Partial<Record<EbecoPatchField, string>> = {
  temperatureSet: "current_setpoint",
  powerOn: "enabled",
  displayName: "name",
  sensorApplication: "sensor_application",
  sensorType: "sensor_type",
  displayWhenIdle: "display_when_idle",
  lightLedTextWhenIdle: "light_idle",
  lightLedTextDuringOperation: "light_active",
  childLock: "child_lock",
  selectedProgram: "selected_program",
  installedEffect: "installed_effect_w",
  adaptiveStart: "adaptive_start",
  openWindowDetection: "open_window_detection",
  temperatureCalibrationRoom: "temperature_calibration_room",
  temperatureCalibrationFloor: "temperature_calibration_floor",
  minFloorTemp: "min_floor_temp",
  maxFloorTemp: "max_floor_temp",
  floorTempCutOff: "floor_temp_cut_off",
  language: "language",
};

export function ebecoPatchToColumns(patch: EbecoPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(EBECO_TO_COLUMN) as [EbecoPatchField, string][]) {
    if (k in patch && patch[k] !== undefined) row[col] = patch[k];
  }
  return row;
}
