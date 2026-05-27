import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import logo from "@/assets/levi-suites-logo.png";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/set-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Lähetimme palautuslinkin sähköpostiisi");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Lähetys epäonnistui";
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
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Palauta salasana</CardTitle>
            <CardDescription>Lähetämme palautuslinkin sähköpostiisi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sent ? (
              <p className="text-sm text-muted-foreground">
                Tarkista sähköpostisi. Jos viestiä ei kuulu hetken kuluttua, tarkista roskaposti.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Sähköposti</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <Button className="w-full" onClick={submit} disabled={loading || !email}>
                  {loading ? "Lähetetään…" : "Lähetä palautuslinkki"}
                </Button>
              </>
            )}
            <Link to="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground">
              ← Takaisin kirjautumiseen
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
