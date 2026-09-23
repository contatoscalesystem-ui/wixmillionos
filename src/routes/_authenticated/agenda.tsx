import { createFileRoute, Link } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, PriorityBadge, StatusBadge } from "@/components/crm";
import { fmtDate } from "@/lib/crm";
import { useLeads } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — WIX MILLION OS" },
      { name: "description", content: "Follow-ups agendados, dos mais atrasados aos próximos." },
      { property: "og:title", content: "Agenda — WIX MILLION OS" },
      { property: "og:description", content: "Follow-ups agendados." },
    ],
  }),
  component: AgendaPage,
});

function AgendaPage() {
  const { data, isLoading } = useLeads();
  const rows = (data ?? []).filter((l) => l.next_followup_at).sort((a, b) => new Date(a.next_followup_at!).getTime() - new Date(b.next_followup_at!).getTime());
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  return (
    <div>
      <PageHeader title="Agenda" subtitle="Follow-ups agendados nos leads. Integração com Google Calendar no próximo MVP." />
      {isLoading ? <Skeleton className="h-48" /> : !rows.length ? <EmptyState title="Nenhum retorno agendado." text="Use “Agendar retorno” na ficha do lead." /> : (
        <div className="divide-y rounded-lg border bg-card">
          {rows.map((l) => {
            const d = new Date(l.next_followup_at!);
            const late = d < today0;
            return (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div className="flex items-center gap-3"><PriorityBadge p={l.priority} /><Link to="/leads/$id" params={{ id: l.id }} className="font-medium hover:text-gold">{l.company_name}</Link><StatusBadge s={l.status} /></div>
                <span className={late ? "font-semibold text-gold" : "text-muted-foreground"}>{late && "Atrasado · "}{fmtDate(l.next_followup_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
