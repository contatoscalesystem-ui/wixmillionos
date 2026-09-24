import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  Users, UserPlus, Phone, Send, Reply, Target, Link2, BarChart3, Clock, Layers, Globe,
  Banknote, Coins, CalendarDays, FileText, Info, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
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

// Funnel stage represented by a real recorded event (1 Abordagem … 5 Conversão). Status transitions count only
// for the status they moved TO — a later status never implies earlier stages.
const STATUS_STAGE: Partial<Record<string, number>> = {
  abordagem_enviada: 1, respondeu: 2, interessado: 3, link_enviado: 4, convertido: 5,
};
function eventStage(type: string, metadata: unknown): number | null {
  if (type === "approach_sent") return 1;
  if (type === "link_sent") return 4;
  if (type === "converted") return 5;
  if (type === "status_changed") {
    const to = (metadata as { to?: string } | null)?.to;
    return (to && STATUS_STAGE[to]) || null;
  }
  return null;
}
const FUNNEL = ["Leads", "Abordagem", "Resposta", "Interesse", "Link", "Conversão"];

function Dashboard() {
  const leads = useLeads();
  const projects = useProjects();
  const finance = useFinance();
  const { data: profiles } = useProfiles();
  const funnelEvents = useQuery({
    queryKey: ["activities", "funnel"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_activities").select("lead_id, activity_type, metadata, created_at")
        .in("activity_type", ["approach_sent", "status_changed", "link_sent", "converted"]).limit(100000);
      if (error) throw error;
      return data;
    },
  });
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

  // Funnel = DISTINCT active leads with a real recorded event per stage (never inferred from current status).
  const activeIds = new Set(L.map((l) => l.id));
  const stageSets = FUNNEL.map(() => new Set<string>());
  for (const ev of funnelEvents.data ?? []) {
    if (!ev.lead_id || !activeIds.has(ev.lead_id)) continue;
    const s = eventStage(ev.activity_type, ev.metadata);
    if (s) stageSets[s].add(ev.lead_id);
  }
  const reached = FUNNEL.map((_, i) => (i === 0 ? L.length : stageSets[i].size));
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const due = L.filter((l) => l.next_followup_at && new Date(l.next_followup_at) <= endOfToday && !["convertido", "perdido", "nao_qualificado"].includes(l.status))
    .sort((a, b) => new Date(a.next_followup_at!).getTime() - new Date(b.next_followup_at!).getTime());

  const stats: [string, ReactNode, LucideIcon, boolean?][] = [
    ["Total de leads", L.length, Users, true],
    ["Novos", count("novo"), UserPlus],
    ["Prontos para contato", count("pronto_contato"), Phone],
    ["Abordagens enviadas", count("abordagem_enviada"), Send],
    ["Respondeu", count("respondeu"), Reply],
    ["Interessados", count("interessado"), Target],
    ["Links enviados", count("link_enviado"), Link2],
    ["Convertidos", count("convertido"), BarChart3, true],
    ["Em recuperação", count("recuperacao") + count("sem_resposta"), Clock],
    ["Sites em produção", sitesProd, Layers],
    ["Sites publicados", P.length - sitesProd, Globe],
    ["Comissão prevista", sumByCurrency(F, com), Banknote, true],
    ["Comissão recebida", sumByCurrency(F.filter((f) => f.status === "recebido"), com), Coins, true],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[32px] font-extrabold leading-tight tracking-tight text-[#171717]">Dashboard</h1>
          <p className="mt-1 text-[15px] text-[#777771]">Central de operação comercial — dados em tempo real do banco.</p>
        </div>
        <Link to="/leads" className="db-gold-btn inline-flex h-11 items-center gap-2 self-start rounded-[10px] px-5 text-sm font-semibold text-white">
          <Users className="h-4 w-4" /> Ver leads
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
        {stats.map(([label, value, Icon, gold]) => (
          <div key={label} className="db-card flex min-h-[86px] items-center gap-4 p-4">
            <IconBox icon={Icon} />
            <div className="min-w-0">
              <div className="truncate text-[12.5px] text-[#777771]">{label}</div>
              <div className={`mt-0.5 truncate text-[24px] font-bold leading-tight tabular-nums ${gold ? "text-[#C39A39]" : "text-[#171717]"}`}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="db-panel flex flex-col p-5">
          <PanelTitle icon={BarChart3}>Funil</PanelTitle>
          <div className="space-y-3">
            {FUNNEL.map((name, i) => {
              const v = reached[i] ?? 0;
              const total = reached[0] ?? 0;
              const prev = reached[i - 1] ?? 0;
              const pctTotal = total ? (v / total) * 100 : 0;
              const pctPrev = i === 0 ? null : prev ? (v / prev) * 100 : 0;
              return (
                <div key={name}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="font-medium text-[#171717]">{name}</span>
                    <span className="tabular-nums"><span className="font-semibold text-[#171717]">{v}</span>
                      <span className="ml-3 text-[#777771]">{pctTotal.toFixed(0)}%{pctPrev != null && ` · ${pctPrev.toFixed(0)}% da etapa anterior`}</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-[#E9E9E5]"><div className="db-gold-bar h-2 rounded-full" style={{ width: `${pctTotal}%` }} /></div>
                </div>
              );
            })}
          </div>
          {!L.length && (
            <div className="mt-5 flex items-center gap-3 border-t border-black/[0.06] pt-4 text-[13px] text-[#777771]">
              <Info className="h-4 w-4 text-[#C39A39]" /> Sem leads ainda — o funil será calculado com dados reais.
            </div>
          )}
        </section>

        <section className="db-panel flex flex-col p-5">
          <PanelTitle icon={CalendarDays}>Follow-ups do dia</PanelTitle>
          {!due.length ? (
            <Empty icon={CalendarDays} title="Nenhum follow-up para hoje." sub={<>Quando houver follow-ups agendados,<br />eles aparecerão aqui.</>} big />
          ) : (
            <ul className="divide-y divide-black/[0.06]">
              {due.slice(0, 12).map((l) => {
                const late = new Date(l.next_followup_at!) < new Date(new Date().setHours(0, 0, 0, 0));
                return (
                  <li key={l.id} className="flex items-center justify-between py-2.5 text-sm">
                    <Link to="/leads/$id" params={{ id: l.id }} className="font-medium hover:text-[#C39A39]">{l.company_name}</Link>
                    <span className={late ? "font-semibold text-[#C39A39]" : "text-[#777771]"}>{late ? "Atrasado · " : ""}{fmtDate(l.next_followup_at)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="db-panel p-5">
        <PanelTitle icon={FileText}>Atividade recente</PanelTitle>
        {acts.isLoading ? <Skeleton className="h-24" /> : !acts.data?.length ? (
          <Empty icon={FileText} title="Nenhuma atividade registrada ainda." sub="As interações com leads e atualizações aparecerão aqui." />
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {acts.data.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <span className="font-semibold">{ACTIVITY_LABEL[a.activity_type] ?? a.activity_type}</span>
                  {a.lead_id && a.leads && <> · <Link to="/leads/$id" params={{ id: a.lead_id }} className="hover:text-[#C39A39]">{a.leads.company_name}</Link></>}
                  <span className="text-[#777771]"> — {a.description}</span>
                </span>
                <span className="text-xs text-[#777771]">{profileName(profiles, a.user_id)} · {fmtDate(a.created_at, true)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function IconBox({ icon: Icon }: { icon: LucideIcon }) {
  return <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] bg-[#C39A39]/[0.08]"><Icon className="h-5 w-5 stroke-[1.6] text-[#C39A39]" /></div>;
}
function PanelTitle({ icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-4 border-b border-black/[0.06] pb-4">
      <IconBox icon={icon} />
      <h2 className="text-[13px] font-bold uppercase tracking-[0.2em] text-[#171717]">{children}</h2>
    </div>
  );
}
function Empty({ icon: Icon, title, sub, big }: { icon: LucideIcon; title: string; sub: ReactNode; big?: boolean }) {
  return (
    <div className={`flex flex-1 flex-col items-center justify-center text-center ${big ? "py-10" : "py-4"}`}>
      <div className={`flex items-center justify-center rounded-full bg-[#F5F3ED] ${big ? "h-[72px] w-[72px]" : "h-12 w-12"}`}>
        <Icon className={`${big ? "h-8 w-8" : "h-5 w-5"} stroke-[1.5] text-[#777771]`} />
      </div>
      <div className="mt-4 text-[15px] font-medium text-[#171717]">{title}</div>
      <div className="mt-1.5 text-[13px] text-[#9A9A95]">{sub}</div>
    </div>
  );
}
