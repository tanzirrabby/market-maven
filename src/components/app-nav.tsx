import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Activity, Briefcase, Bell, LineChart, LogOut, Star } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: Activity },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/watchlist", label: "Watchlist", icon: Star },
  { to: "/alerts", label: "Alerts", icon: Bell },
];

export function AppNav() {
  const navigate = useNavigate();
  const router = useRouter();
  async function signOut() {
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
          <LineChart className="h-5 w-5 text-primary" />
          <span>Quantum<span className="text-primary">Trade</span></span>
        </Link>
        <nav className="flex flex-1 items-center gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-secondary [&.active]:text-foreground"
              activeProps={{ className: "active" }}
            >
              <span className="flex items-center gap-1.5"><l.icon className="h-3.5 w-3.5" />{l.label}</span>
            </Link>
          ))}
        </nav>
        <Button size="sm" variant="ghost" onClick={signOut}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
