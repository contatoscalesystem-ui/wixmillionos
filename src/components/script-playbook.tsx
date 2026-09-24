import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowRight, ArrowUp, Check, Copy, ExternalLink, MessageCircle, Pencil, Plus, Send, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog, EmptyState } from "@/components/crm";
import { LEAD_STATUS, fillTemplate, friendlyError, normalizeBrPhone, statusLabel, waLink, type Lead, type LeadStatus } from "@/lib/crm";
import { logActivity } from "@/lib/activity";
import { useInvalidate } from "@/lib/queries";
import {
  MATERIAL_TYPES, currentStage, materialsOf, useLeadProgress, useScriptObjections, useScriptStages,
  type Material, type Scope, type ScriptObjection, type ScriptStage,
} from "@/lib/script";

const pad = (n: number) => String(n).padStart(2, "0");
const NONE = "__none";

export function ScriptPlaybook({ lead, scope = "workspace", editable = false, onLeadChanged }: {
  lead?: Lead | null; scope?: Scope; editable?: boolean; onLeadChanged?: () => void;
}) {
  const invalidate = useInvalidate();
  const stagesQ = useScriptStages(scope);
  const objQ = useScriptObjections(scope);
  const progQ = useLeadProgress(lead?.id);
  const all = stagesQ.data ?? [];
  const stages = editable ? all : all.filter((s) => s.is_active);
  const done = useMemo(() => new Set((progQ.data ?? []).map((p) => p.stage_id)), [progQ.data]);
  const current = lead ? currentStage(all, done) : null;
  const [selId, setSelId] = useState<string | null>(null);
  const [editStage, setEditStage] = useState<Partial<ScriptStage> | null>(null);
  const [editObj, setEditObj] = useState<Partial<ScriptObjection> | null>(null);
  const [suggest, setSuggest] = useState<LeadStatus | null>(null);

  useEffect(() => {
    if (selId && stages.some((s) => s.id === selId)) return;
    setSelId(current?.id ?? stages[0]?.id ?? null);
  }, [stages, current?.id, selId]);

  const sel = stages.find((s) => s.id === selId) ?? null;
  const fill = (t?: string | null) => (t ? (lead ? fillTemplate(t, lead) : t) : "");
  const waNum = lead ? normalizeBrPhone(lead.whatsapp) ?? normalizeBrPhone(lead.phone) : null;
  const stageNo = (s: ScriptStage) => pad(stages.indexOf(s) + 1);
  const refreshLead = () => { invalidate("lead_script_progress", `acts-${lead?.id}`, "activities"); };

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Mensagem copiada.");
    if (lead && sel) { await logActivity(lead.id, "script_copied", `Script — ${stageNo(sel)} ${sel.name}: ${label} copiada`, { stage_id: sel.id, text }); refreshLead(); }
  };
  const openWa = async (text: string) => {
    if (!lead || !waNum || !sel) return;
    if (!lead.whatsapp_confirmed && !window.confirm("Este número ainda não foi confirmado como WhatsApp. Abrir mesmo assim?")) return;
    window.open(waLink(waNum, text), "_blank", "noopener");
    await logActivity(lead.id, "whatsapp_opened", `WhatsApp aberto com a mensagem da etapa ${stageNo(sel)} — ${sel.name}`, { stage_id: sel.id, number: waNum });
    refreshLead();
  };
  const markSent = async (text: string) => {
    if (!lead || !sel) return;
    await logActivity(lead.id, "script_sent", `Script — ${stageNo(sel)} ${sel.name}: mensagem marcada como enviada`, { stage_id: sel.id, text });
    toast.success("Mensagem marcada como enviada.");
    refreshLead();
  };
  const next = () => {
    if (!sel) return;
    const i = stages.indexOf(sel);
    if (stages[i + 1]) setSelId(stages[i + 1].id);
  };
  const complete = async () => {
    if (!lead || !sel) return;
    const { error } = await supabase.from("lead_script_progress").insert({ lead_id: lead.id, stage_id: sel.id });
    if (error) return toast.error(friendlyError(error));
    await logActivity(lead.id, "script_stage_done", `Script — etapa ${stageNo(sel)} ${sel.name} concluída`, { stage_id: sel.id });
    toast.success("Etapa concluída.");
    refreshLead();
    if (sel.suggested_status && sel.suggested_status !== lead.status) setSuggest(sel.suggested_status);
    next();
  };
  const undo = async (s: ScriptStage) => {
    if (!lead) return;
    const { error } = await supabase.from("lead_script_progress").delete().eq("lead_id", lead.id).eq("stage_id", s.id);
    if (error) return toast.error(friendlyError(error));
    await logActivity(lead.id, "script_stage_undone", `Script — etapa ${stageNo(s)} ${s.name} desmarcada`, { stage_id: s.id });
    refreshLead();
  };
  const applyStatus = async () => {
    const to = suggest; setSuggest(null);
    if (!lead || !to) return;
    if (to === "convertido") {
      const { error } = await supabase.rpc("convert_lead_to_client", { _lead_id: lead.id });
      if (error) return toast.error(friendlyError(error));
      toast.success("Lead convertido em cliente.");
      invalidate("clients");
    } else {
      const { error } = await supabase.from("leads").update({ status: to }).eq("id", lead.id);
      if (error) return toast.error(friendlyError(error));
      await logActivity(lead.id, to === "link_enviado" ? "link_sent" : "status_changed", `Status alterado de ${statusLabel(lead.status)} para ${statusLabel(to)} (script comercial)`, { from: lead.status, to });
      toast.success("Status atualizado.");
    }
    invalidate(`lead-${lead.id}`, "leads");
    refreshLead(); onLeadChanged?.();
  };

  // ---- editing ----
  const table = "script_stages" as const;
  const move = async (s: ScriptStage, dir: -1 | 1) => {
    const i = all.indexOf(s); const o = all[i + dir];
    if (!o) return;
    const a = await supabase.from(table).update({ position: o.position }).eq("id", s.id);
    const b = await supabase.from(table).update({ position: s.position }).eq("id", o.id);
    if (a.error || b.error) return toast.error(friendlyError(a.error ?? b.error));
    if (s.position === o.position) await supabase.from(table).update({ position: s.position + dir }).eq("id", s.id);
    invalidate("script_stages");
  };
  const toggleStage = async (s: ScriptStage) => {
    const { error } = await supabase.from(table).update({ is_active: !s.is_active }).eq("id", s.id);
    if (error) return toast.error(friendlyError(error));
    invalidate("script_stages");
  };

  if (stagesQ.isLoading) return <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Carregando script...</div>;
  if (stagesQ.error) return <EmptyState title="Não foi possível carregar o script." text={friendlyError(stagesQ.error)} />;

  const doneCount = stages.filter((s) => done.has(s.id)).length;

  return (
    <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)_300px]">
      {/* ETAPAS */}
      <aside className="rounded-lg border bg-card p-3 lg:self-start">
        <div className="mb-2 flex items-center justify-between px-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Etapas</h2>
          {lead && <span className="text-xs text-muted-foreground">{doneCount}/{stages.length}</span>}
        </div>
        {lead && <div className="mx-2 mb-3 h-1.5 overflow-hidden rounded bg-muted"><div className="h-full bg-gold transition-all" style={{ width: `${stages.length ? (doneCount / stages.length) * 100 : 0}%` }} /></div>}
        {!stages.length && <p className="px-2 py-3 text-sm text-muted-foreground">Nenhuma etapa cadastrada.</p>}
        <ul className="space-y-1">
          {stages.map((s) => {
            const isDone = done.has(s.id); const isCur = current?.id === s.id; const isSel = sel?.id === s.id;
            return (
              <li key={s.id}>
                <button onClick={() => setSelId(s.id)}
                  className={"flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left text-sm transition-colors " +
                    (isSel ? "border-gold bg-gold-soft" : "border-transparent hover:bg-muted") + (s.is_active ? "" : " opacity-50")}>
                  <span className={"flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold " +
                    (isDone ? "bg-gold text-gold-foreground" : isCur ? "border-2 border-gold text-foreground" : "bg-muted text-muted-foreground")}>
                    {isDone ? <Check className="h-3.5 w-3.5" /> : pad(stages.indexOf(s) + 1)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  {isCur && <span className="text-[10px] font-semibold uppercase text-gold">Atual</span>}
                </button>
                {editable && isSel && (
                  <div className="mt-1 flex flex-wrap gap-1 px-1 pb-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => move(s, -1)} aria-label="Subir"><ArrowUp className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => move(s, 1)} aria-label="Descer"><ArrowDown className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditStage(s)}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => toggleStage(s)}>{s.is_active ? "Desativar" : "Ativar"}</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {editable && <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setEditStage({ position: (all.at(-1)?.position ?? 0) + 1, is_active: true })}><Plus className="mr-1 h-4 w-4" />Nova etapa</Button>}
      </aside>

      {/* CONTEÚDO */}
      <main className="min-w-0 space-y-4">
        {!sel ? <EmptyState title="Selecione uma etapa." /> : (
          <>
            <div className="rounded-lg border bg-card p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Etapa {stageNo(sel)}</div>
              <h2 className="mt-1 text-xl font-semibold">{sel.name}</h2>
              {!sel.is_active && <p className="mt-1 text-xs text-muted-foreground">Etapa desativada — não aparece no roteiro dos leads.</p>}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Objetivo" text={sel.objective} />
                <Field label="Quando usar" text={sel.when_to_use} />
              </div>
            </div>

            <MessageCard title="Mensagem principal" text={fill(sel.main_message)} lead={lead} waNum={waNum}
              onCopy={(t) => copy(t, "mensagem principal")} onWa={openWa} onSent={markSent} onNext={next} primary />
            {(sel.variations ?? "").split(/\n\s*---\s*\n/).map((v) => v.trim()).filter(Boolean).map((v, i) => (
              <MessageCard key={i} title={`Variação ${i + 1}`} text={fill(v)} lead={lead} waNum={waNum}
                onCopy={(t) => copy(t, `variação ${i + 1}`)} onWa={openWa} onSent={markSent} />
            ))}

            {materialsOf(sel).length > 0 && (
              <div className="rounded-lg border bg-card p-5">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Materiais</h3>
                <ul className="space-y-2">
                  {materialsOf(sel).map((m, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate"><span className="mr-2 rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground">{m.type}</span>{m.label || m.url}</span>
                      <span className="flex shrink-0 gap-1">
                        <Button size="sm" variant="outline" onClick={() => copy(m.url, `material "${m.label || m.type}"`)}><Copy className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="outline" asChild><a href={m.url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border bg-card p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Resposta esperada" text={sel.expected_response} />
                <Field label="Se responder sim" text={sel.if_yes} />
                <Field label="Se responder não" text={sel.if_no} />
                <Field label="Se não responder" text={sel.if_no_reply} />
              </div>
            </div>

            {lead && (
              <div className="flex flex-wrap items-center gap-2">
                {done.has(sel.id) ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-gold"><Check className="h-4 w-4" />Etapa concluída</span>
                    <Button size="sm" variant="ghost" onClick={() => undo(sel)}><Undo2 className="mr-1 h-4 w-4" />Desmarcar</Button>
                  </>
                ) : (
                  <Button className="bg-gold text-gold-foreground hover:bg-gold/90" onClick={complete}><Check className="mr-1 h-4 w-4" />Marcar etapa como concluída</Button>
                )}
                {sel.suggested_status === "link_enviado" && lead.status !== "link_enviado" && (
                  <Button variant="outline" onClick={() => setSuggest("link_enviado")}>Marcar link enviado</Button>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* OBJEÇÕES / PRÓXIMOS PASSOS */}
      <aside className="space-y-4 lg:self-start">
        {sel && (
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Próximo passo</h3>
            <p className="whitespace-pre-wrap text-sm">{sel.next_step || "—"}</p>
            {sel.suggested_status && <p className="mt-3 text-xs text-muted-foreground">Status recomendado: <span className="font-medium text-foreground">{statusLabel(sel.suggested_status)}</span></p>}
            {stages[stages.indexOf(sel) + 1] && <Button size="sm" variant="outline" className="mt-3 w-full" onClick={next}>Ir para a próxima etapa<ArrowRight className="ml-1 h-4 w-4" /></Button>}
          </div>
        )}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Objeções</h3>
            {editable && <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditObj({ position: ((objQ.data ?? []).at(-1)?.position ?? 0) + 1, is_active: true })}><Plus className="h-4 w-4" /></Button>}
          </div>
          {!(objQ.data ?? []).length && <p className="text-sm text-muted-foreground">Nenhuma objeção cadastrada.</p>}
          <div className="space-y-2">
            {(objQ.data ?? []).filter((o) => editable || o.is_active).map((o) => (
              <details key={o.id} className={"group rounded-md border px-3 py-2" + (o.is_active ? "" : " opacity-50")}>
                <summary className="cursor-pointer list-none text-sm font-medium">{o.category}</summary>
                <div className="mt-2 space-y-3 text-sm">
                  {o.objection && <p className="italic text-muted-foreground">“{fill(o.objection)}”</p>}
                  {([["Resposta curta", o.short_answer], ["Resposta média", o.medium_answer], ["Pergunta estratégica", o.strategic_question]] as const).map(([l, t]) => t && (
                    <div key={l}>
                      <div className="flex items-center justify-between"><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{l}</span>
                        <button className="text-muted-foreground hover:text-foreground" aria-label={`Copiar ${l}`} onClick={() => copy(fill(t), `objeção "${o.category}" (${l.toLowerCase()})`)}><Copy className="h-3.5 w-3.5" /></button></div>
                      <p className="whitespace-pre-wrap">{fill(t)}</p>
                    </div>
                  ))}
                  {o.stop_when && <p className="text-xs text-muted-foreground"><span className="font-semibold">Parar de insistir:</span> {o.stop_when}</p>}
                  {editable && <Button size="sm" variant="outline" onClick={() => setEditObj(o)}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button>}
                </div>
              </details>
            ))}
          </div>
        </div>
      </aside>

      <StageDialog value={editStage} scope={scope} onClose={() => setEditStage(null)} />
      <ObjectionDialog value={editObj} scope={scope} onClose={() => setEditObj(null)} />
      <ConfirmDialog open={!!suggest} onOpenChange={(o) => !o && setSuggest(null)} title="Atualizar status do lead?"
        text={suggest === "convertido" ? `Um cliente será criado a partir de "${lead?.company_name}" e o lead ficará como Convertido.` : `Status sugerido para esta etapa: ${statusLabel(suggest)}. Status atual: ${statusLabel(lead?.status)}.`}
        confirmLabel={suggest === "convertido" ? "Converter" : "Atualizar status"} onConfirm={applyStatus} />
    </div>
  );
}

function Field({ label, text }: { label: string; text?: string | null }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <p className="mt-1 whitespace-pre-wrap text-sm">{text || "—"}</p>
    </div>
  );
}

function MessageCard({ title, text, lead, waNum, onCopy, onWa, onSent, onNext, primary }: {
  title: string; text: string; lead?: Lead | null; waNum: string | null; primary?: boolean;
  onCopy: (t: string) => void; onWa: (t: string) => void; onSent: (t: string) => void; onNext?: () => void;
}) {
  if (!text) return null;
  return (
    <div className={"rounded-lg border bg-card p-5" + (primary ? " border-gold/40" : "")}>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</h3>
      <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-4 text-sm leading-relaxed">{text}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" className={primary ? "bg-gold text-gold-foreground hover:bg-gold/90" : ""} variant={primary ? "default" : "outline"} onClick={() => onCopy(text)}><Copy className="mr-1 h-4 w-4" />Copiar</Button>
        {lead && <Button size="sm" variant="outline" disabled={!waNum} title={waNum ? undefined : "Lead sem telefone"} onClick={() => onWa(text)}><MessageCircle className="mr-1 h-4 w-4" />Abrir no WhatsApp</Button>}
        {lead && <Button size="sm" variant="outline" onClick={() => onSent(text)}><Send className="mr-1 h-4 w-4" />Marcar como enviada</Button>}
        {onNext && <Button size="sm" variant="ghost" onClick={onNext}>Próxima etapa<ArrowRight className="ml-1 h-4 w-4" /></Button>}
      </div>
    </div>
  );
}

const STAGE_FIELDS = [
  ["objective", "Objetivo"], ["when_to_use", "Quando usar"], ["main_message", "Mensagem principal"],
  ["variations", "Variações (separe cada uma com uma linha contendo ---)"], ["expected_response", "Resposta esperada"],
  ["if_yes", "Se responder sim"], ["if_no", "Se responder não"], ["if_no_reply", "Se não responder"], ["next_step", "Próximo passo"],
] as const;

function StageDialog({ value, scope, onClose }: { value: Partial<ScriptStage> | null; scope: Scope; onClose: () => void }) {
  const invalidate = useInvalidate();
  const [f, setF] = useState<Partial<ScriptStage>>({});
  const [mats, setMats] = useState<Material[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (value) { setF(value); setMats(value.id ? materialsOf(value as ScriptStage) : []); } }, [value]);
  const save = async () => {
    if (!f.name?.trim()) return toast.error("Informe o nome da etapa.");
    const payload = {
      name: f.name.trim(), position: f.position ?? 0, is_active: f.is_active ?? true,
      suggested_status: f.suggested_status ?? null,
      materials: mats.filter((m) => m.url.trim()),
      ...Object.fromEntries(STAGE_FIELDS.map(([k]) => [k, (f[k] as string | null | undefined)?.trim() || null])),
    };
    setBusy(true);
    const { error } = f.id
      ? await supabase.from("script_stages").update(payload).eq("id", f.id)
      : await supabase.from("script_stages").insert(scope === "global" ? { ...payload, workspace_id: null } : payload);
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Etapa salva.");
    invalidate("script_stages"); onClose();
  };
  const remove = async () => {
    if (!f.id || !window.confirm(`Excluir a etapa "${f.name}"? O progresso dos leads nesta etapa também será removido.`)) return;
    const { error } = await supabase.from("script_stages").delete().eq("id", f.id);
    if (error) return toast.error(friendlyError(error));
    toast.success("Etapa excluída.");
    invalidate("script_stages", "lead_script_progress"); onClose();
  };
  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Editar etapa" : "Nova etapa"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nome da etapa *</Label><Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <p className="text-xs text-muted-foreground">Variáveis: [NOME_DA_EMPRESA], [NICHO], [CIDADE].</p>
          {STAGE_FIELDS.map(([k, l]) => (
            <div key={k} className="space-y-1.5"><Label>{l}</Label>
              <Textarea rows={k === "main_message" || k === "variations" ? 6 : 2} value={(f[k] as string | null) ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
          ))}
          <div className="space-y-1.5"><Label>Status sugerido ao concluir</Label>
            <Select value={f.suggested_status ?? NONE} onValueChange={(v) => setF({ ...f, suggested_status: v === NONE ? null : (v as LeadStatus) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={NONE}>Nenhum</SelectItem>{LEAD_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-2"><Label>Materiais (vídeo, link, PDF, imagens, portfólio)</Label>
            {mats.map((m, i) => (
              <div key={i} className="flex gap-2">
                <Select value={m.type} onValueChange={(v) => setMats(mats.map((x, j) => (j === i ? { ...x, type: v } : x)))}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{MATERIAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Nome" value={m.label} onChange={(e) => setMats(mats.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <Input placeholder="https://..." value={m.url} onChange={(e) => setMats(mats.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                <Button variant="ghost" onClick={() => setMats(mats.filter((_, j) => j !== i))}>×</Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setMats([...mats, { type: "Vídeo", label: "", url: "" }])}><Plus className="mr-1 h-4 w-4" />Adicionar material</Button>
          </div>
          <div className="flex items-center gap-2"><Switch id="st-act" checked={f.is_active ?? true} onCheckedChange={(v) => setF({ ...f, is_active: v })} /><Label htmlFor="st-act">Etapa ativa</Label></div>
        </div>
        <DialogFooter className="gap-2">
          {f.id && <Button variant="outline" className="mr-auto" onClick={remove}>Excluir</Button>}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const OBJ_FIELDS = [
  ["objection", "Objeção (o que o lead diz)"], ["short_answer", "Resposta curta"], ["medium_answer", "Resposta média"],
  ["strategic_question", "Pergunta estratégica"], ["stop_when", "Quando parar de insistir"],
] as const;

function ObjectionDialog({ value, scope, onClose }: { value: Partial<ScriptObjection> | null; scope: Scope; onClose: () => void }) {
  const invalidate = useInvalidate();
  const [f, setF] = useState<Partial<ScriptObjection>>({});
  useEffect(() => { if (value) setF(value); }, [value]);
  const save = async () => {
    if (!f.category?.trim()) return toast.error("Informe a categoria.");
    const payload = {
      category: f.category.trim(), position: f.position ?? 0, is_active: f.is_active ?? true,
      ...Object.fromEntries(OBJ_FIELDS.map(([k]) => [k, (f[k] as string | null | undefined)?.trim() || null])),
    };
    const { error } = f.id
      ? await supabase.from("script_objections").update(payload).eq("id", f.id)
      : await supabase.from("script_objections").insert(scope === "global" ? { ...payload, workspace_id: null } : payload);
    if (error) return toast.error(friendlyError(error));
    toast.success("Objeção salva.");
    invalidate("script_objections"); onClose();
  };
  const remove = async () => {
    if (!f.id || !window.confirm(`Excluir a objeção "${f.category}"?`)) return;
    const { error } = await supabase.from("script_objections").delete().eq("id", f.id);
    if (error) return toast.error(friendlyError(error));
    invalidate("script_objections"); onClose();
  };
  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Editar objeção" : "Nova objeção"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Categoria *</Label><Input value={f.category ?? ""} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
          {OBJ_FIELDS.map(([k, l]) => (
            <div key={k} className="space-y-1.5"><Label>{l}</Label><Textarea rows={3} value={(f[k] as string | null) ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
          ))}
          <div className="flex items-center gap-2"><Switch id="ob-act" checked={f.is_active ?? true} onCheckedChange={(v) => setF({ ...f, is_active: v })} /><Label htmlFor="ob-act">Ativa</Label></div>
        </div>
        <DialogFooter className="gap-2">
          {f.id && <Button variant="outline" className="mr-auto" onClick={remove}>Excluir</Button>}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
