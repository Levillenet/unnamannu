import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listZoneDefaults, saveZoneDefault } from "@/lib/data.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Thermometer, Droplet, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const qo = queryOptions({ queryKey: ["zone-defaults"], queryFn: () => listZoneDefaults() });

export const Route = createFileRoute("/_authenticated/zones")({
  loader: ({ context }) => context.queryClient.ensureQueryData(qo),
  component: ZonesPage,
});

type Zone = "room" | "bathroom";

function ZoneCard({
  label,
  icon: Icon,
  count,
  guest,
  setGuest,
  defaultSp,
  setDefaultSp,
  graceMin,
  setGraceMin,
  lockAll,
  setLockAll,
  forceSetpoint,
  setForceSetpoint,
  onSaveDefaults,
  onApplyMaxToAll,
  onApplyLockToAll,
  onApplySetpointToAll,
  saving,
}: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            {label}
          </span>
          <span className="text-xs font-normal text-muted-foreground">{count} termostaattia</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <Label>Asiakkaan yläraja</Label>
            <span className="text-2xl font-semibold text-warning">{guest.toFixed(1)} °C</span>
          </div>
          <Slider min={15} max={30} step={0.5} value={[guest]} onValueChange={(v) => setGuest(v[0])} />
          <p className="mt-1 text-xs text-muted-foreground">Asiakas voi nostaa enintään tähän arvoon.</p>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <Label>Oletusasetus</Label>
            <span className="text-2xl font-semibold">{defaultSp.toFixed(1)} °C</span>
          </div>
          <Slider min={15} max={28} step={0.5} value={[defaultSp]} onValueChange={(v) => setDefaultSp(v[0])} />
        </div>

        <div className="space-y-2 rounded-md border border-warning/40 bg-warning/5 p-3">
          <Label className="text-sm">Palautusviive ylirajan jälkeen</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={120}
              step={1}
              value={graceMin}
              onChange={(e) => setGraceMin(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">minuuttia</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Viive jonka termostaatti odottaa asiakkaan tekemän säädön jälkeen, ennen kuin se palauttaa
            lämpötilan asetettuun maksimiarvoon. 0 = palautus välittömästi.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button variant="outline" onClick={onSaveDefaults} disabled={saving}>
            Tallenna oletukset
          </Button>
          <Button onClick={onApplyMaxToAll} disabled={saving}>
            Sovella ylärajaa kaikkiin ({count})
          </Button>
        </div>

        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Lukitse kaikki termostaatit</Label>
              <p className="text-xs text-muted-foreground">Asiakas ei pääse säätämään näytöltä.</p>
            </div>
            <Switch checked={lockAll} onCheckedChange={setLockAll} />
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={onApplyLockToAll}
            disabled={saving}
          >
            {lockAll ? "Lukitse" : "Vapauta"} kaikki ({count})
          </Button>
        </div>

        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <Label className="text-sm">Pakota asetusarvo kaikkiin</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={5}
              max={35}
              step={0.5}
              value={forceSetpoint}
              onChange={(e) => setForceSetpoint(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">°C</span>
            <Button size="sm" className="ml-auto" onClick={onApplySetpointToAll} disabled={saving}>
              Aseta kaikkiin
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Esim. 18 °C tyhjien huoneiden energiansäästöksi.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ZonesPage() {
  const { data } = useSuspenseQuery(qo);
  const qc = useQueryClient();
  const save = useServerFn(saveZoneDefault);
  const m = useMutation({
    mutationFn: save,
    onSuccess: (_r, vars: any) => {
      qc.invalidateQueries({ queryKey: ["zone-defaults"] });
      qc.invalidateQueries({ queryKey: ["apartments"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      const v = vars.data;
      if (v.applyToAll) toast.success("Yläraja sovellettu kaikkiin");
      else if (typeof v.lockAll === "boolean") toast.success(v.lockAll ? "Kaikki lukittu" : "Kaikki vapautettu");
      else if (typeof v.applySetpointToAll === "number") toast.success(`Asetus ${v.applySetpointToAll} °C kaikille`);
      else toast.success("Tallennettu");
    },
    onError: (e: any) => toast.error(e.message ?? "Tallennus epäonnistui"),
  });

  const buildingId = data.building?.id as string | undefined;
  const find = (z: Zone) => data.defaults.find((d) => d.zone === z);

  const [roomGuest, setRoomGuest] = useState(Number(find("room")?.guest_max_setpoint ?? 23));
  const [roomDefault, setRoomDefault] = useState(Number(find("room")?.default_setpoint ?? 21));
  const [roomGrace, setRoomGrace] = useState(Number((find("room") as any)?.override_grace_minutes ?? 2));
  const [roomLock, setRoomLock] = useState(false);
  const [roomForce, setRoomForce] = useState(18);

  const [bathGuest, setBathGuest] = useState(Number(find("bathroom")?.guest_max_setpoint ?? 25));
  const [bathDefault, setBathDefault] = useState(Number(find("bathroom")?.default_setpoint ?? 22));
  const [bathGrace, setBathGrace] = useState(Number((find("bathroom") as any)?.override_grace_minutes ?? 2));
  const [bathLock, setBathLock] = useState(false);
  const [bathForce, setBathForce] = useState(18);

  useEffect(() => {
    setRoomGuest(Number(find("room")?.guest_max_setpoint ?? 23));
    setRoomDefault(Number(find("room")?.default_setpoint ?? 21));
    setRoomGrace(Number((find("room") as any)?.override_grace_minutes ?? 2));
    setBathGuest(Number(find("bathroom")?.guest_max_setpoint ?? 25));
    setBathDefault(Number(find("bathroom")?.default_setpoint ?? 22));
    setBathGrace(Number((find("bathroom") as any)?.override_grace_minutes ?? 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!buildingId) return <div className="p-8">Kiinteistöä ei löytynyt.</div>;

  const mkBase = (zone: Zone, guest: number, def: number, grace: number) => ({
    building_id: buildingId,
    zone,
    guest_max_setpoint: guest,
    default_setpoint: def,
    override_grace_minutes: grace,
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Vyöhykeasetukset</h1>
        <p className="text-sm text-muted-foreground">
          Aseta oletukset ja asiakkaan ylärajat huoneiden ja kylpyhuoneiden termostaateille erikseen.
        </p>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Yksittäiselle termostaatille tehdyt muutokset (esim. ylärajan nosto) ovat kertaluonteisia ja
          ylikirjoittuvat, kun vyöhykkeen toiminto sovelletaan kaikkiin.
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ZoneCard
          label="Huoneet"
          icon={Thermometer}
          count={data.counts.room}
          guest={roomGuest}
          setGuest={setRoomGuest}
          defaultSp={roomDefault}
          setDefaultSp={setRoomDefault}
          graceMin={roomGrace}
          setGraceMin={setRoomGrace}
          lockAll={roomLock}
          setLockAll={setRoomLock}
          forceSetpoint={roomForce}
          setForceSetpoint={setRoomForce}
          saving={m.isPending}
          onSaveDefaults={() => m.mutate({ data: mkBase("room", roomGuest, roomDefault, roomGrace) })}
          onApplyMaxToAll={() => m.mutate({ data: { ...mkBase("room", roomGuest, roomDefault, roomGrace), applyToAll: true } })}
          onApplyLockToAll={() => m.mutate({ data: { ...mkBase("room", roomGuest, roomDefault, roomGrace), lockAll: roomLock } })}
          onApplySetpointToAll={() =>
            m.mutate({ data: { ...mkBase("room", roomGuest, roomDefault, roomGrace), applySetpointToAll: roomForce } })
          }
        />

        <ZoneCard
          label="Kylpyhuoneet"
          icon={Droplet}
          count={data.counts.bathroom}
          guest={bathGuest}
          setGuest={setBathGuest}
          defaultSp={bathDefault}
          setDefaultSp={setBathDefault}
          graceMin={bathGrace}
          setGraceMin={setBathGrace}
          lockAll={bathLock}
          setLockAll={setBathLock}
          forceSetpoint={bathForce}
          setForceSetpoint={setBathForce}
          saving={m.isPending}
          onSaveDefaults={() => m.mutate({ data: mkBase("bathroom", bathGuest, bathDefault, bathGrace) })}
          onApplyMaxToAll={() => m.mutate({ data: { ...mkBase("bathroom", bathGuest, bathDefault, bathGrace), applyToAll: true } })}
          onApplyLockToAll={() => m.mutate({ data: { ...mkBase("bathroom", bathGuest, bathDefault, bathGrace), lockAll: bathLock } })}
          onApplySetpointToAll={() =>
            m.mutate({ data: { ...mkBase("bathroom", bathGuest, bathDefault, bathGrace), applySetpointToAll: bathForce } })
          }
        />
      </div>
    </div>
  );
}
