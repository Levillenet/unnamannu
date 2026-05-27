import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listZoneDefaults,
  saveZoneDefault,
  deleteZoneDefault,
} from "@/lib/data.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Layers, Plus, Trash2, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const qo = queryOptions({ queryKey: ["zone-defaults"], queryFn: () => listZoneDefaults() });

export const Route = createFileRoute("/_authenticated/zones")({
  loader: ({ context }) => context.queryClient.ensureQueryData(qo),
  component: ZonesPage,
});

type ZoneRow = {
  id: string;
  zone: string;
  label: string;
  guest_max_setpoint: number;
  override_grace_minutes: number;
  default_setpoint: number;
  max_hold_minutes: number;
  building_id: string;
};

type SaveArgs = {
  guest: number;
  grace: number;
  def: number;
  hold: number;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function ZoneCard({
  row,
  count,
  onSave,
  onApplyMaxToAll,
  onLockToggle,
  onDelete,
  saving,
}: {
  row: ZoneRow;
  count: number;
  onSave: (a: SaveArgs) => void;
  onApplyMaxToAll: (a: SaveArgs) => void;
  onLockToggle: (locked: boolean) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const [guest, setGuest] = useState(Number(row.guest_max_setpoint));
  const [grace, setGrace] = useState(Number(row.override_grace_minutes));
  const [def, setDef] = useState(Number(row.default_setpoint));
  const [hold, setHold] = useState(Number(row.max_hold_minutes));
  const [lock, setLock] = useState(false);

  useEffect(() => {
    setGuest(Number(row.guest_max_setpoint));
    setGrace(Number(row.override_grace_minutes));
    setDef(Number(row.default_setpoint));
    setHold(Number(row.max_hold_minutes));
  }, [row.guest_max_setpoint, row.override_grace_minutes, row.default_setpoint, row.max_hold_minutes]);

  const holdHours = (hold / 60).toFixed(hold % 60 === 0 ? 0 : 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            {row.label}
            <span className="font-mono text-xs font-normal text-muted-foreground">{row.zone}</span>
          </span>
          <span className="text-xs font-normal text-muted-foreground">{count} termostaattia</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <Label>Oletuslämpötila</Label>
            <span className="text-2xl font-semibold text-primary">{def.toFixed(1)} °C</span>
          </div>
          <Slider min={5} max={35} step={0.5} value={[def]} onValueChange={(v) => setDef(v[0])} />
          <p className="mt-1 text-xs text-muted-foreground">
            Lämpötila johon termostaatti palautuu max-pidon päätyttyä.
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <Label>Asiakkaan yläraja (max-lämpötila)</Label>
            <span className="text-2xl font-semibold text-warning">{guest.toFixed(1)} °C</span>
          </div>
          <Slider min={5} max={35} step={0.5} value={[guest]} onValueChange={(v) => setGuest(v[0])} />
          <p className="mt-1 text-xs text-muted-foreground">Asiakas voi nostaa enintään tähän arvoon.</p>
        </div>

        <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-baseline justify-between">
            <Label className="text-sm">Max-pitoaika</Label>
            <span className="text-base font-semibold text-primary">
              {hold === 0 ? "ei käytössä" : `${holdHours} h`}
            </span>
          </div>
          <Slider min={0} max={1440} step={60} value={[hold]} onValueChange={(v) => setHold(v[0])} />
          <p className="text-xs text-muted-foreground">
            Kun termostaatti on saavuttanut max-arvon, se palautuu oletuslämpötilaan tämän ajan kuluttua.
            0 = ei automaattipalautusta (termostaatti jää max-arvoon).
          </p>
        </div>

        <div className="space-y-2 rounded-md border border-warning/40 bg-warning/5 p-3">
          <Label className="text-sm">Palautusviive maksimiasetuksen jälkeen</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={120}
              step={1}
              value={grace}
              onChange={(e) => setGrace(Number(e.target.value))}
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
          <Button variant="outline" onClick={() => onSave({ guest, grace, def, hold })} disabled={saving}>
            Tallenna oletukset
          </Button>
          <Button onClick={() => onApplyMaxToAll({ guest, grace, def, hold })} disabled={saving || count === 0}>
            Sovella ylärajaa kaikkiin ({count})
          </Button>
        </div>

        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Lukitse kaikki termostaatit</Label>
              <p className="text-xs text-muted-foreground">Asiakas ei pääse säätämään näytöltä.</p>
            </div>
            <Switch checked={lock} onCheckedChange={setLock} />
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={() => onLockToggle(lock)}
            disabled={saving || count === 0}
          >
            {lock ? "Lukitse" : "Vapauta"} kaikki ({count})
          </Button>
        </div>

        <div className="border-t pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={saving || count > 0}
            title={count > 0 ? "Vyöhykkeellä on termostaatteja — siirrä ne ensin toiseen vyöhykkeeseen" : ""}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Poista vyöhyke
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NewZoneDialog({
  onCreate,
  saving,
}: {
  onCreate: (data: {
    zone: string;
    label: string;
    guest_max_setpoint: number;
    override_grace_minutes: number;
    default_setpoint: number;
    max_hold_minutes: number;
  }) => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [zone, setZone] = useState("");
  const [guest, setGuest] = useState(23);
  const [grace, setGrace] = useState(2);
  const [def, setDef] = useState(21);
  const [hold, setHold] = useState(360);
  const [autoSlug, setAutoSlug] = useState(true);

  const onLabelChange = (v: string) => {
    setLabel(v);
    if (autoSlug) setZone(slugify(v));
  };

  const submit = () => {
    if (!zone || !label.trim()) {
      toast.error("Anna näyttönimi ja tunniste");
      return;
    }
    onCreate({
      zone,
      label: label.trim(),
      guest_max_setpoint: guest,
      override_grace_minutes: grace,
      default_setpoint: def,
      max_hold_minutes: hold,
    });
    setOpen(false);
    setLabel("");
    setZone("");
    setGuest(23);
    setGrace(2);
    setDef(21);
    setHold(360);
    setAutoSlug(true);
  };

  const holdHours = (hold / 60).toFixed(hold % 60 === 0 ? 0 : 1);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Lisää vyöhyke
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Uusi vyöhyke</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Näyttönimi</Label>
            <Input
              className="mt-1"
              placeholder="esim. Sauna"
              value={label}
              onChange={(e) => onLabelChange(e.target.value)}
            />
          </div>
          <div>
            <Label>Tunniste (slug)</Label>
            <Input
              className="mt-1 font-mono"
              placeholder="sauna"
              value={zone}
              onChange={(e) => {
                setAutoSlug(false);
                setZone(slugify(e.target.value));
              }}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Vain kirjaimet a–z, numerot, väliviiva ja alaviiva.
            </p>
          </div>
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <Label>Oletuslämpötila</Label>
              <span className="text-lg font-semibold text-primary">{def.toFixed(1)} °C</span>
            </div>
            <Slider min={5} max={35} step={0.5} value={[def]} onValueChange={(v) => setDef(v[0])} />
          </div>
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <Label>Asiakkaan yläraja</Label>
              <span className="text-lg font-semibold text-warning">{guest.toFixed(1)} °C</span>
            </div>
            <Slider min={5} max={35} step={0.5} value={[guest]} onValueChange={(v) => setGuest(v[0])} />
          </div>
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <Label>Max-pitoaika</Label>
              <span className="text-base font-semibold text-primary">
                {hold === 0 ? "ei käytössä" : `${holdHours} h`}
              </span>
            </div>
            <Slider min={0} max={1440} step={60} value={[hold]} onValueChange={(v) => setHold(v[0])} />
          </div>
          <div>
            <Label>Palautusviive maksimiasetuksen jälkeen (min)</Label>
            <Input
              type="number"
              min={0}
              max={120}
              className="mt-1 w-24"
              value={grace}
              onChange={(e) => setGrace(Number(e.target.value))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Peruuta</Button>
          <Button onClick={submit} disabled={saving || !zone || !label.trim()}>Luo vyöhyke</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ZonesPage() {
  const { data } = useSuspenseQuery(qo);
  const qc = useQueryClient();
  const save = useServerFn(saveZoneDefault);
  const del = useServerFn(deleteZoneDefault);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["zone-defaults"] });
    qc.invalidateQueries({ queryKey: ["apartments"] });
    qc.invalidateQueries({ queryKey: ["overview"] });
    qc.invalidateQueries({ queryKey: ["devices"] });
  };

  const saveM = useMutation({
    mutationFn: save,
    onSuccess: (_r, vars: any) => {
      invalidate();
      const v = vars.data;
      if (v.applyToAll) toast.success("Yläraja sovellettu kaikkiin");
      else if (typeof v.lockAll === "boolean") toast.success(v.lockAll ? "Kaikki lukittu" : "Kaikki vapautettu");
      else toast.success("Tallennettu");
    },
    onError: (e: any) => toast.error(e.message ?? "Tallennus epäonnistui"),
  });

  const delM = useMutation({
    mutationFn: del,
    onSuccess: () => { invalidate(); toast.success("Vyöhyke poistettu"); },
    onError: (e: any) => toast.error(e.message ?? "Poisto epäonnistui"),
  });

  const buildingId = data.building?.id as string | undefined;
  if (!buildingId) return <div className="p-8">Kiinteistöä ei löytynyt.</div>;

  const zones = data.defaults as ZoneRow[];

  const baseFor = (z: ZoneRow) => ({
    building_id: buildingId,
    zone: z.zone,
    label: z.label,
    guest_max_setpoint: Number(z.guest_max_setpoint),
    override_grace_minutes: Number(z.override_grace_minutes),
    default_setpoint: Number(z.default_setpoint),
    max_hold_minutes: Number(z.max_hold_minutes),
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vyöhykeasetukset</h1>
          <p className="text-sm text-muted-foreground">
            Aseta oletuslämpötila, yläraja, max-pitoaika ja palautusviive vyöhykekohtaisesti.
          </p>
        </div>
        <NewZoneDialog
          saving={saveM.isPending}
          onCreate={(d) => saveM.mutate({ data: { building_id: buildingId, ...d } })}
        />
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Kun asiakas nostaa termostaatin max-arvoon, käynnistyy max-pitoaika. Sen päätyttyä lämpötila
          palautuu automaattisesti vyöhykkeen oletuslämpötilaan — termostaatti ei jää max-arvoon.
        </span>
      </div>

      {zones.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          Ei vyöhykkeitä. Aloita lisäämällä ensimmäinen.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {zones.map((z) => (
            <ZoneCard
              key={z.id}
              row={z}
              count={data.counts[z.zone] ?? 0}
              saving={saveM.isPending}
              onSave={(a) =>
                saveM.mutate({
                  data: {
                    ...baseFor(z),
                    guest_max_setpoint: a.guest,
                    override_grace_minutes: a.grace,
                    default_setpoint: a.def,
                    max_hold_minutes: a.hold,
                  },
                })
              }
              onApplyMaxToAll={(a) =>
                saveM.mutate({
                  data: {
                    ...baseFor(z),
                    guest_max_setpoint: a.guest,
                    override_grace_minutes: a.grace,
                    default_setpoint: a.def,
                    max_hold_minutes: a.hold,
                    applyToAll: true,
                  },
                })
              }
              onLockToggle={(locked) =>
                saveM.mutate({ data: { ...baseFor(z), lockAll: locked } })
              }
              onDelete={() => {
                if (confirm(`Poistetaanko vyöhyke "${z.label}"?`)) delM.mutate({ data: { id: z.id } });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
