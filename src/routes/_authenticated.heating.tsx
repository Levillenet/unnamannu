import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getHeatingDuty, listZoneDefaults } from "@/lib/data.functions";
import { heatStatus, STATUS_ORDER, DATA_VALID_FROM_MS, type HeatStatus } from "@/lib/heating-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const heatingQO = queryOptions({ queryKey: ["heating-duty"], queryFn: () => getHeatingDuty(), refetchInterval: 300_000 });
const zonesQO = queryOptions({ queryKey: ["zone-defaults"], queryFn: () => listZoneDefaults() });

export const Route = createFileRoute("/_authenticated/heating")({
  head: () => ({
    meta: [
      { title: "Lämmitysaste – Unna&Mannu" },
      { name: "description", content: "Termostaattien lämmitysaste ja tavoitelämpötilan saavuttaminen." },
      { property: "og:title", content: "Lämmitysaste – Unna&Mannu" },
      { property: "og:description", content: "Termostaattien lämmitysaste ja tavoitelämpötilan saavuttaminen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(heatingQO);
    context.queryClient.ensureQueryData(zonesQO);
  },
  component: HeatingPage,
});

const STATUS_UI: Record<HeatStatus, { label: string; cls: string }> = {
  problem: { label: "Ei saavuta tavoitetta", cls: "bg-destructive/15 text-destructive border-destructive/40" },
  heavy: { label: "Lämmittää paljon", cls: "bg-warning/15 text-warning border-warning/40" },
  ok: { label: "OK", cls: "bg-success/15 text-success border-success/40" },
  nodata: { label: "Ei dataa / pois", cls: "" },
};

function DutyBar({ v }: { v: number | null }) {
  if (v == null) return <span className="text-xs text-muted-foreground">—</span>;
  const tone = v >= 90 ? "bg-destructive" : v >= 70 ? "bg-warning" : "bg-primary";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded bg-muted">
        <div className={`h-full ${tone}`} style={{ width: `${v}%` }} />
      </div>
      <span className="w-10 text-right text-xs tabular-nums">{v} %</span>
    </div>
  );
}

function HeatingPage() {
  const { data } = useSuspenseQuery(heatingQO);
  const { data: zd } = useSuspenseQuery(zonesQO);
  const zones = (zd.defaults as any[]).map((z) => ({ zone: z.zone, label: z.label }));
  const zoneLabel = (z: string) => zones.find((o) => o.zone === z)?.label ?? (z === "none" ? "Ei vyöhykettä" : z);
  const [zone, setZone] = useState("all");

  const rows = data.rows
    .map((r) => ({ ...r, st: heatStatus(r) }))
    .filter((r) => zone === "all" || r.zone === zone)
    .sort((a, b) => STATUS_ORDER[a.st] - STATUS_ORDER[b.st] || (b.duty24h ?? -1) - (a.duty24h ?? -1));
  const counts = rows.reduce((m, r) => ({ ...m, [r.st]: (m[r.st] ?? 0) + 1 }), {} as Record<string, number>);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lämmitysaste</h1>
          <p className="text-sm text-muted-foreground">
            Kuinka suuren osan ajasta termostaatti lämmittää, ja saavuttaako se asetetun lämpötilan.
          </p>
          {Date.now() - DATA_VALID_FROM_MS < 24 * 3600_000 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Aineisto kertyy 15.10. klo 21 alkaen — prosentit tarkentuvat, kun dataa on kertynyt täysi vuorokausi.
            </p>
          )}
        </div>
        <Select value={zone} onValueChange={setZone}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Kaikki vyöhykkeet</SelectItem>
            {zones.map((z) => <SelectItem key={z.zone} value={z.zone}>{z.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["problem", "heavy", "ok", "nodata"] as HeatStatus[]).map((s) => (
          <Badge key={s} variant="outline" className={STATUS_UI[s].cls}>
            {STATUS_UI[s].label}: {counts[s] ?? 0}
          </Badge>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Termostaatit (ongelmallisimmat ensin)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Termostaatti</th>
                <th className="py-2 pr-3">Vyöhyke</th>
                <th className="py-2 pr-3">Lämmitys 4 h</th>
                <th className="py-2 pr-3">Lämmitys 24 h</th>
                <th className="py-2 pr-3">Mitattu / asetus</th>
                <th className="py-2">Tila</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2 pr-3">
                    <Link to="/thermostats/$id" params={{ id: r.id }} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    {r.apartment && <div className="text-xs text-muted-foreground">Huoneisto {r.apartment}</div>}
                  </td>
                  <td className="py-2 pr-3 text-xs">{zoneLabel(r.zone)}</td>
                  <td className="py-2 pr-3"><DutyBar v={r.duty4h} /></td>
                  <td className="py-2 pr-3">
                    <DutyBar v={r.duty24h} />
                    {typeof r.samples24h === "number" && r.samples24h < data.expectedSamples / 2 && (
                      <div className="text-xs text-warning">vain {r.samples24h} / {data.expectedSamples} mittausta</div>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-xs tabular-nums">
                    {r.measured != null ? `${r.measured.toFixed(1)}` : "—"} / {r.target.toFixed(1)} °C
                    {r.diff != null && (
                      <span className={r.diff < -1 ? "ml-1 text-destructive" : "ml-1 text-muted-foreground"}>
                        ({r.diff > 0 ? "+" : ""}{r.diff.toFixed(1)})
                      </span>
                    )}
                    <div className="text-muted-foreground">{r.sensor}</div>
                  </td>
                  <td className="py-2">
                    <Badge variant="outline" className={STATUS_UI[r.st].cls}>{STATUS_UI[r.st].label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-muted-foreground">
            Lämmitysaste lasketaan 15 minuutin mittauksista (rele päällä / pois). "Ei saavuta tavoitetta" = lämmittää
            yli 90 % ajasta ja on silti yli 1 °C alle asetuksen — tarkista anturitila, ovi/ikkuna tai lämmitysteho.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
