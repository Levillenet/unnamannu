import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { completePasswordChange } from "@/lib/users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import logo from "@/assets/levi-suites-logo.png";

export const Route = createFileRoute("/set-password")({
  component: SetPasswordPage,
});

type RecoveryType = "recovery" | "invite" | "signup" | "magiclink" | "email_change";

function SetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const cleanUrl = () => {
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch {
        // ignore
      }
    };

    const finish = (ok: boolean, msg?: string) => {
      if (cancelled) return;
      if (ok) {
        setReady(true);
        setError(null);
        cleanUrl();
      } else {
        setError(msg ?? "Linkki ei kelpaa tai on vanhentunut. Pyydä uusi palautuslinkki.");
      }
    };

    const run = async () => {
      const existing = await supabase.auth.getSession();
      if (existing.data.session) {
        finish(true);
        return;
      }

      const search = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

      // 1) ?token_hash=...&type=recovery|invite|signup
      const tokenHash = search.get("token_hash") ?? hash.get("token_hash");
      const typeParam = (search.get("type") ?? hash.get("type")) as RecoveryType | null;
      if (tokenHash && typeParam) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: typeParam });
        finish(!error, error?.message);
        return;
      }

      // 2) ?code=... (PKCE)
      const code = search.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        finish(!error, error?.message);
        return;
      }

      // 3) #access_token=...&refresh_token=... (legacy implicit flow)
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        finish(!error, error?.message);
        return;
      }

      const urlError = search.get("error_description") ?? hash.get("error_description");
      if (urlError) {
        finish(false, decodeURIComponent(urlError));
        return;
      }

      finish(false);
    };

    run();
    return () => {
      cancelled = true;
    };
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
      navigate({ to: "/", replace: true });
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
              {error
                ? error
                : ready
                  ? "Luo salasana viimeistelläksesi tilin."
                  : "Käsitellään kutsua…"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <Link to="/reset-password" className="block text-center text-sm text-primary underline">
                Pyydä uusi palautuslinkki
              </Link>
            ) : (
              <>
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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
