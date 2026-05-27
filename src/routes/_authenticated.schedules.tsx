import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { deleteSchedule, listSchedules, saveSchedule } from "@/lib/data.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Calendar } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const qo = queryOptions({ queryKey: ["schedules"], queryFn: () => listSchedules() });

export const Route = createFileRoute("/_authenticated/schedules")({
  loader: ({ context }) => context.queryClient.ensureQueryData(qo),
  component: SchedulesPage,
});

function SchedulesPage() {
  const { data: schedules } = useSuspenseQuery(qo);
  const qc = useQueryClient();
  const save = useServerFn(saveSchedule);
  const del = useServerFn(deleteSchedule);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [low, setLow] = useState(18);
  const [high, setHigh] = useState(21);

  const saveM = useMutation({
    mutationFn: save,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Aikataulu tallennettu");
      setOpen(false);
      setName(""); setDesc(""); setLow(18); setHigh(21);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: del,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Poistettu");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Aikataulut & energiaohjelmat</h1>
          <p className="text-sm text-muted-foreground">Keskitetty viikko-ohjelma, päivä-/yölämpötila</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Uusi ohjelma</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Uusi energiaohjelma</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nimi</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="esim. Yöalennus" />
              </div>
              <div>
                <Label>Kuvaus</Label>
                <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Yölämpötila (22–06)</Label>
                  <Input type="number" min={5} max={35} step={0.5} value={low} onChange={(e) => setLow(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Päivälämpötila</Label>
                  <Input type="number" min={5} max={35} step={0.5} value={high} onChange={(e) => setHigh(Number(e.target.value))} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={!name || saveM.isPending}
                onClick={() => saveM.mutate({ data: { name, description: desc, day_low: low, day_high: high } })}
              >
                Tallenna
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {schedules.map((s: any) => (
          <Card key={s.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  {s.name}
                </span>
                <Button variant="ghost" size="icon" onClick={() => delM.mutate({ data: { id: s.id } })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{s.description ?? "—"}</p>
              <Badge variant="secondary">
                {(s.schedule_assignments?.length ?? 0)} kohdistusta
              </Badge>
            </CardContent>
          </Card>
        ))}
        {schedules.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Ei vielä aikatauluja. Luo ensimmäinen ohjelma.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
