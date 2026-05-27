import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { broadcastThermostatSetting } from "@/lib/data.functions";
import type { EbecoPatch } from "@/lib/ebeco-settings-meta";

export type EbecoPatch = Record<string, unknown>;

export type BroadcastScope =
  | { kind: "all" }
  | { kind: "zone"; zone: string }
  | { kind: "apartment"; apartment_id: string }
  | { kind: "building"; building_id: string };

type Counts = {
  all: number;
  zone: number;
  apartment: number;
  building: number;
};

export function BroadcastButton({
  sourceId,
  patch,
  zoneLabel,
  apartmentNumber,
  buildingName,
  zone,
  apartmentId,
  buildingId,
  counts,
  disabled,
}: {
  sourceId: string;
  patch: EbecoPatch;
  zoneLabel?: string;
  apartmentNumber?: string;
  buildingName?: string;
  zone?: string | null;
  apartmentId?: string | null;
  buildingId?: string | null;
  counts: Counts;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const broadcast = useServerFn(broadcastThermostatSetting);

  const m = useMutation({
    mutationFn: (scope: BroadcastScope) =>
      broadcast({ data: { source_id: sourceId, patch, scope } }),
    onSuccess: (r: any, scope) => {
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["devices"] });
      qc.invalidateQueries({ queryKey: ["thermostat"] });
      const where =
        scope.kind === "all"
          ? "kaikkiin"
          : scope.kind === "zone"
            ? `vyöhykkeelle ${zoneLabel ?? scope.zone}`
            : scope.kind === "apartment"
              ? `huoneistoon ${apartmentNumber ?? ""}`
              : `talon ${buildingName ?? ""} laitteisiin`;
      const parts = [`Päivitetty ${r.succeeded}/${r.total} ${where}`];
      if (r.failed > 0) parts.push(`${r.failed} epäonnistui`);
      toast.success(parts.join(" · "));
    },
    onError: (e: any) => toast.error(e.message ?? "Lähetys epäonnistui"),
  });

  const isEmpty = !patch || Object.keys(patch).length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled || isEmpty}
          title="Käytä myös toisiin termostaatteihin"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="mb-2 text-sm font-medium">Käytä tämä asetus myös…</div>
        <div className="space-y-1.5">
          {zone && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between"
              disabled={m.isPending}
              onClick={() => m.mutate({ kind: "zone", zone })}
            >
              <span>Vyöhykkeelle {zoneLabel ?? zone}</span>
              <span className="text-xs text-muted-foreground">{counts.zone}</span>
            </Button>
          )}
          {apartmentId && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between"
              disabled={m.isPending}
              onClick={() => m.mutate({ kind: "apartment", apartment_id: apartmentId })}
            >
              <span>Huoneistoon {apartmentNumber ?? ""}</span>
              <span className="text-xs text-muted-foreground">{counts.apartment}</span>
            </Button>
          )}
          {buildingId && (
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between"
              disabled={m.isPending}
              onClick={() => m.mutate({ kind: "building", building_id: buildingId })}
            >
              <span>Talon {buildingName ?? ""} laitteisiin</span>
              <span className="text-xs text-muted-foreground">{counts.building}</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between"
            disabled={m.isPending}
            onClick={() => m.mutate({ kind: "all" })}
          >
            <span>Kaikkiin termostaatteihin</span>
            <span className="text-xs text-muted-foreground">{counts.all}</span>
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Tallennetaan myös tähän termostaattiin, jos sitä ei ole jo tallennettu.
        </p>
      </PopoverContent>
    </Popover>
  );
}
