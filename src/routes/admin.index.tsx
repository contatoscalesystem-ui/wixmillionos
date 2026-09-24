import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatCard } from "@/components/crm";
import { Skeleton } from "@/components/ui/skeleton";
import { dt, eventSentence, money, rpc, type PlatformEvent } from "@/lib/admin";

export const Route = createFileRoute("/admin/")({ component: AdminHome });

type Stats = Record<string, number>;

function AdminHome() {
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: () => rpc<Stats>("admin_global_stats") });
  const ev = useQuery({ queryKey: ["admin", "activity", 15], queryFn: () => rpc<PlatformEvent[]>("admin_activity", { _limit: 15 }) });
  const s = stats.data;
  const cards: [string, string, boolean?][] = [
    ["Usuários totais", "users_total"], ["Usuários ativos", "users_active"], ["Aguardando aprovação", "users_pending", true],
    ["Bloqueados", "users_blocked"], ["Leads totais da plataforma", "leads"], ["Garimpos", "garimpos"], ["Clientes", "clients"],
    ["Conversões", "conversions", true], ["Projetos em produção", "projects_in_production"], ["Sites publicados", "sites_published"],
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="Painel da plataforma" subtitle="Números somados de todos os ambientes." />
      {!s ? <Skeleton className="h-40 w-full" /> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          {cards.map(([l, k, h]) => <StatCard key={k} label={l} value={s[k] ?? 0} highlight={h} />)}
          <StatCard label="Faturamento registrado" value={money(s.revenue)} highlight />
          <StatCard label="Comissões registradas" value={money(s.commission)} />
        </div>
      )}
      <section className="rounded-lg border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Atividade recente</h2>
          <Link to="/admin/atividade" className="text-sm underline">Ver tudo</Link>
        </div>
        {!ev.data ? <Skeleton className="h-20 w-full" /> : ev.data.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p> : (
          <ul className="divide-y">
            {ev.data.map((e) => <li key={e.id} className="flex gap-4 py-2 text-sm"><span className="w-32 shrink-0 text-muted-foreground">{dt(e.created_at)}</span>{eventSentence(e)}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
