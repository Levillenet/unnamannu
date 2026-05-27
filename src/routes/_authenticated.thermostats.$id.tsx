import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getThermostat, updateThermostat, listSchedules } from "@/lib/data.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from "recharts";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const qo = (id: string) =>
  queryOptions({ queryKey: ["thermostat", id], queryFn: () => getThermostat({ data: { id } }) });
const schedulesQO = queryOptions({ queryKey: ["schedules"], queryFn: () => listSchedules() });

export const Route = createFileRoute("/_authenticated/thermostats/$id")({
  loader: ({ params, context }) => {
    context.queryClient.ensureQueryData(qo(params.id));
    context.queryClient.ensureQueryData(schedulesQO);
  },
  component: ThermostatPage,
});

function ThermostatPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(qo(id));
  const { data: schedules } = useSuspenseQuery(schedulesQO);
  const t = data.thermostat;
  const qc = useQueryClient();
  const update = useServerFn(updateThermostat);
  const m = useMutation({
    mutationFn: update,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["thermostat", id] });
      qc.invalidateQueries({ queryKey: ["apartments"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      toast.success("Tallennettu");
    },
    onError: (e: any) => toast.error(e.message ?? "Tallennus epäonnistui"),
  });

  const [setpoint, setSetpoint] = useState(Number(t.current_setpoint));
  useEffect(() => setSetpoint(Number(t.current_setpoint)), [t.current_setpoint]);

  const chartData = data.readings.map((r) => ({
    time: new Date(r.ts as string).toLocaleString("fi-FI", { day: "2-digit", month: "2-digit", hour: "2-digit" }),
    huone: Number(r.room_temp),
    lattia: Number(r.floor_temp),
    asetus: Number(r.setpoint),
    teho: Number(r.power_w),
  }));

  return (
    <div className="p-8">
      <Link
        to="/apartments/$id"
        params={{ id: t.apartment_id }}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Takaisin huoneistoon
      </Link>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.room ?? t.name}</h1>
          <p className="text-sm text-muted-foreground">
            Huoneisto {(t.apartments as any)?.number} · ID {t.ebeco_device_id}
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
              <Label htmlFor="locked">Lukko (estä asukkaan säätö)</Label>
              <Switch
                id="locked"
                checked={t.locked}
                onCheckedChange={(v) => m.mutate({ data: { id: t.id, locked: v } })}
              />
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
