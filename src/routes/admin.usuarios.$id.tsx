import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, StatCard } from "@/components/crm";
import { AccountActions, AccountBadge } from "@/components/admin-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { d, dt, eventSentence, money, pct, rpc, type AdminUser } from "@/lib/admin";
import { statusLabel } from "@/lib/crm";

export const Route = createFileRoute("/admin/usuarios/$id")({ component: UserDetail });

const TABS = [
  ["overview", "Visão geral"], ["garimpos", "Garimpos"], ["leads", "Leads"], ["pipeline", "Pipeline"], ["clientes", "Clientes"],
  ["producao", "Produção"], ["recuperacao", "Recuperação"], ["agenda", "Agenda"], ["financeiro", "Financeiro"],
  ["atividades", "Atividades"], ["auditoria", "Auditoria"],
] as const;
type Section = (typeof TABS)[number][0];
type Row = Record<string, unknown>;

const COLS: Record<Exclude<Section, "overview" | "pipeline">, [string, string][]> = {
  garimpos: [["name", "Nome"], ["niche", "Nicho"], ["city", "Cidade"], ["total_leads", "Leads"], ["status", "Status"], ["created_at", "Criado"]],
  leads: [["company_name", "Empresa"], ["niche", "Nicho"], ["city", "Cidade"], ["status", "Status"], ["priority", "Prioridade"], ["score", "Score"], ["archived_at", "Arquivado"], ["created_at", "Criado"]],
  recuperacao: [["company_name", "Empresa"], ["city", "Cidade"], ["status", "Status"], ["last_contact_at", "Último contato"]],
  agenda: [["company_name", "Empresa"], ["city", "Cidade"], ["status", "Status"], ["next_followup_at", "Retorno"]],
  clientes: [["company_name", "Empresa"], ["contact_name", "Contato"], ["whatsapp", "WhatsApp"], ["city", "Cidade"], ["status", "Status"], ["created_at", "Desde"]],
  producao: [["company_name", "Cliente"], ["status", "Etapa"], ["preview_url", "Prévia"], ["published_url", "Publicado"], ["due_date", "Prazo"]],
  financeiro: [["type", "Tipo"], ["description", "Descrição"], ["platform_amount", "Valor"], ["platform_currency", "Moeda"], ["commission_amount", "Comissão"], ["status", "Status"], ["expected_date", "Prevista"], ["paid_date", "Recebida"]],
  atividades: [["created_at", "Quando"], ["company_name", "Lead"], ["activity_type", "Tipo"], ["description", "Descrição"]],
  auditoria: [["file_name", "Arquivo"], ["status", "Status"], ["total_rows", "Linhas"], ["valid_rows", "Válidas"], ["imported_rows", "Importadas"], ["audit_status", "Auditoria"], ["created_at", "Criado"]],
};

const fmt = (k: string, v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  if (k === "status" && typeof v === "string" && statusLabel(v) !== "—") return statusLabel(v);
  if (/_at$/.test(k)) return dt(String(v));
  if (/_date$/.test(k)) return d(String(v));
  if (/amount$/.test(k)) return money(Number(v));
  return String(v);
};

function UserDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Section>("overview");
  const users = useQuery({ queryKey: ["admin", "users"], queryFn: () => rpc<AdminUser[]>("admin_list_users") });
  const u = users.data?.find((x) => x.user_id === id);
  const data = useQuery({
    queryKey: ["admin", "user", id, tab],
    queryFn: () => rpc<unknown>("admin_user_data", { _user_id: id, _section: tab === "pipeline" ? "pipeline" : tab }),
    staleTime: 60_000,
  });

  if (users.data && !u) return <p className="text-sm text-muted-foreground">Usuário não encontrado. <Link to="/admin/usuarios" className="underline">Voltar</Link></p>;
  if (!u) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-6">
      <PageHeader title={u.full_name || u.email || "Usuário"} subtitle={u.email ?? undefined}
        actions={<AccountActions userId={u.user_id} status={u.status} isSuperAdmin={u.is_super_admin} onDone={() => qc.invalidateQueries({ queryKey: ["admin"] })} />} />
      <div className="flex flex-wrap gap-4 text-sm">
        <AccountBadge s={u.status} />
        <span>Criado em {dt(u.created_at)}</span>
        <span>Último acesso {dt(u.last_seen_at)}</span>
        <span>Última atividade {dt(u.ultima_atividade)}</span>
      </div>
      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === v ? "border-gold font-semibold" : "border-transparent text-muted-foreground"}`}>{l}</button>
        ))}
      </div>
      {data.isLoading ? <Skeleton className="h-40 w-full" /> : data.isError ? <p className="text-sm text-destructive">Não foi possível carregar os dados.</p>
        : tab === "overview" ? <Overview u={u} data={data.data as Record<string, Row[]>} />
        : tab === "pipeline" ? <Pipeline rows={data.data as Row[]} />
        : <DataTable cols={COLS[tab]} rows={data.data as Row[]} />}
    </div>
  );
}

function DataTable({ cols, rows }: { cols: [string, string][]; rows: Row[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr>{cols.map(([, l]) => <th key={l} className="px-3 py-2 font-medium">{l}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={cols.length} className="px-3 py-8 text-center text-muted-foreground">Nenhum registro.</td></tr>
            : rows.map((r, i) => <tr key={String(r.id ?? i)} className="border-t">{cols.map(([k]) => <td key={k} className="max-w-xs truncate px-3 py-2">{fmt(k, r[k])}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

function Pipeline({ rows }: { rows: Row[] }) {
  const groups = new Map<string, number>();
  rows.forEach((r) => groups.set(String(r.status), (groups.get(String(r.status)) ?? 0) + 1));
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      {[...groups.entries()].map(([s, n]) => <StatCard key={s} label={statusLabel(s)} value={n} />)}
      {groups.size === 0 && <p className="text-sm text-muted-foreground">Nenhum lead no pipeline.</p>}
    </div>
  );
}

function Overview({ u, data }: { u: AdminUser; data: Record<string, Row[]> }) {
  const kpis: [string, React.ReactNode, boolean?][] = [
    ["Leads", u.leads], ["Novos", u.novos], ["Abordagens enviadas", u.abordagens], ["Respondeu", u.respostas], ["Interessados", u.interessados],
    ["Links enviados", u.links], ["Convertidos", u.convertidos, true], ["Taxa de conversão", pct(u.convertidos, u.leads), true],
    ["Garimpos", u.garimpos], ["Clientes", u.clientes], ["Projetos", u.projetos], ["Sites publicados", u.publicados],
    ["Faturamento", money(u.faturamento), true], ["Comissões", money(u.comissao)],
  ];
  const events = (data.events ?? []) as unknown as { event_type: string; metadata: Record<string, unknown>; created_at: string }[];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">{kpis.map(([l, v, h]) => <StatCard key={l} label={l} value={v} highlight={h} />)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Box title="Atividade recente">
          {events.length === 0 ? <Empty /> : <ul className="divide-y">{events.map((e, i) => <li key={i} className="flex gap-3 py-2 text-sm"><span className="w-28 shrink-0 text-muted-foreground">{dt(e.created_at)}</span>{eventSentence({ ...e, full_name: u.full_name, email: u.email })}</li>)}</ul>}
        </Box>
        <Box title="Últimos leads"><DataTable cols={[["company_name", "Empresa"], ["city", "Cidade"], ["status", "Status"], ["created_at", "Criado"]]} rows={data.recent_leads ?? []} /></Box>
        <Box title="Últimas conversões"><DataTable cols={[["company_name", "Cliente"], ["city", "Cidade"], ["created_at", "Desde"]]} rows={data.recent_clients ?? []} /></Box>
        <Box title="Últimos registros financeiros"><DataTable cols={[["description", "Descrição"], ["platform_amount", "Valor"], ["commission_amount", "Comissão"], ["status", "Status"]]} rows={data.recent_financial ?? []} /></Box>
      </div>
    </div>
  );
}
const Box = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="space-y-2 rounded-lg border bg-card p-4"><h3 className="font-semibold">{title}</h3>{children}</section>;
const Empty = () => <p className="text-sm text-muted-foreground">Nenhum registro.</p>;
