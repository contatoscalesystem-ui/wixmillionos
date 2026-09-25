import { useState } from "react";
import { toast } from "sonner";
import { Copy, Phone, PhoneCall } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/crm";
import { logActivity } from "@/lib/activity";
import { callNumber, friendlyError, statusLabel, type Lead, type LeadStatus } from "@/lib/crm";

type Result = "call_answered" | "call_no_answer" | "call_busy" | "call_invalid_number" | "call_callback" | "call_not_interested" | "call_interested";
const RESULTS: { v: Result; label: string; text: string }[] = [
  { v: "call_answered", label: "Atendeu", text: "Lead atendeu a ligação." },
  { v: "call_no_answer", label: "Não atendeu", text: "Lead não atendeu a ligação." },
  { v: "call_busy", label: "Ocupado", text: "Ligação deu ocupado." },
  { v: "call_invalid_number", label: "Número inválido", text: "Número inválido para ligação." },
  { v: "call_callback", label: "Pediu retorno", text: "Lead pediu retorno por ligação." },
  { v: "call_not_interested", label: "Não tem interesse", text: "Lead não tem interesse (ligação)." },
  { v: "call_interested", label: "Interessado", text: "Lead interessado (ligação)." },
];

type CallLead = Pick<Lead, "id" | "phone" | "whatsapp" | "status">;

/** LIGAR: opens the device dialer with 015DDDNÚMERO via tel:, logs CALL_OPENED, then lets the user record the result. */
export function CallButton({ lead, onChanged, size = "sm", variant = "outline", showCopy = true }: {
  lead: CallLead; onChanged?: () => void; size?: "sm" | "default"; variant?: "outline" | "default"; showCopy?: boolean;
}) {
  const original = lead.phone || lead.whatsapp || "";
  const num = callNumber(original);
  const [resultOpen, setResultOpen] = useState(false);
  const [statusAsk, setStatusAsk] = useState<LeadStatus | null>(null);
  const [callback, setCallback] = useState(false);
  const [cbDate, setCbDate] = useState("");
  const [cbTime, setCbTime] = useState("");
  const [cbNote, setCbNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!num) {
    return <Button size={size} variant="outline" disabled className="min-h-11 sm:min-h-9" title="Telefone não disponível."><Phone className="mr-1 h-4 w-4" />Telefone não disponível.</Button>;
  }

  const opened = () => {
    // Do not prevent default: the tel: link itself opens the dialer (works in the installed app too).
    void logActivity(lead.id, "call_opened", "Ligação iniciada para o lead.", { channel: "ligacao", phone_original: original, phone_call: num })
      .then(() => onChanged?.());
    setTimeout(() => setResultOpen(true), 400);
  };

  const record = async (r: Result) => {
    const def = RESULTS.find((x) => x.v === r)!;
    if (r === "call_callback") { setCallback(true); return; }
    setBusy(true);
    await logActivity(lead.id, r, def.text, { channel: "ligacao", phone_call: num });
    setBusy(false);
    setResultOpen(false);
    toast.success("Resultado registrado.");
    onChanged?.();
    if (r === "call_interested" && lead.status !== "interessado") setStatusAsk("interessado");
    if (r === "call_not_interested" && lead.status !== "nao_tem_interesse") setStatusAsk("nao_tem_interesse");
  };

  const saveCallback = async () => {
    if (!cbDate) return toast.error("Escolha a data do retorno.");
    const when = new Date(`${cbDate}T${cbTime || "09:00"}:00`);
    setBusy(true);
    const { error } = await supabase.from("leads").update({ next_followup_at: when.toISOString() }).eq("id", lead.id);
    if (error) { setBusy(false); return toast.error(friendlyError(error)); }
    await logActivity(lead.id, "call_callback", "Lead pediu retorno por ligação.", { channel: "ligacao", phone_call: num, next_followup_at: when.toISOString(), note: cbNote || null });
    await logActivity(lead.id, "followup_created", `Retorno agendado para ${when.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} (ligação)${cbNote ? ` — ${cbNote}` : ""}`, { next_followup_at: when.toISOString(), channel: "ligacao" });
    setBusy(false);
    setCallback(false); setResultOpen(false); setCbDate(""); setCbTime(""); setCbNote("");
    toast.success("Retorno agendado.");
    onChanged?.();
  };

  const applyStatus = async () => {
    const to = statusAsk; setStatusAsk(null);
    if (!to) return;
    const { error } = await supabase.from("leads").update({ status: to }).eq("id", lead.id);
    if (error) return toast.error(friendlyError(error));
    await logActivity(lead.id, "status_changed", to === "nao_tem_interesse" ? "Lead marcado como Não tem interesse." : `Status alterado de ${statusLabel(lead.status)} para ${statusLabel(to)}`, { from: lead.status, to, channel: "ligacao" });
    toast.success("Status atualizado.");
    onChanged?.();
  };

  return (
    <>
      <Button asChild size={size} variant={variant} className="min-h-11 sm:min-h-9">
        <a href={`tel:${num}`} onClick={opened}><Phone className="mr-1 h-4 w-4" />Ligar</a>
      </Button>
      {showCopy && (
        <Button size={size} variant="outline" className="min-h-11 sm:min-h-9" title={`Copiar ${num}`}
          onClick={async () => { await navigator.clipboard.writeText(num); toast.success(`Número copiado: ${num}`); }}>
          <Copy className="mr-1 h-4 w-4" />Copiar número para ligação
        </Button>
      )}
      <Button size={size} variant="outline" className="min-h-11 sm:min-h-9" onClick={() => setResultOpen(true)}><PhoneCall className="mr-1 h-4 w-4" />Registrar resultado</Button>

      <Dialog open={resultOpen} onOpenChange={(o) => { setResultOpen(o); if (!o) setCallback(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resultado da ligação</DialogTitle>
            <DialogDescription>Número: {num}</DialogDescription>
          </DialogHeader>
          {!callback ? (
            <div className="grid grid-cols-2 gap-2">
              {RESULTS.map((r) => (
                <Button key={r.v} variant="outline" className="h-12" disabled={busy} onClick={() => record(r.v)}>{r.label}</Button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium">Agendar retorno</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" aria-label="Data" value={cbDate} onChange={(e) => setCbDate(e.target.value)} />
                <Input type="time" aria-label="Hora" value={cbTime} onChange={(e) => setCbTime(e.target.value)} />
              </div>
              <Textarea rows={3} placeholder="Observação" value={cbNote} onChange={(e) => setCbNote(e.target.value)} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCallback(false)}>Voltar</Button>
                <Button className="bg-gold text-gold-foreground hover:bg-gold/90" disabled={busy} onClick={saveCallback}>Agendar retorno</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!statusAsk} onOpenChange={(o) => !o && setStatusAsk(null)}
        title={`Mover para "${statusLabel(statusAsk)}"?`} text="O status do lead no Pipeline será alterado." confirmLabel="Mover" onConfirm={applyStatus} />
    </>
  );
}
