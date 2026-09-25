import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  Users, UserPlus, Phone, Send, Target, Link2, BarChart3, Clock, Layers, Globe,
  Banknote, Coins, CalendarDays, FileText, Info, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate, sumByCurrency, type LeadStatus, type Tables } from "@/lib/crm";
import { ACTIVITY_LABEL } from "@/lib/activity";
import { profileName, useProfiles } from "@/lib/queries";
import { DashboardFilters, periodRange, validateDashSearch, type DashFilters } from "@/components/dashboard-filters";

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: validateDashSearch,
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

// Funnel stage represented by a real recorded event (1 Abordagem … 4 Conversão). Status transitions count only
// for the status they moved TO — a later status never implies earlier stages.
const STATUS_STAGE: Partial<Record<string, number>> = {
  abordagem_enviada: 1, interessado: 2, link_enviado: 3, convertido: 4,
};
function eventStage(type: string, metadata: unknown): number | null {
  if (type === "approach_sent") return 1;
  if (type === "link_sent") return 3;
  if (type === "converted") return 4;
  if (type === "status_changed") {
    const to = (metadata as { to?: string } | null)?.to;
    return (to && STATUS_STAGE[to]) || null;
  }
  return null;
}
const FUNNEL = ["Leads", "Abordagem", "Interesse", "Link", "Conversão"];
const HAS_SITE = ["site_fraco", "site_razoavel", "site_profissional"];

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Applies the lead-level filters to a query; `p` is the embedded-resource prefix (e.g. "leads."). */
function leadFilters(q: any, f: DashFilters, p = "", withResp = true) {
  q = q.is(`${p}archived_at`, null);
  if (f.garimpo) q = q.eq(`${p}garimpo_id`, f.garimpo);
  if (f.cidade) q = q.eq(`${p}city`, f.cidade);
  if (f.nicho) q = q.eq(`${p}niche`, f.nicho);
  if (withResp && f.resp) q = q.eq(`${p}assigned_to`, f.resp);
  if (f.status) q = q.eq(`${p}status`, f.status);
  if (f.site === "com_site") q = q.in(`${p}website_status`, HAS_SITE);
  else if (f.site) q = q.eq(`${p}website_status`, f.site);
  return q;
}
const inRange = (q: any, col: string, r: { from: string; to: string | null }) => {
  q = q.gte(col, r.from);
  return r.to ? q.lt(col, r.to) : q;
};
const within = (d: string | null | undefined, r: { from: string; to: string | null }) =>
  !!d && d >= r.from && (!r.to || d < r.to);

function Dashboard() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const f: DashFilters = search;
  const range = periodRange(f);
  const leadScoped = !!(f.garimpo || f.cidade || f.nicho || f.resp || f.status || f.site);
  const key = [f.garimpo, f.cidade, f.nicho, f.resp, f.status, f.site];
  const opts = { placeholderData: keepPreviousData } as const;
  const { data: profiles } = useProfiles();

  // Leads created within the period (Total, Novos, Prontos, Recuperação).
  const leads = useQuery({ ...opts, queryKey: ["leads", "dash", key, range.from, range.to], queryFn: async () => {
    const { data, error } = await inRange(leadFilters(supabase.from("leads").select("id, status"), f), "created_at", range).limit(50000);
    if (error) throw error;
    return data as { id: string; status: LeadStatus }[];
  } });
  // Follow-ups scheduled inside the selected period (open-ended periods end today).
  const followups = useQuery({ ...opts, queryKey: ["leads", "dash-followups", key, range.from, range.to], queryFn: async () => {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const { data, error } = await leadFilters(supabase.from("leads").select("id, company_name, next_followup_at, status"), f)
      .gte("next_followup_at", range.from).lt("next_followup_at", range.to ?? end.toISOString())
      .not("status", "in", "(convertido,perdido,nao_qualificado)")
      .order("next_followup_at").limit(12);
    if (error) throw error;
    return data as { id: string; company_name: string; next_followup_at: string }[];
  } });
  // Funnel events dated within the period; "Responsável" = who performed the action.
  const events = useQuery({ ...opts, queryKey: ["activities", "dash-funnel", key, range.from, range.to], queryFn: async () => {
    let q: any = supabase.from("lead_activities").select("lead_id, activity_type, metadata, leads!inner(id)")
      .in("activity_type", ["approach_sent", "status_changed", "link_sent", "converted"]);
    q = leadFilters(q, f, "leads.", false);
    if (f.resp) q = q.eq("user_id", f.resp);
    const { data, error } = await inRange(q, "created_at", range).limit(100000);
    if (error) throw error;
    return data as { lead_id: string; activity_type: string; metadata: unknown }[];
  } });
  const acts = useQuery({ ...opts, queryKey: ["activities", "dash-recent", key, range.from, range.to], queryFn: async () => {
    let q: any = supabase.from("lead_activities").select(leadScoped ? "*, leads!inner(company_name)" : "*, leads(company_name)");
    if (leadScoped) q = leadFilters(q, f, "leads.", false);
    if (f.resp) q = q.eq("user_id", f.resp);
    const { data, error } = await inRange(q, "created_at", range).order("created_at", { ascending: false }).limit(15);
    if (error) throw error;
    return data as (Tables<"lead_activities"> & { leads: { company_name: string } | null })[];
  } });
  const projects = useQuery({ ...opts, queryKey: ["site_projects", "dash", key], queryFn: async () => {
    let q: any = supabase.from("site_projects").select(leadScoped ? "status, created_at, updated_at, clients!inner(id, leads!inner(id))" : "status, created_at, updated_at");
    if (leadScoped) q = leadFilters(q, f, "clients.leads.");
    const { data, error } = await q.limit(20000);
    if (error) throw error;
    return data as Pick<Tables<"site_projects">, "status" | "created_at" | "updated_at">[];
  } });
  const finance = useQuery({ ...opts, queryKey: ["financial_entries", "dash", key], queryFn: async () => {
    let q: any = supabase.from("financial_entries").select(leadScoped ? "*, leads!inner(id)" : "*").neq("status", "cancelado");
    if (leadScoped) q = leadFilters(q, f, "leads.");
    const { data, error } = await q.limit(20000);
    if (error) throw error;
    return data as Tables<"financial_entries">[];
  } });

  const all = [leads, followups, events, acts, projects, finance];
  if (all.some((x) => x.isLoading && !x.data))
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-24" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;
  const busy = all.some((x) => x.isFetching);

  const L = leads.data ?? [];
  const count = (...s: LeadStatus[]) => L.filter((l) => s.includes(l.status)).length;
  const P = projects.data ?? [];
  const F = finance.data ?? [];
  const com = (e: Tables<"financial_entries">): [number | null, string] => [e.commission_amount, e.commission_currency];
  // Production entry = project creation; publication = last update of a published project (no dedicated timestamp exists).
  const sitesProd = P.filter((p) => p.status !== "publicado" && within(p.created_at, range)).length;
  const sitesPub = P.filter((p) => p.status === "publicado" && within(p.updated_at, range)).length;
  const forecast = F.filter((e) => within(e.expected_date ?? e.created_at, range));
  const received = F.filter((e) => e.status === "recebido" && within(e.paid_date ?? e.updated_at, range));

  // Funnel = DISTINCT leads with a real recorded event per stage inside the period.
  const stageSets = FUNNEL.map(() => new Set<string>());
  for (const ev of events.data ?? []) {
    const s = eventStage(ev.activity_type, ev.metadata);
    if (s && ev.lead_id) stageSets[s]?.add(ev.lead_id);
  }
  const reached = FUNNEL.map((_, i) => (i === 0 ? L.length : (stageSets[i]?.size ?? 0)));
  const due = followups.data ?? [];

  const stats: [string, ReactNode, LucideIcon, boolean?][] = [
    ["Total de leads", L.length, Users, true],
    ["Novos", count("novo"), UserPlus],
    ["Prontos para contato", count("pronto_contato"), Phone],
    ["Abordagens enviadas", stageSets[1]?.size ?? 0, Send],
    ["Interessados", stageSets[2]?.size ?? 0, Target],
    ["Links enviados", stageSets[3]?.size ?? 0, Link2],
    ["Convertidos", stageSets[4]?.size ?? 0, BarChart3, true],
    ["Em recuperação", count("recuperacao") + count("sem_resposta"), Clock],
    ["Sites em produção", sitesProd, Layers],
    ["Sites publicados", sitesPub, Globe],
    ["Comissão prevista", sumByCurrency(forecast, com), Banknote, true],
    ["Comissão recebida", sumByCurrency(received, com), Coins, true],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-[#171717] sm:text-[32px]">Dashboard</h1>
        <p className="mt-1 max-w-[36ch] text-[14px] text-[#777771] sm:max-w-none sm:text-[15px]">Central de operação comercial — dados em tempo real do banco.</p>
      </div>

      <DashboardFilters value={f} busy={busy} onChange={(next) => navigate({ to: ".", search: next, replace: true })} />

      <div className={`grid grid-cols-1 gap-2.5 transition-opacity sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-4 2xl:grid-cols-5 ${busy ? "opacity-60" : ""}`}>
        {stats.map(([label, value, Icon, gold]) => (
          <div key={label} className="db-card flex min-h-[64px] items-center gap-3 p-3 sm:min-h-[86px] sm:gap-4 sm:p-4">
            <IconBox icon={Icon} />
            <div className="min-w-0">
              <div className="truncate text-[12.5px] text-[#777771]">{label}</div>
              <div className={`mt-0.5 truncate text-[20px] font-bold leading-tight tabular-nums sm:text-[24px] ${gold ? "text-[#C39A39]" : "text-[#171717]"}`}>{value}</div>
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
  return <div className="flex h-9 w-9 sm:h-[42px] sm:w-[42px] shrink-0 items-center justify-center rounded-[10px] bg-[#C39A39]/[0.08]"><Icon className="h-5 w-5 stroke-[1.6] text-[#C39A39]" /></div>;
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
