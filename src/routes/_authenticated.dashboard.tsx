import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getBuildingOverview, listApartments } from "@/lib/data.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Thermometer, Zap, AlertTriangle, WifiOff, Home } from "lucide-react";

const overviewQO = queryOptions({ queryKey: ["overview"], queryFn: () => getBuildingOverview() });
const apartmentsQO = queryOptions({ queryKey: ["apartments"], queryFn: () => listApartments() });

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(overviewQO);
    context.queryClient.ensureQueryData(apartmentsQO);
  },
  component: DashboardPage,
});

function StatCard({ label, value, hint, icon: Icon, tone }: any) {
  const toneClass =
    tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className={`rounded-md bg-muted p-3 ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold">{value}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const { data: o } = useSuspenseQuery(overviewQO);
  const { data: apts } = useSuspenseQuery(apartmentsQO);

  const alarmApts = apts.filter((a: any) =>
    (a.thermostats ?? []).some((t: any) => t.status === "alarm" || t.status === "offline"),
  );

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Yleisnäkymä</h1>
        <p className="text-sm text-muted-foreground">{o.building?.name ?? "Kiinteistö"}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Huoneistoja" value={o.apartmentCount} icon={Home} />
        <StatCard
          label="Termostaatteja"
          value={o.thermostatCount}
          hint={`${o.online} online · ${o.offline} offline`}
          icon={Thermometer}
        />
        <StatCard
          label="Keskilämpötila"
          value={o.avgRoomTemp != null ? `${o.avgRoomTemp.toFixed(1)} °C` : "—"}
          hint="viim. 24 h"
          icon={Thermometer}
        />
        <StatCard
          label="Energia 24h"
          value={`${o.energy24h.toFixed(1)} kWh`}
          icon={Zap}
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" /> Hälytykset ja yhteyskatkot
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alarmApts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ei hälytyksiä.</p>
            ) : (
              <ul className="divide-y">
                {alarmApts.map((a: any) => {
                  const off = a.thermostats.filter((t: any) => t.status === "offline").length;
                  const al = a.thermostats.filter((t: any) => t.status === "alarm").length;
                  return (
                    <li key={a.id}>
                      <Link to="/apartments/$id" params={{ id: a.id }} className="flex items-center justify-between py-2 hover:bg-muted/40 -mx-2 px-2 rounded">
                        <div>
                          <div className="font-medium">Huoneisto {a.number}</div>
                          <div className="text-xs text-muted-foreground">{a.resident_name}</div>
                        </div>
                        <div className="flex gap-1.5">
                          {al > 0 && <Badge variant="destructive">{al} hälytys</Badge>}
                          {off > 0 && (
                            <Badge variant="outline" className="border-muted-foreground/30">
                              <WifiOff className="mr-1 h-3 w-3" /> {off}
                            </Badge>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pikanavigointi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link to="/apartments" className="block rounded-md border p-3 hover:bg-muted/40">
              Selaa kaikki huoneistot →
            </Link>
            <Link to="/schedules" className="block rounded-md border p-3 hover:bg-muted/40">
              Hallitse energiaohjelmia →
            </Link>
            <Link to="/energy" className="block rounded-md border p-3 hover:bg-muted/40">
              Tarkastele energiankulutusta →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
