import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listZoneDefaults, saveZoneDefault } from "@/lib/data.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Thermometer, Droplet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const qo = queryOptions({ queryKey: ["zone-defaults"], queryFn: () => listZoneDefaults() });

export const Route = createFileRoute("/_authenticated/zones")({
  loader: ({ context }) => context.queryClient.ensureQueryData(qo),
  component: ZonesPage,
});

type Zone = "room" | "bathroom";

function ZoneCard({
  zone,
  label,
  icon: Icon,
  count,
  guest,
  setGuest,
  defaultSp,
  setDefaultSp,
  onSave,
  onSaveAll,
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

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button variant="outline" onClick={onSave} disabled={saving}>
            Tallenna oletukset
          </Button>
          <Button onClick={onSaveAll} disabled={saving}>
            Sovella ylärajaa kaikkiin ({count})
          </Button>
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
      toast.success(vars.data.applyToAll ? "Sovellettu kaikkiin termostaatteihin" : "Tallennettu");
    },
    onError: (e: any) => toast.error(e.message ?? "Tallennus epäonnistui"),
  });

  const buildingId = data.building?.id as string | undefined;
  const find = (z: Zone) => data.defaults.find((d) => d.zone === z);

  const [roomGuest, setRoomGuest] = useState(Number(find("room")?.guest_max_setpoint ?? 23));
  const [roomDefault, setRoomDefault] = useState(Number(find("room")?.default_setpoint ?? 21));
  const [bathGuest, setBathGuest] = useState(Number(find("bathroom")?.guest_max_setpoint ?? 25));
  const [bathDefault, setBathDefault] = useState(Number(find("bathroom")?.default_setpoint ?? 22));

  useEffect(() => {
    setRoomGuest(Number(find("room")?.guest_max_setpoint ?? 23));
    setRoomDefault(Number(find("room")?.default_setpoint ?? 21));
    setBathGuest(Number(find("bathroom")?.guest_max_setpoint ?? 25));
    setBathDefault(Number(find("bathroom")?.default_setpoint ?? 22));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!buildingId) return <div className="p-8">Kiinteistöä ei löytynyt.</div>;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Vyöhykeasetukset</h1>
        <p className="text-sm text-muted-foreground">
          Aseta oletukset ja asiakkaan ylärajat huoneiden ja kylpyhuoneiden termostaateille erikseen.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ZoneCard
          zone="room"
          label="Huoneet"
          icon={Thermometer}
          count={data.counts.room}
          guest={roomGuest}
          setGuest={setRoomGuest}
          defaultSp={roomDefault}
          setDefaultSp={setRoomDefault}
          saving={m.isPending}
          onSave={() =>
            m.mutate({
              data: {
                building_id: buildingId,
                zone: "room",
                guest_max_setpoint: roomGuest,
                default_setpoint: roomDefault,
              },
            })
          }
          onSaveAll={() =>
            m.mutate({
              data: {
                building_id: buildingId,
                zone: "room",
                guest_max_setpoint: roomGuest,
                default_setpoint: roomDefault,
                applyToAll: true,
              },
            })
          }
        />

        <ZoneCard
          zone="bathroom"
          label="Kylpyhuoneet"
          icon={Droplet}
          count={data.counts.bathroom}
          guest={bathGuest}
          setGuest={setBathGuest}
          defaultSp={bathDefault}
          setDefaultSp={setBathDefault}
          saving={m.isPending}
          onSave={() =>
            m.mutate({
              data: {
                building_id: buildingId,
                zone: "bathroom",
                guest_max_setpoint: bathGuest,
                default_setpoint: bathDefault,
              },
            })
          }
          onSaveAll={() =>
            m.mutate({
              data: {
                building_id: buildingId,
                zone: "bathroom",
                guest_max_setpoint: bathGuest,
                default_setpoint: bathDefault,
                applyToAll: true,
              },
            })
          }
        />
      </div>
    </div>
  );
}
