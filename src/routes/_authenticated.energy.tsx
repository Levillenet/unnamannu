import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getEnergyByApartment } from "@/lib/data.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from "recharts";

const qo = queryOptions({ queryKey: ["energy"], queryFn: () => getEnergyByApartment() });

export const Route = createFileRoute("/_authenticated/energy")({
  loader: ({ context }) => context.queryClient.ensureQueryData(qo),
  component: EnergyPage,
});

function EnergyPage() {
  const { data } = useSuspenseQuery(qo);
  const total = data.byApartment.reduce((s, r) => s + r.energy_kwh, 0);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Energia</h1>
        <p className="text-sm text-muted-foreground">Kulutus viim. 30 vrk · yhteensä {total.toFixed(1)} kWh</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Päiväkulutus (kWh)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="energy_kwh" stroke="var(--chart-1)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Huoneittain (kWh)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byApartment}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="apartment" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="energy_kwh" fill="var(--chart-1)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
