import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AFFILIATE_VAR, applyAffiliate, useAffiliateLink, currentStage, useLeadProgress, useScriptStages, type ScriptStage } from "@/lib/script";
import { fillTemplate, normalizeBrPhone, waLink, type Lead } from "@/lib/crm";
import { logActivity } from "@/lib/activity";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");

/** Messages of a stage, read directly from the Script Comercial data (single source). */
function messagesOf(s: ScriptStage) {
  const out: { key: string; label: string; text: string }[] = [];
  if (s.main_message?.trim()) out.push({ key: "main", label: "Mensagem principal", text: s.main_message });
  (s.variations ?? "").split(/\n\s*---\s*\n/).map((v) => v.trim()).filter(Boolean)
    .forEach((v, i) => out.push({ key: `var${i}`, label: `Variação ${pad(i + 1)}`, text: v }));
  if (s.if_no_reply?.trim()) out.push({ key: "noreply", label: "Se não responder (follow-up)", text: s.if_no_reply });
  return out;
}

export function LeadScriptCard({ lead }: { lead: Lead }) {
  const { data: all, isLoading } = useScriptStages();
  const { data: prog } = useLeadProgress(lead.id);
  const stages = (all ?? []).filter((s) => s.is_active);
  const done = new Set((prog ?? []).map((p) => p.stage_id));
  const cur = currentStage(stages, done);

  const [stageId, setStageId] = useState<string | null>(null);
  const [msgKey, setMsgKey] = useState<string>("main");
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);

  const selStage = stages.find((s) => s.id === stageId) ?? cur ?? stages[0] ?? null;
  const msgs = useMemo(() => (selStage ? messagesOf(selStage) : []), [selStage]);
  const selMsg = msgs.find((m) => m.key === msgKey) ?? msgs[0] ?? null;
  const affQ = useAffiliateLink();
  const aff = affQ.data?.affiliate_link?.trim() || null;
  const filled = selMsg ? applyAffiliate(fillTemplate(selMsg.text, lead), aff) : "";
  const missingAff = !aff && affQ.isFetched && !!selMsg?.text.includes(AFFILIATE_VAR);
  const copyAff = async () => {
    if (!aff) return;
    try { await navigator.clipboard.writeText(aff); toast.success("Link copiado."); } catch { toast.error("Não foi possível copiar."); }
  };

  // Reset the one-off edit whenever the chosen message changes (template stays untouched).
  useEffect(() => { setText(filled); setEditing(false); }, [filled]);

  const waNum = lead.whatsapp_confirmed ? normalizeBrPhone(lead.whatsapp) ?? normalizeBrPhone(lead.phone) : normalizeBrPhone(lead.whatsapp) ?? normalizeBrPhone(lead.phone);
  const usingPhone = !lead.whatsapp_confirmed && !!waNum;

  const send = async () => {
    if (!waNum || !selStage || !selMsg || !text.trim()) return;
    window.open(waLink(waNum, text), "_blank", "noopener");
    await logActivity(lead.id, "whatsapp_message_opened", "Mensagem do Script Comercial aberta no WhatsApp.", {
      stage_id: selStage.id, stage: `${pad(stages.indexOf(selStage) + 1)} — ${selStage.name}`,
      message: selMsg.label, edited: text !== filled, number: waNum,
    });
  };

  const pick = (id: string) => { setStageId(id); setMsgKey("main"); };

  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Script comercial</h2>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : !stages.length ? (
        <p className="text-sm text-muted-foreground">Nenhuma etapa ativa no script.</p>
      ) : (
        <>
          <div className="text-sm">Etapa atual: <span className="font-semibold">{cur ? `${pad(stages.indexOf(cur) + 1)} — ${cur.name}` : "Todas concluídas"}</span></div>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap">
            {stages.map((s, i) => {
              const d = done.has(s.id); const c = cur?.id === s.id; const on = selStage?.id === s.id;
              return (
                <button type="button" key={s.id} title={s.name} onClick={() => pick(s.id)}
                  className={cn("flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                    d ? "bg-gold text-gold-foreground" : c ? "border-2 border-gold" : "bg-muted text-muted-foreground",
                    on && "ring-2 ring-foreground/60 ring-offset-1")}>
                  {d ? <Check className="h-3.5 w-3.5" /> : c ? `${i + 1} ATUAL` : i + 1}
                </button>
              );
            })}
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Etapa para usar</div>
              <Select value={selStage?.id} onValueChange={pick}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{stages.map((s, i) => <SelectItem key={s.id} value={s.id}>{pad(i + 1)} — {s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {msgs.length ? (
              <>
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">Mensagem</div>
                  <Select value={selMsg?.key} onValueChange={setMsgKey}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{msgs.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Prévia</span>
                    <button type="button" className="underline hover:text-foreground" onClick={() => { if (editing) setText(filled); setEditing(!editing); }}>
                      {editing ? "Desfazer edição" : "Editar antes de enviar"}
                    </button>
                  </div>
                  {editing
                    ? <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} />
                    : <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 text-sm">{text}</p>}
                </div>
              </>
            ) : <p className="text-sm text-muted-foreground">Esta etapa não tem mensagens cadastradas.</p>}

            {missingAff && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs">
                <span>Link de afiliado não configurado.</span>
                <Link to="/configuracoes" search={{ tab: "link" }} className="font-medium underline">Configurar link</Link>
              </div>
            )}
            {!waNum ? <p className="text-xs text-muted-foreground">Telefone não disponível.</p>
              : usingPhone && <p className="text-xs text-muted-foreground">WhatsApp não confirmado. Será usado o telefone como tentativa.</p>}
          </div>

          <Button onClick={send} disabled={!waNum || !selMsg || !text.trim()} className="mt-4 w-full bg-gold text-gold-foreground hover:bg-gold/90">
            <MessageCircle className="mr-1.5 h-4 w-4" />Enviar no WhatsApp
          </Button>
          {aff && (
            <button type="button" onClick={copyAff} className="mt-2 flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Copy className="h-3.5 w-3.5" />Copiar link de afiliado
            </button>
          )}
          <Button asChild variant="outline" className="mt-2 w-full">
            <Link to="/script-comercial" search={{ lead: lead.id }}>Abrir roteiro</Link>
          </Button>
        </>
      )}
    </section>
  );
}
