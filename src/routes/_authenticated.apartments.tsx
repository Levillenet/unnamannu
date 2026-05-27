import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listApartments, updateThermostat, createApartment } from "@/lib/data.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Minus, Plus, Droplet, Thermometer, ExternalLink, Lock } from "lucide-react";
import { useState, Fragment } from "react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/use-current-role";

const qo = queryOptions({ queryKey: ["apartments"], queryFn: () => listApartments() });

function pickRoomTemp(t: any): number | null {
  const eb = (t?.ebeco_settings ?? {}) as Record<string, unknown>;
  if (typeof eb.temperatureRoomDecimals === "number") return eb.temperatureRoomDecimals as number;
  if (typeof eb.temperatureRoom === "number") return eb.temperatureRoom as number;
  return null;
}
function pickFloorTemp(t: any): number | null {
  const eb = (t?.ebeco_settings ?? {}) as Record<string, unknown>;
  if (typeof eb.temperatureFloorDecimals === "number") return eb.temperatureFloorDecimals as number;
  if (typeof eb.temperatureFloor === "number") return eb.temperatureFloor as number;
  return null;
}

export const Route = createFileRoute("/_authenticated/apartments")({
  loader: ({ context }) => context.queryClient.ensureQueryData(qo),
  component: ApartmentsRoute,
});

function ApartmentsRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/apartments") return <Outlet />;
  return <ApartmentsPage />;
}

function AddApartmentDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ number: "", floor: "", apartment_type: "", bedrooms: "", size_m2: "" });
  const m = useMutation({
    mutationFn: () => createApartment({ data: {
      number: form.number.trim(),
      floor: form.floor.trim(),
      apartment_type: form.apartment_type.trim() || null,
      bedrooms: form.bedrooms === "" ? null : Number(form.bedrooms),
      size_m2: form.size_m2 === "" ? null : Number(form.size_m2),
    } }),
    onSuccess: () => {
      toast.success("Huoneisto lisätty");
      qc.invalidateQueries({ queryKey: ["apartments"] });
      setForm({ number: "", floor: "", apartment_type: "", bedrooms: "", size_m2: "" });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Lisäys epäonnistui"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-1 h-4 w-4" /> Lisää huoneisto</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Uusi huoneisto</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="num">Tunnus</Label>
              <Input id="num" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="esim. D1" />
            </div>
            <div>
              <Label htmlFor="floor">Kerros</Label>
              <Input id="floor" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="esim. 2 tai 2-3" />
            </div>
          </div>
          <div>
            <Label htmlFor="type">Huoneistotyyppi</Label>
            <Input id="type" value={form.apartment_type} onChange={(e) => setForm({ ...form, apartment_type: e.target.value })} placeholder="esim. 2mh+oh/k+saunaos." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="br">Makuuhuoneita</Label>
              <Input id="br" type="number" min={0} value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="sz">Pinta-ala (m²)</Label>
              <Input id="sz" type="number" step="0.5" min={0} value={form.size_m2} onChange={(e) => setForm({ ...form, size_m2: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Peruuta</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !form.number || !form.floor}>
            {m.isPending ? "Tallennetaan…" : "Tallenna"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function SetpointStepper({ t, onChange, busy }: { t: any; onChange: (v: number) => void; busy: boolean }) {
  const value = Number(t.current_setpoint);
  const max = Number(t.guest_max_setpoint ?? 35);
  const min = 5;
  const dec = () => onChange(Math.max(min, +(value - 0.5).toFixed(1)));
  const inc = () => onChange(Math.min(max, +(value + 0.5).toFixed(1)));
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-1 py-0.5">
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={dec} disabled={busy || value <= min}>
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <span className="min-w-[3rem] text-center text-sm font-medium tabular-nums">
        {value.toFixed(1)}°
      </span>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={inc} disabled={busy || value >= max}>
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function ApartmentsPage() {
  const { data: apts } = useSuspenseQuery(qo);
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const mutation = useMutation({
    mutationFn: (vars: { id: string; current_setpoint: number }) =>
      updateThermostat({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apartments"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Päivitys epäonnistui"),
  });

  const toggle = (id: string) =>
    setExpanded((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const isAdmin = useIsAdmin();
  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Huoneet</h1>
          <p className="text-sm text-muted-foreground">{apts.length} huoneistoa · klikkaa riviä laajentaaksesi</p>
        </div>
        {isAdmin && <AddApartmentDialog />}
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Huone</TableHead>
                <TableHead>Kerros</TableHead>
                <TableHead>Termostaatit</TableHead>
                <TableHead>Huone / Kylpyhuone</TableHead>
                <TableHead>Mitattu ka.</TableHead>
                <TableHead>Keskiasetus</TableHead>
                <TableHead>Tila</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {apts.map((a: any) => {
                const ts = (a.thermostats ?? []) as any[];
                const setpoints = ts.map((t) => Number(t.current_setpoint)).filter(Number.isFinite);
                const avg = setpoints.length
                  ? (setpoints.reduce((s, v) => s + v, 0) / setpoints.length).toFixed(1)
                  : "—";
                const roomTemps = ts.map(pickRoomTemp).filter((v): v is number => v != null);
                const avgRoom = roomTemps.length
                  ? (roomTemps.reduce((s, v) => s + v, 0) / roomTemps.length).toFixed(1)
                  : "—";
                const rooms = ts.filter((t) => t.zone === "room").length;
                const baths = ts.filter((t) => t.zone === "bathroom").length;
                const off = ts.filter((t) => t.status === "offline").length;
                const al = ts.filter((t) => t.status === "alarm").length;
                const isOpen = expanded.has(a.id);
                return (
                  <Fragment key={a.id}>
                    <TableRow className="cursor-pointer hover:bg-muted/40" onClick={() => toggle(a.id)}>
                      <TableCell>
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="font-medium">{a.number}</TableCell>
                      <TableCell>krs {a.floor}</TableCell>
                      <TableCell>{ts.length}</TableCell>
                      <TableCell className="text-muted-foreground">{rooms} · {baths}</TableCell>
                      <TableCell className="text-primary">{avgRoom} °C</TableCell>
                      <TableCell>{avg} °C</TableCell>
                      <TableCell>
                        {al === 0 && off === 0 ? (
                          <Badge variant="outline" className="border-success/40 text-success">OK</Badge>
                        ) : (
                          <div className="flex gap-1.5">
                            {al > 0 && <Badge variant="destructive">{al} hälytys</Badge>}
                            {off > 0 && <Badge variant="secondary">{off} offline</Badge>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button asChild size="sm" variant="ghost" title="Avaa huonekortti">
                          <Link to="/apartments/$id" params={{ id: a.id }}>
                            Avaa <ExternalLink className="h-3 w-3" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={9} className="p-0">
                          <div className="px-6 py-4">
                            {ts.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Ei termostaatteja</p>
                            ) : (
                              <div className="grid gap-2">
                                {ts
                                  .slice()
                                  .sort((x, y) => (x.zone === y.zone ? 0 : x.zone === "room" ? -1 : 1))
                                  .map((t) => (
                                    <div
                                      key={t.id}
                                      className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
                                    >
                                      <div className="flex min-w-0 items-center gap-2.5">
                                        {t.zone === "bathroom" ? (
                                          <Droplet className="h-4 w-4 text-primary shrink-0" />
                                        ) : (
                                          <Thermometer className="h-4 w-4 text-primary shrink-0" />
                                        )}
                                        <div className="min-w-0">
                                          <div className="truncate text-sm font-medium">
                                            {t.room ?? t.name ?? "Termostaatti"}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {(() => {
                                              const r = pickRoomTemp(t);
                                              const f = pickFloorTemp(t);
                                              const parts: string[] = [];
                                              if (r != null) parts.push(`Mitattu ${r.toFixed(1)} °C`);
                                              if (f != null) parts.push(`lattia ${f.toFixed(1)} °C`);
                                              parts.push(`asiakas-max ${Number(t.guest_max_setpoint).toFixed(1)} °C`);
                                              return parts.join(" · ");
                                            })()}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {t.status === "online" ? (
                                          <Badge variant="outline" className="border-success/40 text-success">Online</Badge>
                                        ) : t.status === "offline" ? (
                                          <Badge variant="secondary">Offline</Badge>
                                        ) : (
                                          <Badge variant="destructive">Hälytys</Badge>
                                        )}
                                        <SetpointStepper
                                          t={t}
                                          busy={mutation.isPending}
                                          onChange={(v) =>
                                            mutation.mutate({ id: t.id, current_setpoint: v })
                                          }
                                        />
                                        <Link
                                          to="/thermostats/$id"
                                          params={{ id: t.id }}
                                          className="text-xs text-muted-foreground hover:text-foreground"
                                        >
                                          Avaa
                                        </Link>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
