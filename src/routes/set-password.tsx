import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import logo from "@/assets/levi-suites-logo.png";

export const Route = createFileRoute("/set-password")({
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery/invite token from the URL hash automatically.
    // Wait briefly for the session to land.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async () => {
    if (password.length < 8) {
      toast.error("Salasanan tulee olla vähintään 8 merkkiä");
      return;
    }
    if (password !== confirm) {
      toast.error("Salasanat eivät täsmää");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Salasana asetettu. Tervetuloa!");
      navigate({ to: "/dashboard", replace: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Tallennus epäonnistui";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-accent/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <img src={logo} alt="Levi Suites" className="h-24 w-auto object-contain md:h-32" />
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Unna&amp;Mannu</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Aseta salasana</CardTitle>
            <CardDescription>
              {ready ? "Luo salasana viimeistelläksesi tilin." : "Käsitellään kutsua…"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pw">Uusi salasana</Label>
              <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={!ready} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw2">Vahvista salasana</Label>
              <Input id="pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={!ready} />
            </div>
            <Button className="w-full" onClick={submit} disabled={!ready || loading}>
              {loading ? "Tallennetaan…" : "Tallenna ja kirjaudu"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
