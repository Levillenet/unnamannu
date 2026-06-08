import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Home, Calendar, BarChart3, Settings, LogOut, Layers, Radio, Menu, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logo from "@/assets/levi-suites-logo.png";
import { enforceThermostatLimits } from "@/lib/enforcement.functions";
import { syncEbecoDevices } from "@/lib/data.functions";
import { getMustChangePassword } from "@/lib/users.functions";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: AuthenticatedLayout,
});


const NAV = [
  { to: "/dashboard", label: "Yleisnäkymä", icon: LayoutDashboard },
  { to: "/apartments", label: "Huoneet", icon: Home },
  { to: "/devices", label: "Laitteet", icon: Radio },
  { to: "/zones", label: "Vyöhykkeet", icon: Layers },
  { to: "/schedules", label: "Aikataulut", icon: Calendar },
  { to: "/energy", label: "Energia", icon: BarChart3 },
  { to: "/settings", label: "Asetukset", icon: Settings },
] as const;

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const qc = useQueryClient();
  const enforce = useServerFn(enforceThermostatLimits);
  const sync = useServerFn(syncEbecoDevices);
  const runningRef = useRef(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        await sync({}).catch(() => undefined);
        const res = (await enforce({}).catch(() => null)) as
          | { actions?: Array<{ name: string; to: number; reason: string }> }
          | null;
        if (!alive) return;
        if (res?.actions?.length) {
          for (const a of res.actions) {
            const label =
              a.reason === "max_hold"
                ? `${a.name}: max-pito päättyi → ${a.to.toFixed(1)} °C`
                : `${a.name}: asetus palautettu rajaan ${a.to.toFixed(1)} °C`;
            toast.message(label);
          }
        }
        qc.invalidateQueries({ queryKey: ["devices"] });
        qc.invalidateQueries({ queryKey: ["overview"] });
        qc.invalidateQueries({ queryKey: ["apartments"] });
        qc.invalidateQueries({ queryKey: ["thermostat"] });
      } finally {
        runningRef.current = false;
      }
    };
    // Aja heti + joka 60 s
    void tick();
    const handle = setInterval(tick, 60_000);
    return () => {
      alive = false;
      clearInterval(handle);
    };
  }, [enforce, sync, qc]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };


  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
    else navigate({ to: "/dashboard" });
  };

  const currentLabel = NAV.find((n) => pathname === n.to || pathname.startsWith(n.to + "/"))?.label ?? "Unna&Mannu";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background px-3 md:hidden">
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Avaa valikko">
          <Menu className="h-5 w-5" />
        </Button>
        <img src={logo} alt="Unna&Mannu" className="h-7 w-auto object-contain" />
        <span className="ml-auto truncate text-sm font-medium text-foreground">{currentLabel}</span>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          aria-label="Sulje valikko"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-sidebar transition-transform duration-200 md:static md:w-72 md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 px-4 py-6">
          <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <img src={logo} alt="Unna&Mannu" className="h-16 w-auto object-contain" />
            <span className="text-xs font-medium uppercase tracking-wider text-sidebar-foreground/60">Unna&amp;Mannu</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Sulje valikko"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 overflow-y-auto">
          {NAV.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-2">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Kirjaudu ulos
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto pt-14 md:pt-0 min-w-0">
        <div className="px-4 pt-3 md:px-8 md:pt-4">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 text-muted-foreground hover:text-foreground" aria-label="Palaa edelliselle sivulle">
            <ArrowLeft className="h-4 w-4" /> Takaisin
          </Button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
