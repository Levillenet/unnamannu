import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { updateThermostatSettings } from "@/lib/data.functions";
import { SETTING_GROUPS, type SettingMeta } from "@/lib/ebeco-settings-meta";
import { BroadcastButton } from "@/components/BroadcastButton";

type Counts = { all: number; zone: number; apartment: number; building: number };

export function ThermostatSettingsTabs({
  thermostat,
  zoneLabel,
  apartmentNumber,
  buildingName,
  buildingId,
  counts,
}: {
  thermostat: any;
  zoneLabel?: string;
  apartmentNumber?: string;
  buildingName?: string;
  buildingId?: string | null;
  counts: Counts;
}) {
  return (
    <Tabs defaultValue={SETTING_GROUPS[0].id} className="w-full">
      <TabsList className="flex w-full flex-wrap">
        {SETTING_GROUPS.map((g) => (
          <TabsTrigger key={g.id} value={g.id}>
            {g.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {SETTING_GROUPS.map((g) => (
        <TabsContent key={g.id} value={g.id} className="space-y-4 pt-4">
          {g.settings.map((s) => (
            <SettingRow
              key={s.field}
              meta={s}
              thermostat={thermostat}
              zoneLabel={zoneLabel}
              apartmentNumber={apartmentNumber}
              buildingName={buildingName}
              buildingId={buildingId}
              counts={counts}
            />
          ))}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function readCurrent(thermostat: any, meta: SettingMeta): unknown {
  if (meta.column && thermostat[meta.column] != null) return thermostat[meta.column];
  const snap = thermostat.ebeco_settings as Record<string, unknown> | null | undefined;
  if (snap && meta.field in snap) return snap[meta.field];
  return undefined;
}

function SettingRow({
  meta,
  thermostat,
  zoneLabel,
  apartmentNumber,
  buildingName,
  buildingId,
  counts,
}: {
  meta: SettingMeta;
  thermostat: any;
  zoneLabel?: string;
  apartmentNumber?: string;
  buildingName?: string;
  buildingId?: string | null;
  counts: Counts;
}) {
  const current = readCurrent(thermostat, meta);
  const [value, setValue] = useState<unknown>(current);
  useEffect(() => setValue(current), [current]);

  const qc = useQueryClient();
  const save = useServerFn(updateThermostatSettings);
  const m = useMutation({
    mutationFn: (v: unknown) =>
      save({ data: { id: thermostat.id, patch: { [meta.field]: v } as any } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["thermostat", thermostat.id] });
      qc.invalidateQueries({ queryKey: ["devices"] });
      toast.success("Tallennettu");
    },
    onError: (e: any) => toast.error(e.message ?? "Tallennus epäonnistui"),
  });

  const changed = value !== current && value !== undefined && value !== "";
  const patch = changed ? ({ [meta.field]: value } as Record<string, unknown>) : {};

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Label className="text-sm">{meta.label}</Label>
          {meta.help && <p className="mt-0.5 text-xs text-muted-foreground">{meta.help}</p>}
          <div className="mt-2">{renderInput(meta, value, setValue)}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="secondary"
            disabled={!changed || m.isPending}
            onClick={() => m.mutate(value)}
          >
            <Save className="mr-1 h-3.5 w-3.5" />
            Tallenna
          </Button>
          <BroadcastButton
            sourceId={thermostat.id}
            patch={patch}
            zone={thermostat.zone}
            zoneLabel={zoneLabel}
            apartmentId={thermostat.apartment_id}
            apartmentNumber={apartmentNumber}
            buildingId={buildingId}
            buildingName={buildingName}
            counts={counts}
            disabled={!changed}
          />
        </div>
      </div>
    </div>
  );
}

function renderInput(meta: SettingMeta, value: unknown, setValue: (v: unknown) => void) {
  switch (meta.type) {
    case "boolean":
      return (
        <Switch checked={Boolean(value)} onCheckedChange={(v) => setValue(v)} />
      );
    case "select":
      return (
        <Select value={value == null ? "" : String(value)} onValueChange={(v) => setValue(v)}>
          <SelectTrigger>
            <SelectValue placeholder="Valitse…" />
          </SelectTrigger>
          <SelectContent>
            {meta.options?.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "slider": {
      const n = typeof value === "number" ? value : Number(value ?? meta.min ?? 0);
      return (
        <div className="flex items-center gap-3">
          <Slider
            min={meta.min ?? 0}
            max={meta.max ?? 100}
            step={meta.step ?? 1}
            value={[Number.isFinite(n) ? n : 0]}
            onValueChange={(v) => setValue(v[0])}
            className="flex-1"
          />
          <span className="w-16 text-right text-sm tabular-nums">
            {Number.isFinite(n) ? n : 0}
            {meta.unit ?? ""}
          </span>
        </div>
      );
    }
    case "number":
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={meta.min}
            max={meta.max}
            step={meta.step ?? 1}
            value={value == null ? "" : String(value)}
            onChange={(e) =>
              setValue(e.target.value === "" ? undefined : Number(e.target.value))
            }
            className="w-32"
          />
          {meta.unit && <span className="text-sm text-muted-foreground">{meta.unit}</span>}
        </div>
      );
    default:
      return (
        <Input
          value={value == null ? "" : String(value)}
          onChange={(e) => setValue(e.target.value)}
        />
      );
  }
}
