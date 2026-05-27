import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listDevices,
  listZoneDefaults,
  syncEbecoDevices,
  allocateThermostat,
  unallocateThermostat,
} from "@/lib/data.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Radio, Link2Off } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const qo = queryOptions({ queryKey: ["devices"], queryFn: () => listDevices() });
const zonesQo = queryOptions({ queryKey: ["zone-defaults"], queryFn: () => listZoneDefaults() });

export const Route = createFileRoute("/_authenticated/devices")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(qo),
      context.queryClient.ensureQueryData(zonesQo),
    ]),
  component: DevicesPage,
});

type Device = {
  id: string;
  name: string;
  ebeco_device_id: string | null;
  apartment_id: string | null;
  zone: string;
  status: string;
  last_seen_at: string | null;
  apartments: { id: string; number: string } | null;
};

type ZoneOption = { zone: string; label: string };

function UnallocatedRow({
  device,
  apartments,
  zones,
  onAllocate,
  saving,
}: {
  device: Device;
  apartments: { id: string; number: string }[];
  zones: ZoneOption[];
  onAllocate: (data: { id: string; apartment_id: string; name: string; zone: string }) => void;
  saving: boolean;
}) {
  const [apartmentId, setApartmentId] = useState<string>("");
  const [name, setName] = useState<string>(device.name);
  const [zone, setZone] = useState<string>(zones[0]?.zone ?? "room");

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <span className="font-medium">{device.ebeco_device_id}</span>
          {device.status === "online" ? (
            <Badge variant="outline" className="border-success/40 text-success">Online</Badge>
          ) : (
            <Badge variant="secondary">{device.status}</Badge>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label className="text-xs">Huoneisto</Label>
          <Select value={apartmentId} onValueChange={setApartmentId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Valitse..." />
            </SelectTrigger>
            <SelectContent>
              {apartments.map((a) => (
                <SelectItem key={a.id} value={a.id}>Huoneisto {a.number}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Nimi (esim. Makuuhuone)</Label>
          <Input
            className="mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Makuuhuone"
          />
        </div>

        <div>
          <Label className="text-xs">Vyöhyke</Label>
          <Select value={zone} onValueChange={setZone}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {zones.map((z) => (
                <SelectItem key={z.zone} value={z.zone}>{z.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          disabled={!apartmentId || !name.trim() || saving}
          onClick={() => onAllocate({ id: device.id, apartment_id: apartmentId, name: name.trim(), zone })}
        >
          Allokoi
        </Button>
      </div>
    </div>
  );
}

function DevicesPage() {
  const { data } = useSuspenseQuery(qo);
  const { data: zonesData } = useSuspenseQuery(zonesQo);
  const zoneOptions: ZoneOption[] = (zonesData.defaults as any[]).map((z) => ({ zone: z.zone, label: z.label }));
  const zoneLabelOf = (z: string) => zoneOptions.find((o) => o.zone === z)?.label ?? z;
  const qc = useQueryClient();

  const sync = useServerFn(syncEbecoDevices);
  const allocate = useServerFn(allocateThermostat);
  const unallocate = useServerFn(unallocateThermostat);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["devices"] });
    qc.invalidateQueries({ queryKey: ["apartments"] });
    qc.invalidateQueries({ queryKey: ["overview"] });
  };

  const syncM = useMutation({
    mutationFn: () => sync(),
    onSuccess: (r: any) => {
      invalidate();
      toast.success(r.created > 0 ? `${r.created} uutta laitetta löytyi` : "Ei uusia laitteita");
    },
    onError: (e: any) => toast.error(e.message ?? "Synkronointi epäonnistui"),
  });

  const allocM = useMutation({
    mutationFn: allocate,
    onSuccess: () => { invalidate(); toast.success("Allokoitu"); },
    onError: (e: any) => toast.error(e.message ?? "Allokointi epäonnistui"),
  });

  const unallocM = useMutation({
    mutationFn: unallocate,
    onSuccess: () => { invalidate(); toast.success("Vapautettu"); },
    onError: (e: any) => toast.error(e.message ?? "Vapautus epäonnistui"),
  });

  const all = (data.thermostats as Device[]) ?? [];
  const unallocated = all.filter((t) => !t.apartment_id);
  const allocated = all.filter((t) => t.apartment_id);

  // Group allocated by apartment
  const byApt = new Map<string, { number: string; items: Device[] }>();
  for (const t of allocated) {
    const aid = t.apartment_id!;
    if (!byApt.has(aid)) byApt.set(aid, { number: t.apartments?.number ?? "?", items: [] });
    byApt.get(aid)!.items.push(t);
  }
  const aptGroups = [...byApt.entries()].sort((a, b) =>
    a[1].number.localeCompare(b[1].number, "fi", { numeric: true }),
  );

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Laitteet</h1>
          <p className="text-sm text-muted-foreground">
            Synkronoi Ebeco-tilin termostaatit ja allokoi ne huoneistoihin.
          </p>
        </div>
        <Button onClick={() => syncM.mutate()} disabled={syncM.isPending}>
          <RefreshCw className={`mr-2 h-4 w-4 ${syncM.isPending ? "animate-spin" : ""}`} />
          Synkronoi Ebecosta
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Allokoimattomat</span>
            <Badge variant="secondary">{unallocated.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unallocated.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ei allokoimattomia laitteita. Paina "Synkronoi Ebecosta" hakeaksesi uusia.
            </p>
          ) : (
            <div className="space-y-3">
              {unallocated.map((d) => (
                <UnallocatedRow
                  key={d.id}
                  device={d}
                  apartments={data.apartments as any[]}
                  zones={zoneOptions}
                  saving={allocM.isPending}
                  onAllocate={(payload) => allocM.mutate({ data: payload })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Allokoidut</span>
            <Badge variant="secondary">{allocated.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {aptGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ei allokoituja laitteita.</p>
          ) : (
            aptGroups.map(([aid, g]) => (
              <div key={aid}>
                <div className="mb-2 text-sm font-medium">Huoneisto {g.number}</div>
                <div className="space-y-1.5">
                  {g.items.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2"
                    >
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-mono text-xs text-muted-foreground">{t.ebeco_device_id}</span>
                        <span className="font-medium">{t.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {zoneLabelOf(t.zone)}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Link to="/thermostats/$id" params={{ id: t.id }}>
                          <Button size="sm" variant="ghost">Muokkaa</Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => unallocM.mutate({ data: { id: t.id } })}
                          disabled={unallocM.isPending}
                        >
                          <Link2Off className="mr-1 h-3.5 w-3.5" />
                          Vapauta
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
