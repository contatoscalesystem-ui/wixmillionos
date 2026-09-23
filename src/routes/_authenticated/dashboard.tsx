import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard } from "@/components/crm";
import { fmtDate, sumByCurrency, type LeadStatus, type Tables } from "@/lib/crm";
import { ACTIVITY_LABEL } from "@/lib/activity";
import { profileName, useFinance, useLeads, useProfiles, useProjects } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — WIX MILLION OS" },
      { name: "description", content: "Visão geral da operação comercial com dados reais." },
      { property: "og:title", content: "Dashboard — WIX MILLION OS" },
      { property: "og:description", content: "Visão geral da operação comercial." },
    ],
  }),
  component: Dashboard,
});

// Furthest funnel stage a status represents (0 = lead only … 5 = converted).
const STAGE: Record<LeadStatus, number> = {
  novo: 0, validar: 0, pronto_contato: 0, nao_qualificado: 0,
  abordagem_enviada: 1, sem_resposta: 1, recuperacao: 1, perdido: 1,
  respondeu: 2, interessado: 3, valor_apresentado: 3, oferta_apresentada: 3, link_enviado: 4, convertido: 5,
};
const FUNNEL = ["Leads", "Abordagem", "Resposta", "Interesse", "Link", "Conversão"];

function Dashboard() {
  const leads = useLeads();
  const projects = useProjects();
  const finance = useFinance();
  const { data: profiles } = useProfiles();
  const acts = useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_activities").select("*, leads(company_name)").order("created_at", { ascending: false }).limit(15);
      if (error) throw error;
      return data;
    },
  });

  if (leads.isLoading || projects.isLoading || finance.isLoading)
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;

  const L = leads.data ?? [];
  const count = (...s: LeadStatus[]) => L.filter((l) => s.includes(l.status)).length;
  const P = projects.data ?? [];
  const F = (finance.data ?? []).filter((f) => f.status !== "cancelado");
  const com = (e: Tables<"financial_entries">): [number | null, string] => [e.commission_amount, e.commission_currency];
  const sitesProd = P.filter((p) => p.status !== "publicado").length;

  // Leads whose current stage is at or beyond each funnel step (a lead in a later stage passed the earlier ones).
  const reached = FUNNEL.map((_, i) => (L.filter((l) => l.status !== "nao_qualificado" || i === 0).filter((l) => STAGE[l.status] >= i).length));
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const due = L.filter((l) => l.next_followup_at && new Date(l.next_followup_at) <= endOfToday && !["convertido", "perdido", "nao_qualificado"].includes(l.status))
    .sort((a, b) => new Date(a.next_followup_at!).getTime() - new Date(b.next_followup_at!).getTime());

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" subtitle="Central de operação comercial — dados em tempo real do banco."
        actions={<Button asChild className="bg-gold text-gold-foreground hover:bg-gold/90"><Link to="/leads">Ver leads</Link></Button>} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total de leads" value={L.length} highlight />
        <StatCard label="Novos" value={count("novo")} />
        <StatCard label="Prontos para contato" value={count("pronto_contato")} />
        <StatCard label="Abordagens enviadas" value={count("abordagem_enviada")} />
        <StatCard label="Respondeu" value={count("respondeu")} />
        <StatCard label="Interessados" value={count("interessado")} />
        <StatCard label="Links enviados" value={count("link_enviado")} />
        <StatCard label="Convertidos" value={count("convertido")} highlight />
        <StatCard label="Em recuperação" value={count("recuperacao") + count("sem_resposta")} />
        <StatCard label="Sites em produção" value={sitesProd} />
        <StatCard label="Sites publicados" value={P.length - sitesProd} />
        <StatCard label="Comissão prevista" value={<span className="text-lg">{sumByCurrency(F, com)}</span>} highlight />
        <StatCard label="Comissão recebida" value={<span className="text-lg">{sumByCurrency(F.filter((f) => f.status === "recebido"), com)}</span>} highlight />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Funil</h2>
          <div className="space-y-2.5">
            {FUNNEL.map((name, i) => {
              const v = reached[i] ?? 0;
              const total = reached[0] ?? 0;
              const prev = reached[i - 1] ?? 0;
              const pctTotal = total ? (v / total) * 100 : 0;
              const pctPrev = i === 0 ? null : prev ? (v / prev) * 100 : 0;
              return (
                <div key={name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium">{name}</span>
                    <span className="tabular-nums"><span className="font-semibold">{v}</span>
                      <span className="ml-2 text-muted-foreground">{pctTotal.toFixed(0)}%{pctPrev != null && ` · ${pctPrev.toFixed(0)}% da etapa anterior`}</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-gold" style={{ width: `${pctTotal}%` }} /></div>
                </div>
              );
            })}
          </div>
          {!L.length && <p className="mt-4 text-sm text-muted-foreground">Sem leads ainda — o funil será calculado com dados reais.</p>}
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Follow-ups do dia</h2>
          {!due.length ? <p className="text-sm text-muted-foreground">Nenhum follow-up para hoje.</p> : (
            <ul className="divide-y">
              {due.slice(0, 12).map((l) => {
                const late = new Date(l.next_followup_at!) < new Date(new Date().setHours(0, 0, 0, 0));
                return (
                  <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                    <Link to="/leads/$id" params={{ id: l.id }} className="font-medium hover:text-gold">{l.company_name}</Link>
                    <span className={late ? "font-semibold text-gold" : "text-muted-foreground"}>{late ? "Atrasado · " : ""}{fmtDate(l.next_followup_at)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Atividade recente</h2>
        {acts.isLoading ? <Skeleton className="h-24" /> : !acts.data?.length ? <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p> : (
          <ul className="divide-y">
            {acts.data.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <span className="font-semibold">{ACTIVITY_LABEL[a.activity_type] ?? a.activity_type}</span>
                  {a.lead_id && a.leads && <> · <Link to="/leads/$id" params={{ id: a.lead_id }} className="hover:text-gold">{a.leads.company_name}</Link></>}
                  <span className="text-muted-foreground"> — {a.description}</span>
                </span>
                <span className="text-xs text-muted-foreground">{profileName(profiles, a.user_id)} · {fmtDate(a.created_at, true)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
