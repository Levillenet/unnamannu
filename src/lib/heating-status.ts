// Mittausaineiston luotettava alkupiste: 15 min taustasynkronointi korjautui
// 15.10.2026 klo 21.00 UTC. Tätä aiempi data on puutteellista eikä sitä
// käytetä lämmitysasteen laskentaan. Kun puhdasta dataa on kertynyt yli 24 h,
// laskenta siirtyy automaattisesti normaaliin liukuvaan 24 h ikkunaan.
export const DATA_VALID_FROM = "2026-10-15T21:00:00Z";
export const DATA_VALID_FROM_MS = Date.parse(DATA_VALID_FROM);

export type HeatStatus = "problem" | "heavy" | "ok" | "nodata";
export function heatStatus(r: { enabled: boolean; status: string; duty24h: number | null; duty4h: number | null; diff: number | null }): HeatStatus {
  if (!r.enabled || r.status !== "online" || r.duty24h == null) return "nodata";
  const duty = Math.max(r.duty24h, r.duty4h ?? 0);
  if (duty >= 90 && r.diff != null && r.diff < -1) return "problem";
  if (duty >= 70) return "heavy";
  return "ok";
}
export const STATUS_ORDER: Record<HeatStatus, number> = { problem: 0, heavy: 1, ok: 2, nodata: 3 };
