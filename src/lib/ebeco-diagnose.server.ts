// Diagnostiikka: etsii Ebecon todellisen lapsilukko-rajapinnan kokeilemalla
// useita endpointti-/payload-yhdistelmiä ja varmistamalla jokaisen jälkeen
// muuttuiko childLock GetUserDevices-listauksessa.

import { fetchDeviceById, fetchDevices, type EbecoDevice } from "./ebeco.server";

const API_URL = "https://ebecoconnect.com/api";
const TOKEN_TTL_MS = 50 * 60 * 1000;

type Slot = { token: string | null; expiresAt: number };
const g = globalThis as unknown as { __ebecoToken?: Slot };
if (!g.__ebecoToken) g.__ebecoToken = { token: null, expiresAt: 0 };

async function authToken(): Promise<string> {
  const slot = g.__ebecoToken!;
  if (slot.token && slot.expiresAt > Date.now()) return slot.token;
  const email = process.env.EBECO_EMAIL;
  const password = process.env.EBECO_PASSWORD;
  if (!email || !password) throw new Error("EBECO_EMAIL / EBECO_PASSWORD puuttuu");
  const res = await fetch(`${API_URL}/TokenAuth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Abp.TenantId": "1" },
    body: JSON.stringify({ userNameOrEmailAddress: email, password }),
  });
  if (!res.ok) throw new Error(`Login epäonnistui ${res.status}`);
  const j = (await res.json()) as { result?: { accessToken?: string } };
  const tok = j?.result?.accessToken;
  if (!tok) throw new Error("Ei accessTokenia");
  g.__ebecoToken = { token: tok, expiresAt: Date.now() + TOKEN_TTL_MS };
  return tok;
}

type AttemptResult = {
  label: string;
  method: string;
  path: string;
  payloadPreview: string;
  status: number;
  bodyPreview: string;
  childLockBefore: unknown;
  childLockAfter: unknown;
  keyLockAfter: unknown;
  changed: boolean;
  error?: string;
};

function pickLockFields(d: EbecoDevice | null | undefined) {
  if (!d) return { all: {}, childLock: undefined, keyLock: undefined };
  const all: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    const lk = k.toLowerCase();
    if (lk.includes("lock") || lk.includes("pin") || lk.includes("child")) {
      all[k] = v;
    }
  }
  return {
    all,
    childLock: (d as any).childLock,
    keyLock: (d as any).keyLock,
  };
}

async function readChildLockNow(id: number): Promise<{ childLock: unknown; keyLock: unknown }> {
  try {
    const list = await fetchDevices();
    const d = list.find((x) => x.id === id);
    return { childLock: (d as any)?.childLock, keyLock: (d as any)?.keyLock };
  } catch {
    return { childLock: undefined, keyLock: undefined };
  }
}

async function attempt(
  label: string,
  method: "PUT" | "POST",
  path: string,
  body: unknown,
  id: number,
  before: unknown,
): Promise<AttemptResult> {
  const token = await authToken();
  const bodyStr = JSON.stringify(body);
  let status = 0;
  let bodyPreview = "";
  let error: string | undefined;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: bodyStr,
    });
    status = res.status;
    const t = await res.text().catch(() => "");
    bodyPreview = t.slice(0, 400);
  } catch (e) {
    error = (e as Error).message;
  }
  // Pieni viive jotta Ebeco ehtii rekisteröidä muutoksen
  await new Promise((r) => setTimeout(r, 800));
  const after = await readChildLockNow(id);
  const changed = String(after.childLock) === String(before) ? false : after.childLock !== undefined;
  console.log(
    `[ebeco-diag] ${label} ${method} ${path} status=${status} before=${String(before)} after=childLock:${String(after.childLock)} keyLock:${String(after.keyLock)} body=${bodyPreview.slice(0, 200)}`,
  );
  return {
    label,
    method,
    path,
    payloadPreview: bodyStr.slice(0, 300),
    status,
    bodyPreview,
    childLockBefore: before,
    childLockAfter: after.childLock,
    keyLockAfter: after.keyLock,
    changed,
    error,
  };
}

export async function runChildLockDiagnostics(id: number, enable: boolean) {
  const before = await fetchDeviceById(id);
  if (!before) throw new Error(`Termostaattia ${id} ei löydy Ebecosta`);
  const lockFields = pickLockFields(before);
  const beforeValue = (before as any).childLock;

  console.log(
    `[ebeco-diag] aloitus id=${id} enable=${enable} childLockBefore=${String(beforeValue)} lockFields=${JSON.stringify(lockFields.all)}`,
  );

  // Pohja-DTO koko nykyisellä sisällöllä — käytetään PUT-yrityksissä
  const baseDto: Record<string, unknown> = { ...(before as unknown as Record<string, unknown>), id };

  const results: AttemptResult[] = [];

  const tries: Array<{
    label: string;
    method: "PUT" | "POST";
    path: string;
    body: unknown;
  }> = [
    {
      label: "UpdateUserDevice + childLock",
      method: "PUT",
      path: "/services/app/Devices/UpdateUserDevice",
      body: { ...baseDto, childLock: enable },
    },
    {
      label: "UpdateUserDevice + keyLock",
      method: "PUT",
      path: "/services/app/Devices/UpdateUserDevice",
      body: { ...baseDto, keyLock: enable },
    },
    {
      label: "UpdateUserDevice + childLock + pinCodeEnabled",
      method: "PUT",
      path: "/services/app/Devices/UpdateUserDevice",
      body: { ...baseDto, childLock: enable, pinCodeEnabled: enable },
    },
    {
      label: "SetChildLock (POST {id,value})",
      method: "POST",
      path: "/services/app/Devices/SetChildLock",
      body: { id, value: enable },
    },
    {
      label: "SetDeviceChildLock",
      method: "POST",
      path: "/services/app/Devices/SetDeviceChildLock",
      body: { id, childLock: enable },
    },
    {
      label: "UpdateDeviceSettings",
      method: "POST",
      path: "/services/app/Devices/UpdateDeviceSettings",
      body: { id, childLock: enable },
    },
    {
      label: "UpdateUserDeviceSettings (PUT full DTO)",
      method: "PUT",
      path: "/services/app/Devices/UpdateUserDeviceSettings",
      body: { ...baseDto, childLock: enable },
    },
    {
      label: "UserDevices/SetChildLock",
      method: "POST",
      path: "/services/app/UserDevices/SetChildLock",
      body: { id, value: enable },
    },
    {
      label: "Devices/UpdateUserDevice (childLock + lockedToTemp)",
      method: "PUT",
      path: "/services/app/Devices/UpdateUserDevice",
      body: { ...baseDto, childLock: enable, lockedToTemp: enable },
    },
  ];

  for (const t of tries) {
    // luetaan tuore "before" jokaisen ennen kierrosta, jotta voimme tunnistaa
    // tarkalleen mikä yritys muutti tilan
    const fresh = await readChildLockNow(id);
    const r = await attempt(t.label, t.method, t.path, t.body, id, fresh.childLock);
    results.push(r);
  }

  // Jos jokin onnistui asetukseen `enable`, palauta nykyhetki
  const success = results.find(
    (r) => r.childLockAfter === enable || r.keyLockAfter === enable,
  );

  return {
    id,
    enable,
    childLockBefore: JSON.stringify(beforeValue ?? null),
    lockFieldsSeen: JSON.stringify(lockFields.all),
    fieldsKeyCount: Object.keys(before as object).length,
    success: success
      ? { label: success.label, method: success.method, path: success.path }
      : null,
    attempts: results.map((r) => ({
      ...r,
      childLockBefore: JSON.stringify(r.childLockBefore ?? null),
      childLockAfter: JSON.stringify(r.childLockAfter ?? null),
      keyLockAfter: JSON.stringify(r.keyLockAfter ?? null),
    })),
  };
}
