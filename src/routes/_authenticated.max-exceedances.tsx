import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getMaxExceedances24h } from "@/lib/data.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight, ShieldAlert } from "lucide-react";

const qo = queryOptions({ queryKey: ["max-exceedances-24h"], queryFn: () => getMaxExceedances24h() });

export const Route = createFileRoute("/_authenticated/max-exceedances")({
  loader: ({ context }) => context.queryClient.ensureQueryData(qo),
  component: MaxExceedancesPage,
});

function MaxExceedancesPage() {
  const { data } = useSuspenseQuery(qo);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Maksimiarvon ylitykset 24h</h1>
        <p className="text-sm text-muted-foreground">Huoneistot, joissa asiakkaan maksimiarvo on ylitetty viimeisen vuorokauden aikana.</p>
      </div>

      <Card className="mb-4 border-warning/40 bg-warning/5">
        <CardContent className="flex items-center gap-3 pt-6">
          <ShieldAlert className="h-5 w-5 text-warning" />
          <div>
            <div className="text-2xl font-semibold">{data.total}</div>
            <div className="text-sm text-muted-foreground">ylitystapahtumaa viimeisen 24 tunnin aikana</div>
          </div>
        </CardContent>
      </Card>

      {data.rows.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            <AlertTriangle className="h-5 w-5" /> Ei maksimiarvon ylityksiä viimeisen 24 tunnin aikana.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {data.rows.map((row: any) => (
            <Card key={row.apartment_id ?? "unallocated"} className="hover-lift">
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
                  <span>Huoneisto {row.apartment_number}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{row.count} ylitystä</Badge>
                    {row.apartment_id && (
                      <Link to="/apartments/$id" params={{ id: row.apartment_id }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        Avaa huonekortti <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </CardTitle>
                <p className="text-xs text-muted-foreground">{row.floor ? `krs ${row.floor} · ` : ""}Viimeisin {new Date(row.latest_at).toLocaleString("fi-FI")}</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {row.thermostats.slice(0, 6).map((t: any) => (
                    <div key={`${t.id}-${t.ts}`} className="rounded-md border bg-background px-3 py-2 text-sm">
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(t.ts).toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })}
                        {t.setpoint != null ? ` · palautus ${Number(t.setpoint).toFixed(1)} °C` : ""}
                        {t.guest_max_setpoint != null ? ` · max ${Number(t.guest_max_setpoint).toFixed(1)} °C` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
