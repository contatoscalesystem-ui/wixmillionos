import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Super Admin — WIX MILLION OS" },
      { name: "description", content: "Administração da plataforma WIX MILLION OS." },
      { property: "og:title", content: "Super Admin — WIX MILLION OS" },
      { property: "og:description", content: "Administração da plataforma WIX MILLION OS." },
    ],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Painel", exact: true },
  { to: "/admin/usuarios", label: "Usuários" },
  { to: "/admin/atividade", label: "Atividade" },
  { to: "/admin/mensagens", label: "Mensagens" },
] as const;

function AdminLayout() {
  const { session, loading, checked, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !session) navigate({ to: "/login" }); }, [loading, session, navigate]);
  useEffect(() => { if (checked && !isSuperAdmin) navigate({ to: "/dashboard" }); }, [checked, isSuperAdmin, navigate]);

  if (!checked || !isSuperAdmin) {
    return <div className="space-y-4 p-8"><Skeleton className="h-8 w-64" /><Skeleton className="h-32 w-full" /></div>;
  }
  return (
    <div className="min-h-screen">
      <header className="border-b bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <div className="font-extrabold text-sidebar-accent-foreground">WIX MILLION <span className="text-gold">SUPER ADMIN</span></div>
          <nav className="flex flex-wrap gap-1">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }}
                className="rounded-md px-3 py-1.5 text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent"
                activeProps={{ className: "!bg-sidebar-accent !text-gold" }}>{n.label}</Link>
            ))}
          </nav>
          <Link to="/dashboard" className="ml-auto text-sm text-sidebar-foreground/70 hover:text-sidebar-accent-foreground">Voltar ao meu ambiente</Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8"><Outlet /></main>
    </div>
  );
}
