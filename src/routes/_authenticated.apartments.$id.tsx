import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getApartment } from "@/lib/data.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Thermometer, Droplet, Lock } from "lucide-react";

const qo = (id: string) =>
  queryOptions({ queryKey: ["apartment", id], queryFn: () => getApartment({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/apartments/$id")({
  loader: ({ params, context }) => context.queryClient.ensureQueryData(qo(params.id)),
  component: ApartmentPage,
});

function ThermostatCard({ t }: { t: any }) {
  return (
    <Link to="/thermostats/$id" params={{ id: t.id }}>
      <Card className="h-full transition-colors hover:border-primary/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              {t.zone === "bathroom" ? (
                <Droplet className="h-4 w-4 text-primary" />
              ) : (
                <Thermometer className="h-4 w-4 text-primary" />
              )}
              {t.room ?? t.name}
            </span>
            {t.status === "online" ? (
              <Badge variant="outline" className="border-success/40 text-success">Online</Badge>
            ) : t.status === "offline" ? (
              <Badge variant="secondary">Offline</Badge>
            ) : (
              <Badge variant="destructive">Hälytys</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold">{Number(t.current_setpoint).toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">°C asetus</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Asiakkaan max {Number(t.guest_max_setpoint).toFixed(1)} °C</span>
            {t.locked && <Lock className="h-3 w-3" />}
          </div>
          {t.schedules && (
            <div className="mt-1 text-xs text-muted-foreground">Ohjelma: {t.schedules.name}</div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function ApartmentPage() {
  const { id } = Route.useParams();
  const { data: apt } = useSuspenseQuery(qo(id));

  const thermostats = (apt.thermostats as any[]) ?? [];
  const rooms = thermostats.filter((t) => t.zone === "room");
  const baths = thermostats.filter((t) => t.zone === "bathroom");

  return (
    <div className="p-8">
      <Link to="/apartments" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Huoneet
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Huone {apt.number}</h1>
        <p className="text-sm text-muted-foreground">
          {apt.size_m2 ?? "?"} m² · {apt.floor}. krs · {thermostats.length} termostaattia
        </p>
      </div>

      {rooms.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Huone</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map((t) => <ThermostatCard key={t.id} t={t} />)}
          </div>
        </section>
      )}

      {baths.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Kylpyhuone</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {baths.map((t) => <ThermostatCard key={t.id} t={t} />)}
          </div>
        </section>
      )}
    </div>
  );
}
