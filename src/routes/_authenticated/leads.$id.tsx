import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { addDays, format } from "date-fns";
import { ArrowLeft, Calendar, Copy, Globe, Instagram, MapPin, MessageCircle, Pencil, Send, Trash2, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog, EmptyState, Info, PriorityBadge, Score, StatusBadge } from "@/components/crm";
import { LeadForm } from "@/components/lead-form";
import { LEAD_STATUS, fillTemplate, fmtDate, friendlyError, normalizeBrPhone, statusLabel, waLink, websiteLabel, type Lead, type LeadStatus } from "@/lib/crm";
import { ACTIVITY_LABEL, logActivity } from "@/lib/activity";
import { profileName, useGarimpos, useInvalidate, useProfiles, useTags, useTemplates } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/leads/$id")({
  head: () => ({
    meta: [
      { title: "Ficha do lead — WIX MILLION OS" },
      { name: "description", content: "Ficha completa do lead: dados, presença digital, abordagem, notas e timeline." },
      { property: "og:title", content: "Ficha do lead — WIX MILLION OS" },
      { property: "og:description", content: "Ficha completa do lead." },
    ],
  }),
  component: LeadPage,
});

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={"rounded-lg border bg-card p-5 " + (className ?? "")}>
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function LeadPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  const { data: profiles } = useProfiles();
  const { data: garimpos } = useGarimpos();

  const leadQ = useQuery({
    queryKey: [`lead-${id}`],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const lead = leadQ.data;
  const refresh = () => invalidate(`lead-${id}`, "leads", `acts-${id}`, "activities");

  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const [waConfirm, setWaConfirm] = useState<string | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [projectAsk, setProjectAsk] = useState<string | null>(null);

  if (leadQ.isLoading) return <Skeleton className="h-96" />;
  if (!lead) return <EmptyState title="Lead não encontrado." text="Ele pode ter sido excluído."><Button asChild><Link to="/leads">Voltar para Leads</Link></Button></EmptyState>;

  const waNum = normalizeBrPhone(lead.whatsapp) ?? normalizeBrPhone(lead.phone);
  const openWa = async (text?: string, force = false) => {
    if (!waNum) return;
    const url = waLink(waNum, text);
    if (!lead.whatsapp_confirmed && !force) { setWaConfirm(url); return; }
    window.open(url, "_blank", "noopener");
    await logActivity(lead.id, "whatsapp_opened", "WhatsApp aberto", { number: waNum, with_message: !!text });
    invalidate(`acts-${id}`, "activities");
  };

  const updateLead = async (patch: Partial<Lead>) => {
    const { error } = await supabase.from("leads").update(patch).eq("id", lead.id);
    if (error) { toast.error(friendlyError(error)); return false; }
    return true;
  };

  const changeStatus = async (to: LeadStatus) => {
    if (to === lead.status) return;
    const patch: Partial<Lead> = { status: to };
    if (to === "convertido" && !lead.converted_at) patch.converted_at = new Date().toISOString();
    if (!(await updateLead(patch))) return;
    await logActivity(lead.id, to === "link_enviado" ? "link_sent" : "status_changed", `Status alterado de ${statusLabel(lead.status)} para ${statusLabel(to)}`, { from: lead.status, to });
    toast.success("Status atualizado.");
    refresh();
  };

  const convert = async () => {
    setConvertOpen(false);
    const { data: existing } = await supabase.from("clients").select("id").eq("lead_id", lead.id).maybeSingle();
    let clientId = existing?.id;
    if (!clientId) {
      const { data, error } = await supabase.from("clients").insert({
        lead_id: lead.id, company_name: lead.company_name, phone: lead.phone, whatsapp: lead.whatsapp, city: lead.city, state: lead.state,
      }).select("id").single();
      if (error || !data) return toast.error(friendlyError(error));
      clientId = data.id;
    } else toast.info("Este lead já possuía um cliente vinculado.");
    if (!(await updateLead({ status: "convertido", converted_at: lead.converted_at ?? new Date().toISOString() }))) return;
    await logActivity(lead.id, "converted", "Lead convertido em cliente", { client_id: clientId });
    toast.success("Lead convertido em cliente.");
    refresh(); invalidate("clients");
    setProjectAsk(clientId);
  };

  const createProject = async () => {
    const clientId = projectAsk;
    setProjectAsk(null);
    if (!clientId) return;
    const { error } = await supabase.from("site_projects").insert({ client_id: clientId, status: "aguardando" });
    if (error) return toast.error(friendlyError(error));
    await logActivity(lead.id, "project_created", "Projeto de site criado");
    toast.success("Projeto de site criado.");
    invalidate("site_projects", `acts-${id}`, "activities");
  };

  const remove = async () => {
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    if (error) return toast.error(friendlyError(error));
    toast.success("Lead excluído.");
    qc.removeQueries({ queryKey: [`lead-${id}`] });
    invalidate("leads", "garimpos", "activities");
    navigate({ to: "/leads" });
  };

  const garimpo = garimpos?.find((g) => g.id === lead.garimpo_id);

  return (
    <div className="space-y-5">
      <Link to="/leads" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Leads</Link>

      <div className="rounded-lg border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{lead.company_name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">Score <Score v={lead.score} /></span>
              <PriorityBadge p={lead.priority} />
              <StatusBadge s={lead.status} />
              <span className="text-muted-foreground">Responsável: <span className="text-foreground">{profileName(profiles, lead.assigned_to)}</span></span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={lead.status} onValueChange={(v) => changeStatus(v as LeadStatus)}>
              <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{LEAD_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setEdit(true)}><Pencil className="mr-1 h-4 w-4" />Editar</Button>
            <Button variant="outline" size="sm" onClick={() => setDel(true)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {waNum && <Button size="sm" className="bg-gold text-gold-foreground hover:bg-gold/90" onClick={() => openWa()}><MessageCircle className="mr-1 h-4 w-4" />Abrir WhatsApp</Button>}
          {lead.instagram_url && <Button asChild size="sm" variant="outline"><a href={lead.instagram_url} target="_blank" rel="noreferrer"><Instagram className="mr-1 h-4 w-4" />Instagram</a></Button>}
          {lead.google_maps_url && <Button asChild size="sm" variant="outline"><a href={lead.google_maps_url} target="_blank" rel="noreferrer"><MapPin className="mr-1 h-4 w-4" />Google Maps</a></Button>}
          {lead.website_url && <Button asChild size="sm" variant="outline"><a href={lead.website_url} target="_blank" rel="noreferrer"><Globe className="mr-1 h-4 w-4" />Site</a></Button>}
          {lead.scheduling_url && <Button asChild size="sm" variant="outline"><a href={lead.scheduling_url} target="_blank" rel="noreferrer"><Calendar className="mr-1 h-4 w-4" />Agendamento</a></Button>}
          {lead.status !== "convertido" && <Button size="sm" variant="outline" className="border-gold" onClick={() => setConvertOpen(true)}>Converter em cliente</Button>}
        </div>
        {waNum && !lead.whatsapp_confirmed && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5 text-gold" />WhatsApp não confirmado.{!lead.whatsapp && " Será usado o telefone como tentativa."}</p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Section title="Dados do negócio">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Info label="Empresa">{lead.company_name}</Info>
              <Info label="Nicho">{lead.niche}</Info>
              <Info label="Cidade">{lead.city}</Info>
              <Info label="Estado">{lead.state}</Info>
              <Info label="Bairro">{lead.neighborhood}</Info>
              <Info label="Endereço">{lead.address}</Info>
              <Info label="Telefone">{lead.phone}</Info>
              <Info label="WhatsApp">{lead.whatsapp}</Info>
              <Info label="WhatsApp confirmado?">{lead.whatsapp_confirmed ? "Sim" : "Não"}</Info>
            </dl>
          </Section>
          <Section title="Presença digital">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Info label="Instagram">{lead.instagram_url && <a className="underline" href={lead.instagram_url} target="_blank" rel="noreferrer">{lead.instagram_url.replace(/^https?:\/\/(www\.)?/, "")}</a>}</Info>
              <Info label="Seguidores">{lead.instagram_followers?.toLocaleString("pt-BR")}</Info>
              <Info label="Google Maps">{lead.google_maps_url && <a className="underline" href={lead.google_maps_url} target="_blank" rel="noreferrer">Abrir</a>}</Info>
              <Info label="Nota Google">{lead.google_rating}</Info>
              <Info label="Avaliações">{lead.google_reviews?.toLocaleString("pt-BR")}</Info>
              <Info label="Site">{lead.website_url && <a className="underline" href={lead.website_url} target="_blank" rel="noreferrer">{lead.website_url.replace(/^https?:\/\//, "")}</a>}</Info>
              <Info label="Status do site">{websiteLabel(lead.website_status)}</Info>
              <Info label="Agendamento">{lead.scheduling_type}</Info>
              <Info label="Presença digital">{lead.digital_presence}</Info>
              <Info label="Qualidade das fotos">{lead.photo_quality}</Info>
            </dl>
          </Section>
          <Section title="Inteligência do garimpo">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Info label="Posição no garimpo">{lead.position}</Info>
              <Info label="Score"><Score v={lead.score} /></Info>
              <Info label="Prioridade">{lead.priority}</Info>
              <Info label="Garimpo">{garimpo?.name}</Info>
              <Info label="Fonte">{garimpo?.source}</Info>
            </dl>
            <div className="mt-4"><Info label="Observação comercial"><span className="whitespace-pre-wrap">{lead.commercial_observation}</span></Info></div>
            {lead.raw_source_data != null && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs uppercase tracking-wide text-muted-foreground">Dados brutos da pesquisa</summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(lead.raw_source_data, null, 2)}</pre>
              </details>
            )}
          </Section>
          <Approach lead={lead} waNum={waNum} openWa={openWa} onSent={refresh} />
          <Notes leadId={lead.id} />
        </div>
        <div className="space-y-5">
          <FollowUp lead={lead} onSaved={refresh} />
          <Tags leadId={lead.id} />
          <Timeline leadId={lead.id} />
        </div>
      </div>

      <LeadForm open={edit} onOpenChange={setEdit} lead={lead} onSaved={() => refresh()} />
      <ConfirmDialog open={del} onOpenChange={setDel} destructive title="Excluir lead?" text="O lead, notas e timeline serão removidos permanentemente." confirmLabel="Excluir" onConfirm={remove} />
      <ConfirmDialog open={!!waConfirm} onOpenChange={(o) => !o && setWaConfirm(null)} title="WhatsApp não confirmado" text="Este número ainda não foi confirmado como WhatsApp. Deseja abrir mesmo assim como tentativa?" confirmLabel="Abrir mesmo assim"
        onConfirm={async () => { const u = waConfirm; setWaConfirm(null); if (u) { window.open(u, "_blank", "noopener"); await logActivity(lead.id, "whatsapp_opened", "WhatsApp aberto (número não confirmado)", { number: waNum }); invalidate(`acts-${id}`); } }} />
      <ConfirmDialog open={convertOpen} onOpenChange={setConvertOpen} title="Converter em cliente?" text={`Um cliente será criado a partir de "${lead.company_name}" e o lead ficará como Convertido.`} confirmLabel="Converter" onConfirm={convert} />
      <ConfirmDialog open={!!projectAsk} onOpenChange={(o) => !o && setProjectAsk(null)} title="Criar projeto de site agora?" text="O projeto aparecerá em Produção com status Aguardando." confirmLabel="Criar projeto" onConfirm={createProject} />
    </div>
  );
}

function Approach({ lead, waNum, openWa, onSent }: { lead: Lead; waNum: string | null; openWa: (t?: string) => void; onSent: () => void }) {
  const { data: templates } = useTemplates();
  const active = (templates ?? []).filter((t) => t.is_active);
  const [tplId, setTplId] = useState<string>("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!tplId && active[0]) setTplId(active[0].id); }, [active, tplId]);

  const generate = async () => {
    const t = active.find((x) => x.id === tplId);
    if (!t) return;
    setText(fillTemplate(t.content, lead));
    await logActivity(lead.id, "approach_generated", `Mensagem gerada: ${t.name}`, { template_id: t.id });
  };

  const markSent = async () => {
    setBusy(true);
    const { error } = await supabase.from("leads").update({ status: "abordagem_enviada", last_contact_at: new Date().toISOString() }).eq("id", lead.id);
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    await logActivity(lead.id, "approach_sent", "Abordagem inicial enviada", { from: lead.status });
    toast.success("Abordagem registrada.");
    onSent();
  };

  return (
    <Section title="Mensagem de abordagem">
      {!active.length ? <p className="text-sm text-muted-foreground">Nenhum template ativo. Cadastre em Configurações → Templates.</p> : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={tplId} onValueChange={setTplId}>
              <SelectTrigger className="h-9 w-64"><SelectValue placeholder="Template" /></SelectTrigger>
              <SelectContent>{active.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={generate}>Gerar mensagem</Button>
          </div>
          {text && (
            <>
              <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} className="text-sm" />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(text); toast.success("Mensagem copiada."); }}><Copy className="mr-1 h-4 w-4" />Copiar</Button>
                {waNum && <Button size="sm" variant="outline" onClick={() => openWa(text)}><MessageCircle className="mr-1 h-4 w-4" />Abrir no WhatsApp</Button>}
                <Button size="sm" className="bg-gold text-gold-foreground hover:bg-gold/90" disabled={busy} onClick={markSent}><Send className="mr-1 h-4 w-4" />Marcar como enviada</Button>
              </div>
            </>
          )}
        </div>
      )}
    </Section>
  );
}

function FollowUp({ lead, onSaved }: { lead: Lead; onSaved: () => void }) {
  const [custom, setCustom] = useState("");
  const set = async (date: Date | null, label: string) => {
    const v = date ? date.toISOString() : null;
    const { error } = await supabase.from("leads").update({ next_followup_at: v }).eq("id", lead.id);
    if (error) return toast.error(friendlyError(error));
    await logActivity(lead.id, "followup_created", date ? `Retorno agendado para ${format(date, "dd/MM/yyyy")} (${label})` : "Follow-up removido", { next_followup_at: v });
    toast.success(date ? "Retorno agendado." : "Follow-up removido.");
    onSaved();
  };
  const at9 = (d: Date) => { const x = new Date(d); x.setHours(9, 0, 0, 0); return x; };
  const overdue = lead.next_followup_at && new Date(lead.next_followup_at) <= new Date();
  return (
    <Section title="Follow-up">
      <div className="text-sm">Próximo retorno: <span className={overdue ? "font-semibold text-gold" : "font-medium"}>{fmtDate(lead.next_followup_at)}</span></div>
      <div className="text-xs text-muted-foreground">Último contato: {fmtDate(lead.last_contact_at, true)}</div>
      <Popover>
        <PopoverTrigger asChild><Button size="sm" className="mt-3 w-full">Agendar retorno</Button></PopoverTrigger>
        <PopoverContent className="w-64 space-y-1">
          {([["Hoje", 0], ["Amanhã", 1], ["2 dias", 2], ["3 dias", 3], ["7 dias", 7]] as const).map(([l, d]) => (
            <button key={l} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => set(at9(addDays(new Date(), d)), l)}>{l}</button>
          ))}
          <div className="flex gap-1 border-t pt-2">
            <Input type="date" value={custom} onChange={(e) => setCustom(e.target.value)} className="h-8" />
            <Button size="sm" disabled={!custom} onClick={() => set(at9(new Date(custom + "T12:00:00")), "data escolhida")}>OK</Button>
          </div>
          {lead.next_followup_at && <button className="block w-full rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted" onClick={() => set(null, "")}>Remover follow-up</button>}
        </PopoverContent>
      </Popover>
    </Section>
  );
}

function Notes({ leadId }: { leadId: string }) {
  const invalidate = useInvalidate();
  const { data: profiles } = useProfiles();
  const q = useQuery({
    queryKey: [`notes-${leadId}`],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_notes").select("*").eq("lead_id", leadId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const [del, setDel] = useState<string | null>(null);

  const add = async () => {
    if (!text.trim()) return;
    const { error } = await supabase.from("lead_notes").insert({ lead_id: leadId, content: text.trim() });
    if (error) return toast.error(friendlyError(error));
    await logActivity(leadId, "note_created", "Nota adicionada");
    setText("");
    toast.success("Nota adicionada.");
    invalidate(`notes-${leadId}`, `acts-${leadId}`, "activities");
  };
  const saveEdit = async () => {
    if (!editing?.content.trim()) return;
    const { error } = await supabase.from("lead_notes").update({ content: editing.content.trim() }).eq("id", editing.id);
    if (error) return toast.error(friendlyError(error));
    setEditing(null);
    toast.success("Nota atualizada.");
    invalidate(`notes-${leadId}`);
  };
  const remove = async () => {
    const { error } = await supabase.from("lead_notes").delete().eq("id", del!);
    setDel(null);
    if (error) return toast.error(friendlyError(error));
    toast.success("Nota excluída.");
    invalidate(`notes-${leadId}`);
  };

  return (
    <Section title="Notas">
      <div className="flex gap-2">
        <Textarea rows={2} placeholder="Escreva uma nota..." value={text} onChange={(e) => setText(e.target.value)} />
        <Button onClick={add} disabled={!text.trim()}>Adicionar</Button>
      </div>
      <div className="mt-4 space-y-3">
        {q.isLoading ? <Skeleton className="h-12" /> : !q.data?.length ? <p className="text-sm text-muted-foreground">Nenhuma nota ainda.</p> :
          q.data.map((n) => (
            <div key={n.id} className="rounded-md border p-3">
              {editing?.id === n.id ? (
                <div className="space-y-2">
                  <Textarea rows={3} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
                  <div className="flex gap-2"><Button size="sm" onClick={saveEdit}>Salvar</Button><Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button></div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm">{n.content}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{profileName(profiles, n.user_id)} · {fmtDate(n.created_at, true)}{n.updated_at !== n.created_at && " (editada)"}</span>
                    <span className="flex gap-1">
                      <button aria-label="Editar nota" onClick={() => setEditing({ id: n.id, content: n.content })}><Pencil className="h-3.5 w-3.5" /></button>
                      <button aria-label="Excluir nota" onClick={() => setDel(n.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                    </span>
                  </div>
                </>
              )}
            </div>
          ))}
      </div>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} destructive title="Excluir nota?" confirmLabel="Excluir" onConfirm={remove} />
    </Section>
  );
}

function Tags({ leadId }: { leadId: string }) {
  const invalidate = useInvalidate();
  const { data: tags } = useTags();
  const linksQ = useQuery({
    queryKey: [`tags-${leadId}`],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_tag_links").select("tag_id").eq("lead_id", leadId);
      if (error) throw error;
      return data.map((d) => d.tag_id);
    },
  });
  const [newTag, setNewTag] = useState("");
  const linked = new Set(linksQ.data ?? []);

  const add = async (tagId: string, name: string) => {
    const { error } = await supabase.from("lead_tag_links").insert({ lead_id: leadId, tag_id: tagId });
    if (error) return toast.error(friendlyError(error));
    await logActivity(leadId, "tag_added", `Etiqueta adicionada: ${name}`);
    invalidate(`tags-${leadId}`, `acts-${leadId}`);
  };
  const removeTag = async (tagId: string) => {
    const { error } = await supabase.from("lead_tag_links").delete().eq("lead_id", leadId).eq("tag_id", tagId);
    if (error) return toast.error(friendlyError(error));
    invalidate(`tags-${leadId}`);
  };
  const create = async () => {
    const name = newTag.trim();
    if (!name) return;
    const existing = tags?.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) { setNewTag(""); if (!linked.has(existing.id)) await add(existing.id, existing.name); return; }
    const { data, error } = await supabase.from("lead_tags").insert({ name }).select("id").single();
    if (error || !data) return toast.error(friendlyError(error));
    setNewTag("");
    await invalidate("lead_tags");
    await add(data.id, name);
  };

  return (
    <Section title="Etiquetas">
      <div className="flex flex-wrap gap-1.5">
        {(tags ?? []).filter((t) => linked.has(t.id)).map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1 rounded-full border border-gold/50 bg-gold-soft px-2.5 py-0.5 text-xs font-medium">
            {t.name}<button aria-label={`Remover ${t.name}`} onClick={() => removeTag(t.id)}><X className="h-3 w-3" /></button>
          </span>
        ))}
        {!linked.size && <span className="text-sm text-muted-foreground">Sem etiquetas.</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(tags ?? []).filter((t) => !linked.has(t.id)).map((t) => (
          <button key={t.id} onClick={() => add(t.id, t.name)} className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:border-foreground hover:text-foreground">+ {t.name}</button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Input className="h-8" placeholder="Nova etiqueta" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
        <Button size="sm" variant="outline" onClick={create} disabled={!newTag.trim()}>Criar</Button>
      </div>
    </Section>
  );
}

function Timeline({ leadId }: { leadId: string }) {
  const { data: profiles } = useProfiles();
  const q = useQuery({
    queryKey: [`acts-${leadId}`],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_activities").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });
  return (
    <Section title="Timeline">
      {q.isLoading ? <Skeleton className="h-24" /> : !q.data?.length ? <p className="text-sm text-muted-foreground">Sem atividades.</p> : (
        <ol className="space-y-3 border-l pl-4">
          {q.data.map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-gold" />
              <div className="text-xs font-semibold">{ACTIVITY_LABEL[a.activity_type] ?? a.activity_type}</div>
              <div className="text-sm">{a.description}</div>
              <div className="text-xs text-muted-foreground">{profileName(profiles, a.user_id)} · {fmtDate(a.created_at, true)}</div>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
