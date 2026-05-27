import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import logo from "@/assets/levi-suites-logo.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/dashboard", replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const signIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Kirjautuminen epäonnistui";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-accent/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <img src={logo} alt="Levi Suites" className="h-32 w-auto object-contain md:h-40" />
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Unna&amp;Mannu</span>
          <span className="text-sm text-muted-foreground">Levi Suites · Kiinteistöautomaation hallinta</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Kirjaudu sisään</CardTitle>
            <CardDescription>Käytä admin-kutsussa saamaasi sähköpostia.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Sähköposti</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Salasana</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && signIn()} />
            </div>
            <Button className="w-full" onClick={signIn} disabled={loading || !email || !password}>
              {loading ? "Kirjaudutaan…" : "Kirjaudu"}
            </Button>
            <Link to="/reset-password" className="block text-center text-sm text-muted-foreground hover:text-foreground">
              Unohditko salasanan?
            </Link>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Et pääse sisään? Pyydä adminia kutsumaan sinut.
        </p>
      </div>
    </div>
  );
}
