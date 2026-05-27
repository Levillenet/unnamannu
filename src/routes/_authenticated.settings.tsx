import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { seedDemoData } from "@/lib/seed.functions";
import {
  listUsers, inviteUser, updateUserRole, removeUser, listAuditLog, sendPasswordReset,
} from "@/lib/users.functions";
import { useCurrentRole, currentRoleQueryOptions } from "@/hooks/use-current-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Database, Cloud, Users, ScrollText, Mail, Trash2, KeyRound, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  loader: ({ context }) => context.queryClient.ensureQueryData(currentRoleQueryOptions),
  component: SettingsPage,
});

function SettingsPage() {
  const role = useCurrentRole();
  const isAdmin = role.role === "admin";
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Asetukset</h1>
        <p className="text-sm text-muted-foreground">Kiinteistön, käyttäjien ja integraatioiden hallinta</p>
      </div>
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Yleiset</TabsTrigger>
          {isAdmin && <TabsTrigger value="users">Käyttäjät</TabsTrigger>}
          {isAdmin && <TabsTrigger value="audit">Loki</TabsTrigger>}
        </TabsList>
        <TabsContent value="general" className="pt-4"><GeneralTab /></TabsContent>
        {isAdmin && <TabsContent value="users" className="pt-4"><UsersTab /></TabsContent>}
        {isAdmin && <TabsContent value="audit" className="pt-4"><AuditTab /></TabsContent>}
      </Tabs>
    </div>
  );
}

function GeneralTab() {
  const qc = useQueryClient();
  const seed = useServerFn(seedDemoData);
  const m = useMutation({
    mutationFn: seed,
    onSuccess: (r) => { qc.invalidateQueries(); toast.success(`Demodata luotu: ${r.apartments} huoneistoa, ${r.thermostats} termostaattia, ${r.readings} lukemaa`); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-primary" /> Demo-data</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Luo testidata: 26 huoneistoa, ~80 termostaattia, 7 vrk tunnittaiset lukemat ja 3 esimerkkiohjelmaa. Tämä korvaa kaiken nykyisen datan.</p>
          <Button onClick={() => m.mutate({} as never)} disabled={m.isPending}>{m.isPending ? "Luodaan..." : "Luo / palauta demo-data"}</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Cloud className="h-4 w-4 text-primary" /> Ebeco Cloud API</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">EB-Therm 500 -termostaatit ohjataan Ebeco Connect ‑pilven kautta REST-rajapinnalla.</CardContent>
      </Card>
    </div>
  );
}

function UsersTab() {
  const list = useServerFn(listUsers);
  const invite = useServerFn(inviteUser);
  const updateRole = useServerFn(updateUserRole);
  const remove = useServerFn(removeUser);
  const reset = useServerFn(sendPasswordReset);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["users"], queryFn: () => list() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["users"] });

  const inviteM = useMutation({ mutationFn: invite, onSuccess: () => { refresh(); toast.success("Kutsu lähetetty"); }, onError: (e: Error) => toast.error(e.message) });
  const roleM = useMutation({ mutationFn: updateRole, onSuccess: () => { refresh(); toast.success("Rooli päivitetty"); }, onError: (e: Error) => toast.error(e.message) });
  const removeM = useMutation({ mutationFn: remove, onSuccess: () => { refresh(); toast.success("Käyttäjä poistettu"); }, onError: (e: Error) => toast.error(e.message) });
  const resetM = useMutation({ mutationFn: reset, onSuccess: () => toast.success("Palautuslinkki lähetetty"), onError: (e: Error) => toast.error(e.message) });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Käyttäjät</span>
          <InviteDialog onInvite={(email, role) => inviteM.mutate({ data: { email, role, redirectTo: `${window.location.origin}/set-password` } })} pending={inviteM.isPending} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {q.isLoading ? <p className="text-sm text-muted-foreground">Ladataan…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3">Sähköposti</th><th className="py-2 pr-3">Rooli</th>
                <th className="py-2 pr-3">Viimeisin kirjautuminen</th><th className="py-2 pr-3 text-right">Toiminnot</th>
              </tr></thead>
              <tbody>
                {(q.data ?? []).map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{u.email}</td>
                    <td className="py-2 pr-3">
                      <Select value={u.role ?? "user"} onValueChange={(v) => roleM.mutate({ data: { userId: u.id, role: v as "admin" | "user" } })}>
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="admin">admin</SelectItem><SelectItem value="user">user</SelectItem></SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("fi-FI") : "—"}</td>
                    <td className="py-2 pr-3 text-right">
                      <Button size="sm" variant="ghost" title="Lähetä salasanan palautus" onClick={() => resetM.mutate({ data: { email: u.email, redirectTo: `${window.location.origin}/set-password` } })}><KeyRound className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" title="Poista käyttäjä" onClick={() => { if (confirm(`Poista käyttäjä ${u.email}?`)) removeM.mutate({ data: { userId: u.id } }); }}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InviteDialog({ onInvite, pending }: { onInvite: (email: string, role: "admin" | "user") => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Kutsu käyttäjä</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Kutsu uusi käyttäjä</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Sähköposti</Label><Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Rooli</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "user")}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">user — voi muuttaa lämpötiloja ja oletuksia</SelectItem>
                <SelectItem value="admin">admin — täydet oikeudet</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Peruuta</Button>
          <Button disabled={pending || !email} onClick={() => { onInvite(email, role); setOpen(false); setEmail(""); }}><Mail className="mr-2 h-4 w-4" /> Lähetä kutsu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuditTab() {
  const list = useServerFn(listAuditLog);
  const q = useQuery({ queryKey: ["audit-log"], queryFn: () => list({ data: { limit: 200 } }) });
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ScrollText className="h-4 w-4 text-primary" /> Muutosloki</CardTitle></CardHeader>
      <CardContent>
        {q.isLoading ? <p className="text-sm text-muted-foreground">Ladataan…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3">Aika</th><th className="py-2 pr-3">Käyttäjä</th><th className="py-2 pr-3">Toiminto</th><th className="py-2 pr-3">Kohde</th><th className="py-2 pr-3">Tiedot</th>
              </tr></thead>
              <tbody>
                {(q.data ?? []).map((r) => (
                  <tr key={r.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{new Date(r.ts).toLocaleString("fi-FI")}</td>
                    <td className="py-2 pr-3">{r.user_email ?? "—"}</td>
                    <td className="py-2 pr-3"><Badge variant="secondary">{r.action}</Badge></td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.entity_type ? `${r.entity_type}:${(r.entity_id ?? "").slice(0, 8)}` : "—"}</td>
                    <td className="py-2 pr-3">{r.details ? <code className="text-xs text-muted-foreground">{JSON.stringify(r.details).slice(0, 120)}</code> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

