import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Home, Calendar, BarChart3, Settings, LogOut, Layers, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logo from "@/assets/levi-suites-logo.png";

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
  { to: "/zones", label: "Vyöhykkeet", icon: Layers },
  { to: "/schedules", label: "Aikataulut", icon: Calendar },
  { to: "/energy", label: "Energia", icon: BarChart3 },
  { to: "/settings", label: "Asetukset", icon: Settings },
] as const;

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-60 flex-col border-r border-border bg-sidebar">
        <div className="flex flex-col gap-1 px-4 py-5">
          <img src={logo} alt="Unna&Mannu" className="h-8 w-auto object-contain self-start" />
          <span className="px-1 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/60">Unna&amp;Mannu</span>
        </div>
        <nav className="flex-1 space-y-0.5 px-2">
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
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
