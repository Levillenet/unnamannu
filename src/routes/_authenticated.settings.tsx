import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { seedDemoData } from "@/lib/seed.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Database, Cloud } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const seed = useServerFn(seedDemoData);
  const m = useMutation({
    mutationFn: seed,
    onSuccess: (r) => {
      qc.invalidateQueries();
      toast.success(`Demodata luotu: ${r.apartments} huoneistoa, ${r.thermostats} termostaattia, ${r.readings} lukemaa`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Asetukset</h1>
        <p className="text-sm text-muted-foreground">Kiinteistön ja Ebeco-integraation hallinta</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-primary" /> Demo-data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Luo testidata: 26 huoneistoa, ~80 termostaattia, 7 vrk tunnittaiset lukemat ja 3 esimerkkiohjelmaa.
              Tämä korvaa kaiken nykyisen datan.
            </p>
            <Button onClick={() => m.mutate({} as any)} disabled={m.isPending}>
              {m.isPending ? "Luodaan..." : "Luo / palauta demo-data"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cloud className="h-4 w-4 text-primary" /> Ebeco Cloud API
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              EB-Therm 500 -termostaatit ohjataan Ebeco Connect ‑pilven kautta REST-rajapinnalla
              (<code className="text-xs">ebecoconnect.com/api</code>). Rate limit 10 req/10 s, 30 req/60 s per IP.
            </p>
            <p className="text-muted-foreground">
              <strong>MVP-tila:</strong> käyttää mock-dataa. Oikea integraatio kytketään seuraavassa vaiheessa
              palvelutilin Bearer-tokenilla ja taustapollingilla.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
