import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Pickaxe, Users, KanbanSquare, Briefcase, Hammer, RotateCcw, Wallet,
  CalendarDays, FolderOpen, Settings, LogOut, Menu, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated")({
  component: AppLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/garimpos", label: "Garimpos", icon: Pickaxe },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/clientes", label: "Clientes", icon: Briefcase },
  { to: "/producao", label: "Produção", icon: Hammer },
  { to: "/recuperacao", label: "Recuperação", icon: RotateCcw },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/arquivos", label: "Arquivos", icon: FolderOpen, soon: true },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

function AppLayout() {
  const { session, loading, profile, role } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);
  useEffect(() => setOpen(false), [pathname]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden w-64 bg-sidebar lg:block" />
        <div className="flex-1 space-y-4 p-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-6 py-6">
        <div className="text-lg font-extrabold tracking-tight text-sidebar-accent-foreground">WIX MILLION <span className="text-gold">OS</span></div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-sidebar-foreground/50">Central de operação comercial</div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeProps={{ className: "!bg-sidebar-accent !text-sidebar-accent-foreground [&_svg]:text-gold" }}
          >
            <n.icon className="h-4 w-4" />
            <span className="flex-1">{n.label}</span>
            {"soon" in n && <span className="text-[9px] uppercase tracking-wider text-sidebar-foreground/40">Em breve</span>}
          </Link>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <div className="truncate text-sm font-medium text-sidebar-accent-foreground">{profile?.full_name ?? profile?.email}</div>
        <div className="text-xs capitalize text-sidebar-foreground/50">{role ?? "—"}</div>
        <button
          onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
          className="mt-3 flex items-center gap-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-3.5 w-3.5" /> Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="font-extrabold">WIX MILLION <span className="text-gold">OS</span></div>
        <button aria-label="Abrir menu" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72">
            <button aria-label="Fechar menu" className="absolute right-3 top-5 z-10 text-sidebar-foreground" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            {sidebar}
          </div>
        </div>
      )}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
