import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Eye, Pencil, Plus, Trash2, Upload, MessageCircle, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog, StrongConfirmDialog, EmptyState, PageHeader, PriorityBadge, Score, StatusBadge } from "@/components/crm";
import { LeadForm } from "@/components/lead-form";
import { GarimpoForm, ImportSoonDialog } from "@/components/garimpo-form";
import { Kanban } from "@/components/kanban";
import { LEAD_STATUS, PRIORITIES, WEBSITE_STATUS, fmtDate, friendlyError, normalizeBrPhone, websiteLabel, type Lead } from "@/lib/crm";
import { profileName, useArchivedLeads, useGarimpos, useInvalidate, useLeads, useProfiles } from "@/lib/queries";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { logActivity } from "@/lib/activity";

const ALL = "__all";
const PRIO_RANK: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

export function LeadsView({ forceKanban }: { forceKanban?: boolean }) {
  const raw = useSearch({ strict: false }) as { garimpo?: string; view?: string };
  const search = forceKanban ? {} : raw;
  const navigate = useNavigate();
  const view = forceKanban ? "kanban" : search.view ?? "tabela";
  const [arch, setArch] = useState<"ativos" | "arquivados">("ativos");
  const active = useLeads();
  const archived = useArchivedLeads(arch === "arquivados" && !forceKanban);
  const { role, session } = useAuth();
  const isAdmin = role === "admin";
  const src = arch === "arquivados" && !forceKanban ? archived : active;
  const leads = src.data;
  const isLoading = src.isLoading;
  const { data: garimpos } = useGarimpos();
  const { data: profiles } = useProfiles();
  const invalidate = useInvalidate();

  const emptyFl = { status: ALL, priority: ALL, city: ALL, niche: ALL, garimpo: ALL, assigned: ALL, site: ALL };
  const [q, setQ] = useState("");
  const [fl, setFl] = useState({ ...emptyFl, garimpo: search.garimpo ?? ALL });
  const [minScore, setMinScore] = useState("");
  const [applied, setApplied] = useState({ q: "", fl: { ...emptyFl, garimpo: search.garimpo ?? ALL }, minScore: "" });
  const runSearch = () => setApplied({ q, fl, minScore });
  const clearFilters = () => {
    setQ(""); setFl(emptyFl); setMinScore("");
    setApplied({ q: "", fl: emptyFl, minScore: "" });
  };
  const [sort, setSort] = useState("score");
  const [form, setForm] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null });
  const [gOpen, setGOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [del, setDel] = useState<Lead | null>(null);
  const [hardDel, setHardDel] = useState<Lead | null>(null);

  const uniq = (k: "city" | "niche") => [...new Set((leads ?? []).map((l) => l[k]).filter(Boolean) as string[])].sort();

  const rows = useMemo(() => {
    const { fl: af, minScore: ms } = applied;
    const term = applied.q.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    const r = (leads ?? []).filter((l) =>
      (!term || [l.company_name, l.niche, l.city, l.neighborhood, l.phone, l.whatsapp, l.instagram_url].some((v) => v?.toLowerCase().includes(term)) ||
        (digits.length >= 4 && [l.phone, l.whatsapp].some((v) => v?.replace(/\D/g, "").includes(digits)))) &&
      (af.status === ALL || l.status === af.status) &&
      (af.priority === ALL || l.priority === af.priority) &&
      (af.city === ALL || l.city === af.city) &&
      (af.niche === ALL || l.niche === af.niche) &&
      (af.garimpo === ALL || l.garimpo_id === af.garimpo) &&
      (af.assigned === ALL || l.assigned_to === af.assigned) &&
      (af.site === ALL || l.website_status === af.site) &&
      (!ms || (l.score ?? -Infinity) >= Number(ms)),
    );
    const t = (v: string | null) => (v ? new Date(v).getTime() : null);
    const nullLast = (a: number | null, b: number | null, dir = 1) => (a == null ? 1 : b == null ? -1 : (a - b) * dir);
    return r.sort((a, b) => {
      switch (sort) {
        case "score": return nullLast(a.score, b.score, -1);
        case "priority": return (PRIO_RANK[a.priority ?? ""] ?? 9) - (PRIO_RANK[b.priority ?? ""] ?? 9);
        case "name": return a.company_name.localeCompare(b.company_name);
        case "date": return t(b.created_at)! - t(a.created_at)!;
        case "last": return nullLast(t(a.last_contact_at), t(b.last_contact_at), -1);
        case "next": return nullLast(t(a.next_followup_at), t(b.next_followup_at));
        default: return 0;
      }
    });
  }, [leads, applied, sort]);

  const archive = async () => {
    if (!del) return;
    const l = del; setDel(null);
    const restoring = !!l.archived_at;
    const { error } = await supabase.from("leads").update(restoring ? { archived_at: null, archived_by: null } : { archived_at: new Date().toISOString(), archived_by: session?.user.id ?? null }).eq("id", l.id);
    if (error) return toast.error(friendlyError(error));
    await logActivity(l.id, restoring ? "restored" : "archived", restoring ? "Lead restaurado" : "Lead arquivado");
    toast.success(restoring ? "Lead restaurado." : "Lead arquivado.");
    invalidate("leads", "activities", `lead-${l.id}`);
  };
  const hardRemove = async () => {
    if (!hardDel) return;
    const l = hardDel; setHardDel(null);
    const { error } = await supabase.from("leads").delete().eq("id", l.id);
    if (error) return toast.error(friendlyError(error));
    toast.success("Lead excluído definitivamente.");
    invalidate("leads", "garimpos", "activities");
  };

  const F = ({ k, label, items }: { k: keyof typeof fl; label: string; items: { value: string; label: string }[] }) => (
    <Select value={fl[k]} onValueChange={(v) => setFl({ ...fl, [k]: v })}>
      <SelectTrigger className={cn("h-9 w-[calc(50%-0.25rem)] sm:w-40", fl[k] !== ALL && "border-gold")}><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}: todos</SelectItem>
        {items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  const setView = (v: "tabela" | "kanban") => navigate({ to: "/leads", search: { garimpo: search.garimpo, view: v === "kanban" ? "kanban" as const : undefined } });

  return (
    <div>
      <PageHeader
        title={forceKanban ? "Pipeline" : "Leads"}
        subtitle={forceKanban ? "Arraste os cards para mudar o status. Salvo automaticamente." : `${rows.length} de ${leads?.length ?? 0} leads${arch === "arquivados" ? " arquivados" : ""}`}
        actions={<>
          {!forceKanban && (
            <div className="flex rounded-md border bg-card p-0.5">
              {(["tabela", "kanban"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={cn("rounded px-3 py-1.5 text-sm capitalize", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{v}</button>
              ))}
            </div>
          )}
          <Button className="bg-gold text-gold-foreground hover:bg-gold/90" onClick={() => setForm({ open: true, lead: null })}><Plus className="mr-1 h-4 w-4" />Cadastrar lead</Button>
        </>}
      />

      {!forceKanban && (
        <div className="mb-3 flex gap-1 text-sm">
          {(["ativos", "arquivados"] as const).map((a) => (
            <button key={a} onClick={() => setArch(a)} className={cn("rounded-md border px-3 py-1 capitalize", arch === a ? "border-foreground bg-card font-medium" : "border-transparent text-muted-foreground")}>{a === "ativos" ? "Ativos" : "Arquivados"}</button>
          ))}
        </div>
      )}
      {isLoading ? <Skeleton className="h-64" /> : arch === "arquivados" && !leads?.length ? (
        <EmptyState title="Nenhum lead arquivado." />
      ) : !leads?.length ? (
        <EmptyState title="Nenhum lead cadastrado ainda." text="Comece registrando um garimpo ou cadastrando seu primeiro lead.">
          <Button variant="outline" onClick={() => setGOpen(true)}>Novo garimpo</Button>
          <Button onClick={() => setForm({ open: true, lead: null })}>Cadastrar lead</Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="mr-1 h-4 w-4" />Importar garimpo — próximo MVP</Button>
        </EmptyState>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <Input placeholder="Buscar empresa, cidade, telefone..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runSearch(); } }} className="h-9 w-full sm:w-64" />
            <F k="status" label="Status" items={LEAD_STATUS} />
            <F k="priority" label="Prioridade" items={PRIORITIES.map((p) => ({ value: p, label: p }))} />
            <Input placeholder="Score mín." inputMode="decimal" value={minScore} onChange={(e) => setMinScore(e.target.value.replace(/[^\d.]/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }} className="h-9 w-[calc(50%-0.25rem)] sm:w-28" />
            <F k="city" label="Cidade" items={uniq("city").map((c) => ({ value: c, label: c }))} />
            <F k="niche" label="Nicho" items={uniq("niche").map((c) => ({ value: c, label: c }))} />
            <F k="garimpo" label="Garimpo" items={(garimpos ?? []).map((g) => ({ value: g.id, label: g.name }))} />
            <F k="assigned" label="Responsável" items={(profiles ?? []).map((p) => ({ value: p.id, label: p.full_name || p.email || "—" }))} />
            <F k="site" label="Site" items={WEBSITE_STATUS} />
            <Button className="h-9 bg-gold text-gold-foreground hover:bg-gold/90" onClick={runSearch}><Search className="mr-1 h-4 w-4" />Buscar</Button>
            <Button variant="outline" className="h-9 bg-card text-foreground" onClick={clearFilters}><X className="mr-1 h-4 w-4" />Limpar filtros</Button>
            {view === "tabela" && (
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="h-9 w-[calc(50%-0.25rem)] sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">Ordenar: Score</SelectItem>
                  <SelectItem value="priority">Ordenar: Prioridade</SelectItem>
                  <SelectItem value="name">Ordenar: Nome</SelectItem>
                  <SelectItem value="date">Ordenar: Data de cadastro</SelectItem>
                  <SelectItem value="last">Ordenar: Último contato</SelectItem>
                  <SelectItem value="next">Ordenar: Próximo follow-up</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {view === "kanban" && arch === "ativos" ? <Kanban leads={rows} /> : !rows.length ? (
            <EmptyState title="Nenhum lead encontrado com esses filtros." />
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-[1200px] text-sm">
                <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>{["Empresa", "Score", "Prior.", "Nicho", "Cidade", "WhatsApp", "Instagram", "Site", "Status", "Responsável", "Último contato", "Próx. follow-up", ""].map((h) => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((l) => {
                    const wa = normalizeBrPhone(l.whatsapp);
                    const overdue = l.next_followup_at && new Date(l.next_followup_at) <= new Date();
                    return (
                      <tr key={l.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="px-3 py-2.5 font-medium"><Link to="/leads/$id" params={{ id: l.id }} className="hover:text-gold">{l.company_name}</Link></td>
                        <td className="px-3 py-2.5"><Score v={l.score} /></td>
                        <td className="px-3 py-2.5"><PriorityBadge p={l.priority} /></td>
                        <td className="px-3 py-2.5">{l.niche ?? "—"}</td>
                        <td className="px-3 py-2.5">{l.city ?? "—"}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{wa ? <span>{l.whatsapp}{!l.whatsapp_confirmed && <span className="ml-1 text-xs text-muted-foreground">(não conf.)</span>}</span> : "—"}</td>
                        <td className="px-3 py-2.5">{l.instagram_url ? <a href={l.instagram_url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">Ver</a> : "—"}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{websiteLabel(l.website_status)}</td>
                        <td className="px-3 py-2.5"><StatusBadge s={l.status} /></td>
                        <td className="px-3 py-2.5">{profileName(profiles, l.assigned_to)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{fmtDate(l.last_contact_at)}</td>
                        <td className={cn("px-3 py-2.5 whitespace-nowrap", overdue && "font-semibold text-gold")}>{fmtDate(l.next_followup_at)}</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <Button asChild size="icon" variant="ghost" aria-label="Abrir ficha"><Link to="/leads/$id" params={{ id: l.id }}><Eye className="h-4 w-4" /></Link></Button>
                          {wa && l.whatsapp_confirmed && <Button asChild size="icon" variant="ghost" aria-label="WhatsApp"><a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /></a></Button>}
                          <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setForm({ open: true, lead: l })}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" aria-label={l.archived_at ? "Restaurar" : "Arquivar"} title={l.archived_at ? "Restaurar" : "Arquivar"} onClick={() => setDel(l)}>{l.archived_at ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</Button>
                          {isAdmin && <Button size="icon" variant="ghost" aria-label="Excluir definitivamente" title="Excluir definitivamente" onClick={() => setHardDel(l)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <LeadForm open={form.open} lead={form.lead} defaultGarimpo={fl.garimpo !== ALL ? fl.garimpo : undefined} onOpenChange={(o) => setForm({ open: o, lead: o ? form.lead : null })} />
      <GarimpoForm open={gOpen} onOpenChange={setGOpen} />
      <ImportSoonDialog open={importOpen} onOpenChange={setImportOpen} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={del?.archived_at ? "Restaurar lead?" : "Arquivar lead?"} text={del?.archived_at ? `"${del?.company_name}" volta para a lista de leads ativos.` : `"${del?.company_name}" sai das listas, mas timeline, notas e origem são mantidas. Pode ser encontrado em Arquivados.`} confirmLabel={del?.archived_at ? "Restaurar" : "Arquivar"} onConfirm={archive} />
      <StrongConfirmDialog open={!!hardDel} onOpenChange={(o) => !o && setHardDel(null)} title="Excluir definitivamente?" text="O lead, suas notas, etiquetas e timeline serão apagados para sempre. Esta ação não pode ser desfeita." phrase={hardDel?.company_name ?? ""} confirmLabel="Excluir definitivamente" onConfirm={hardRemove} />
    </div>
  );
}
