import { createFileRoute, Link } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, PriorityBadge, Score, StatusBadge } from "@/components/crm";
import { fmtDate } from "@/lib/crm";
import { useLeads } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/recuperacao")({
  head: () => ({
    meta: [
      { title: "Recuperação — WIX MILLION OS" },
      { name: "description", content: "Leads em recuperação e sem resposta." },
      { property: "og:title", content: "Recuperação — WIX MILLION OS" },
      { property: "og:description", content: "Leads em recuperação e sem resposta." },
    ],
  }),
  component: RecPage,
});

function RecPage() {
  const { data, isLoading } = useLeads();
  const rows = (data ?? []).filter((l) => l.status === "recuperacao" || l.status === "sem_resposta");
  return (
    <div>
      <PageHeader title="Recuperação" subtitle="Leads com status Recuperação ou Sem resposta. Fluxos automáticos de recuperação chegam em um próximo MVP." />
      {isLoading ? <Skeleton className="h-48" /> : !rows.length ? <EmptyState title="Nenhum lead em recuperação." /> : (
        <div className="divide-y rounded-lg border bg-card">
          {rows.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div className="flex items-center gap-3"><PriorityBadge p={l.priority} /><Link to="/leads/$id" params={{ id: l.id }} className="font-medium hover:text-gold">{l.company_name}</Link><Score v={l.score} /></div>
              <div className="flex items-center gap-3"><StatusBadge s={l.status} /><span className="text-muted-foreground">Último contato: {fmtDate(l.last_contact_at)}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
