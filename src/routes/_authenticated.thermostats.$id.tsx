import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getThermostat, updateThermostat, listSchedules, listDevices } from "@/lib/data.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ShieldAlert, Link2Off } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from "recharts";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const qo = (id: string) =>
  queryOptions({ queryKey: ["thermostat", id], queryFn: () => getThermostat({ data: { id } }) });
const schedulesQO = queryOptions({ queryKey: ["schedules"], queryFn: () => listSchedules() });
const devicesQO = queryOptions({ queryKey: ["devices"], queryFn: () => listDevices() });

export const Route = createFileRoute("/_authenticated/thermostats/$id")({
  loader: ({ params, context }) => {
    context.queryClient.ensureQueryData(qo(params.id));
    context.queryClient.ensureQueryData(schedulesQO);
    context.queryClient.ensureQueryData(devicesQO);
  },
  component: ThermostatPage,
});

function ThermostatPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(qo(id));
  const { data: schedules } = useSuspenseQuery(schedulesQO);
  const { data: devices } = useSuspenseQuery(devicesQO);
  const apartments = (devices.apartments as { id: string; number: string }[]) ?? [];
  const t = data.thermostat;
  const qc = useQueryClient();
  const update = useServerFn(updateThermostat);
  const m = useMutation({
    mutationFn: update,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["thermostat", id] });
      qc.invalidateQueries({ queryKey: ["apartments"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      qc.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Tallennettu");
    },
    onError: (e: any) => toast.error(e.message ?? "Tallennus epäonnistui"),
  });

  const [setpoint, setSetpoint] = useState(Number(t.current_setpoint));
  const [guestMax, setGuestMax] = useState(Number(t.guest_max_setpoint));
  const [name, setName] = useState<string>(t.name);
  useEffect(() => setSetpoint(Number(t.current_setpoint)), [t.current_setpoint]);
  useEffect(() => setGuestMax(Number(t.guest_max_setpoint)), [t.guest_max_setpoint]);
  useEffect(() => setName(t.name), [t.name]);

  const enforcements = data.readings.filter((r: any) => r.event === "guest_max_enforced");
  const lastEnforced = enforcements.length > 0 ? enforcements[enforcements.length - 1] : null;

  const chartData = data.readings
    .filter((r: any) => r.event !== "guest_max_enforced")
    .map((r) => ({
      time: new Date(r.ts as string).toLocaleString("fi-FI", { day: "2-digit", month: "2-digit", hour: "2-digit" }),
      huone: Number(r.room_temp),
      lattia: Number(r.floor_temp),
      asetus: Number(r.setpoint),
      teho: Number(r.power_w),
    }));

  return (
    <div className="p-8">
      {t.apartment_id ? (
        <Link
          to="/apartments/$id"
          params={{ id: t.apartment_id }}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Takaisin huoneeseen
        </Link>
      ) : (
        <Link
          to="/devices"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Takaisin laitteisiin
        </Link>
      )}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.name}</h1>
          <p className="text-sm text-muted-foreground">
            {t.apartment_id ? `Huoneisto ${(t.apartments as any)?.number} · ` : "Allokoimaton · "}
            {t.zone === "bathroom" ? "Kylpyhuone" : "Huone"} · ID {t.ebeco_device_id}
          </p>
        </div>
        {t.status === "online" ? (
          <Badge variant="outline" className="border-success/40 text-success">Online</Badge>
        ) : t.status === "offline" ? (
          <Badge variant="secondary">Offline</Badge>
        ) : (
          <Badge variant="destructive">Hälytys</Badge>
        )}
      </div>

      {lastEnforced && (
        <Card className="mb-4 border-warning/40 bg-warning/5">
          <CardContent className="flex items-center gap-3 pt-6">
            <ShieldAlert className="h-5 w-5 text-warning" />
            <div className="text-sm">
              <div className="font-medium">Asiakkaan yläraja on palauttanut asetuksen {enforcements.length}× viim. 7 vrk</div>
              <div className="text-xs text-muted-foreground">
                Viimeisin: {new Date(lastEnforced.ts as string).toLocaleString("fi-FI")} → {Number(lastEnforced.setpoint).toFixed(1)} °C
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Ohjaus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <Label>Asetuslämpötila</Label>
                <span className="text-2xl font-semibold">{setpoint.toFixed(1)} °C</span>
              </div>
              <Slider
                min={5}
                max={35}
                step={0.5}
                value={[setpoint]}
                onValueChange={(v) => setSetpoint(v[0])}
                onValueCommit={(v) => m.mutate({ data: { id: t.id, current_setpoint: v[0] } })}
              />
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>5 °C</span>
                <span>35 °C</span>
              </div>
              {setpoint > guestMax && (
                <p className="mt-2 text-xs text-warning">
                  Arvo ylittää asiakkaan ylärajan ({guestMax.toFixed(1)} °C) – palautuu rajaan tallennettaessa.
                </p>
              )}
            </div>

            <div className="border-t pt-4">
              <div className="mb-2 flex items-baseline justify-between">
                <Label>Asiakkaan yläraja</Label>
                <span className="text-2xl font-semibold text-warning">{guestMax.toFixed(1)} °C</span>
              </div>
              <Slider
                min={15}
                max={30}
                step={0.5}
                value={[guestMax]}
                onValueChange={(v) => setGuestMax(v[0])}
                onValueCommit={(v) => m.mutate({ data: { id: t.id, guest_max_setpoint: v[0] } })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Asiakas voi nostaa asetuksen enintään tähän arvoon. Ylitykset palautuvat automaattisesti.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="enabled">Päällä</Label>
              <Switch
                id="enabled"
                checked={t.enabled}
                onCheckedChange={(v) => m.mutate({ data: { id: t.id, enabled: v } })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="locked">Lukko (estä asiakkaan säätö kokonaan)</Label>
              <Switch
                id="locked"
                checked={t.locked}
                onCheckedChange={(v) => m.mutate({ data: { id: t.id, locked: v } })}
              />
            </div>

            <div>
              <Label>Vyöhyke</Label>
              <Select
                value={t.zone}
                onValueChange={(v) => m.mutate({ data: { id: t.id, zone: v as "room" | "bathroom" } })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="room">Huone</SelectItem>
                  <SelectItem value="bathroom">Kylpyhuone</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Termostaatti seuraa valitun vyöhykkeen oletuksia ja "sovella kaikkiin" -toimintoja.
              </p>
            </div>

            <div>
              <Label>Aikataulu</Label>
              <Select
                value={t.current_schedule_id ?? "none"}
                onValueChange={(v) =>
                  m.mutate({ data: { id: t.id, current_schedule_id: v === "none" ? null : v } })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ei aikataulua</SelectItem>
                  {schedules.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Lämpötilat (7 vrk)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={Math.floor(chartData.length / 8)} />
                  <YAxis tick={{ fontSize: 10 }} domain={[10, 35]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="huone" stroke="var(--chart-1)" dot={false} name="Huone" />
                  <Line type="monotone" dataKey="lattia" stroke="var(--chart-4)" dot={false} name="Lattia" />
                  <Line type="monotone" dataKey="asetus" stroke="var(--chart-2)" strokeDasharray="4 4" dot={false} name="Asetus" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Teho (W)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={Math.floor(chartData.length / 12)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="teho" fill="var(--chart-1)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
