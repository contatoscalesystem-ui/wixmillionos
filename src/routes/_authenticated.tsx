import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutGrid, Gem, Users, BarChart3, User, Box, RotateCcw, Database,
  CalendarDays, File, Settings, LogOut, Menu, X, ShieldCheck,
} from "lucide-react";
import symbol from "@/assets/million-symbol.png.asset.json";
import { useAuth, statusPath, signOutWithLog } from "@/hooks/use-auth";
import { NotificationsGate } from "@/components/notifications-gate";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated")({
  component: AppLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/garimpos", label: "Garimpos", icon: Gem },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/pipeline", label: "Pipeline", icon: BarChart3 },
  { to: "/clientes", label: "Clientes", icon: User },
  { to: "/producao", label: "Produção", icon: Box },
  { to: "/recuperacao", label: "Recuperação", icon: RotateCcw },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/financeiro", label: "Financeiro", icon: Database },
  { to: "/arquivos", label: "Arquivos", icon: File, soon: true },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

function AppLayout() {
  const { session, loading, profile, role, checked, account, isSuperAdmin, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);
  useEffect(() => setOpen(false), [pathname]);
  // Re-check account status on every navigation so a block takes effect immediately.
  useEffect(() => { if (checked) void refreshProfile(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (checked && account && account.status !== "approved") navigate({ to: statusPath(account.status) });
    if (checked && account?.status === "approved" && account.must_change_password) navigate({ to: "/alterar-senha-obrigatoria" });
    if (checked && !account) navigate({ to: "/aguardando-aprovacao" });
  }, [checked, account, navigate]);

  if (loading || !session || !checked || account?.status !== "approved" || account.must_change_password) {
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

  if (checked && !role) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm space-y-3 text-center">
          <div className="text-sm font-semibold tracking-[0.3em] text-gold">WIX MILLION OS</div>
          <h1 className="text-xl font-bold">Sem acesso ao espaço de trabalho</h1>
          <p className="text-sm text-muted-foreground">Sua conta não possui acesso liberado. Novos acessos são liberados somente por convite de um administrador.</p>
          <button className="text-sm underline" onClick={async () => { await signOutWithLog(); navigate({ to: "/login" }); }}>Sair</button>
        </div>
      </div>
    );
  }

  const name = profile?.full_name ?? profile?.email ?? "";
  const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  const roleLabel = isSuperAdmin ? "Super Admin" : role === "admin" ? "Administrador" : "Operador";

  const sidebar = (
    <div className="wm-sidebar relative flex h-full flex-col">
      <div className="wm-gold-edge absolute inset-y-0 left-0 w-[3px]" />
      <div className="px-7 pb-6 pt-7">
        <img src={symbol.url} alt="" className="h-auto w-[60px]" />
        <div className="mt-3 text-[22px] font-extrabold leading-none tracking-tight text-[#F5F5F2]">WIX MILLION <span className="text-[#C79A32]">OS</span></div>
        <div className="mt-2 text-[10.5px] uppercase tracking-[0.22em] text-[#9A9A95]">Central de operação comercial</div>
        <div className="mt-4 h-[2px] w-12 bg-[#C49A35]" />
      </div>
      <nav className="wm-scroll flex-1 space-y-1 overflow-y-auto px-4 pb-4">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} className="wm-item group relative flex h-[52px] items-center gap-4 rounded-[11px] px-5 text-[15px] text-[#D5D5D2]"
            activeProps={{ className: "wm-active" }}>
            <n.icon className="h-5 w-5 shrink-0 stroke-[1.5]" />
            <span className="flex-1 truncate">{n.label}</span>
            {"soon" in n && <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[#AFAFAB]">Em breve</span>}
          </Link>
        ))}
        {isSuperAdmin && (
          <Link to="/admin" className="wm-item mt-2 flex h-[52px] items-center gap-4 rounded-[11px] px-5 text-[15px] text-[#D8AF51]">
            <ShieldCheck className="h-5 w-5 stroke-[1.5] text-[#C79A32]" /> Super Admin
          </Link>
        )}
      </nav>
      <div className="mx-5 border-t border-white/[0.08]" />
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="wm-avatar flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white">{initials}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium text-[#F5F5F2]">{name}</div>
          <div className="text-xs text-[#9A9A95]">{roleLabel}</div>
        </div>
        <button title="Sair" aria-label="Sair"
          onClick={async () => { await signOutWithLog(); navigate({ to: "/login" }); }}
          className="text-[#9A9A96] transition-colors duration-200 hover:text-[#D8AF51]">
          <LogOut className="h-5 w-5 stroke-[1.5]" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-[272px] lg:block">{sidebar}</aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="font-extrabold">WIX MILLION <span className="text-gold">OS</span></div>
        <button aria-label="Abrir menu" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => setOpen(false)} />
          <div className="wm-drawer absolute inset-y-0 left-0 w-[280px] max-w-[85vw]">
            <button aria-label="Fechar menu" className="absolute right-3 top-5 z-10 text-[#D5D5D2]" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            {sidebar}
          </div>
        </div>
      )}
      <main className="lg:pl-[272px]">
        <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
      <NotificationsGate />
    </div>
  );
}
