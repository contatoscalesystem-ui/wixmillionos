import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/crm";
import { AccountActions, AccountBadge } from "@/components/admin-ui";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { d, dt, money, pct, rpc, type AdminUser } from "@/lib/admin";
import type { AccountStatus } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin/usuarios/")({ component: UsersPage });

const TABS: { v: AccountStatus | "all"; l: string }[] = [
  { v: "pending", l: "Pendentes" }, { v: "approved", l: "Ativos" }, { v: "blocked", l: "Bloqueados" }, { v: "rejected", l: "Rejeitados" }, { v: "all", l: "Todos" },
];

type SortKey = "name" | "leads" | "abordagens" | "respostas" | "interessados" | "convertidos" | "conv" | "projetos" | "faturamento" | "comissao";
const RANK_COLS: [SortKey, string][] = [
  ["name", "Usuário"], ["leads", "Leads"], ["abordagens", "Abordagens"], ["respostas", "Respostas"], ["interessados", "Interessados"],
  ["convertidos", "Convertidos"], ["conv", "Conversão %"], ["projetos", "Projetos"], ["faturamento", "Faturamento"], ["comissao", "Comissão"],
];

function UsersPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "users"], queryFn: () => rpc<AdminUser[]>("admin_list_users") });
  const [tab, setTab] = useState<AccountStatus | "all">("pending");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<{ k: SortKey; asc: boolean }>({ k: "leads", asc: false });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["admin"] }); };

  const rows = useMemo(() => (q.data ?? []).filter((u) => {
    if (tab !== "all" && u.status !== tab) return false;
    const s = search.trim().toLowerCase();
    if (s && !`${u.full_name ?? ""} ${u.email ?? ""}`.toLowerCase().includes(s)) return false;
    if (from && u.created_at < from) return false;
    if (to && u.created_at.slice(0, 10) > to) return false;
    return true;
  }), [q.data, tab, search, from, to]);

  const ranking = useMemo(() => {
    const val = (u: AdminUser): number | string => sort.k === "name" ? (u.full_name ?? u.email ?? "").toLowerCase() : sort.k === "conv" ? (u.leads ? u.convertidos / u.leads : 0) : Number(u[sort.k]);
    return [...(q.data ?? []).filter((u) => u.status === "approved")].sort((a, b) => {
      const x = val(a), y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * (sort.asc ? 1 : -1);
    });
  }, [q.data, sort]);

  const count = (s: AccountStatus | "all") => (q.data ?? []).filter((u) => s === "all" || u.status === s).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Usuários" subtitle="Aprove, bloqueie e acompanhe cada conta da plataforma." />
      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button key={t.v} onClick={() => setTab(t.v)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.v ? "border-gold font-semibold" : "border-transparent text-muted-foreground"}`}>
            {t.l} <span className="text-xs text-muted-foreground">({count(t.v)})</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Input placeholder="Buscar por nome ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <label className="text-xs text-muted-foreground">Cadastro de<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs text-muted-foreground">até<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {!q.data ? <Skeleton className="h-40 w-full" /> : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{["Nome", "E-mail", "Status", "Cadastro", "Último acesso", "Leads", "Clientes", "Projetos", "Faturamento", "Comissão", "Ações"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">Nenhum usuário encontrado.</td></tr> : rows.map((u) => (
                <tr key={u.user_id} className="border-t">
                  <td className="px-3 py-2 font-medium">{u.full_name || "—"}</td>
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2"><AccountBadge s={u.status} /></td>
                  <td className="px-3 py-2">{d(u.created_at)}</td>
                  <td className="px-3 py-2">{dt(u.last_seen_at)}</td>
                  <td className="px-3 py-2">{u.leads}</td>
                  <td className="px-3 py-2">{u.clientes}</td>
                  <td className="px-3 py-2">{u.projetos}</td>
                  <td className="px-3 py-2">{money(u.faturamento)}</td>
                  <td className="px-3 py-2">{money(u.comissao)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to="/admin/usuarios/$id" params={{ id: u.user_id }} className="text-sm underline">Ver conta</Link>
                      <AccountActions userId={u.user_id} status={u.status} isSuperAdmin={u.is_super_admin} onDone={refresh} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Desempenho por usuário</h2>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{RANK_COLS.map(([k, l]) => (
                <th key={k} className="cursor-pointer px-3 py-2 font-medium" onClick={() => setSort((s) => ({ k, asc: s.k === k ? !s.asc : false }))}>
                  {l}{sort.k === k ? (sort.asc ? " ↑" : " ↓") : ""}
                </th>
              ))}</tr>
            </thead>
            <tbody>
              {ranking.length === 0 ? <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Nenhum usuário ativo.</td></tr> : ranking.map((u) => (
                <tr key={u.user_id} className="border-t">
                  <td className="px-3 py-2 font-medium">{u.full_name || u.email}</td>
                  <td className="px-3 py-2">{u.leads}</td><td className="px-3 py-2">{u.abordagens}</td><td className="px-3 py-2">{u.respostas}</td>
                  <td className="px-3 py-2">{u.interessados}</td><td className="px-3 py-2">{u.convertidos}</td>
                  <td className="px-3 py-2 font-semibold text-gold">{pct(u.convertidos, u.leads)}</td>
                  <td className="px-3 py-2">{u.projetos}</td><td className="px-3 py-2">{money(u.faturamento)}</td><td className="px-3 py-2">{money(u.comissao)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
