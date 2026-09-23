import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEAD_STATUS, PRIORITIES, WEBSITE_STATUS, friendlyError, type Lead } from "@/lib/crm";
import { useGarimpos, useInvalidate, useProfiles } from "@/lib/queries";
import { logActivity } from "@/lib/activity";

const TEXT_FIELDS = [
  ["company_name", "Empresa *"], ["niche", "Nicho"], ["city", "Cidade"], ["state", "Estado"],
  ["neighborhood", "Bairro"], ["address", "Endereço"], ["phone", "Telefone"], ["whatsapp", "WhatsApp"],
  ["instagram_url", "Instagram (URL)"], ["google_maps_url", "Google Maps (URL)"], ["website_url", "Site (URL)"],
  ["scheduling_type", "Tipo de agendamento"], ["scheduling_url", "Link de agendamento"],
  ["digital_presence", "Presença digital"], ["photo_quality", "Qualidade das fotos"],
] as const;
const NUM_FIELDS = [
  ["position", "Posição no garimpo"], ["score", "Score"], ["instagram_followers", "Seguidores"],
  ["google_rating", "Nota Google"], ["google_reviews", "Avaliações Google"],
] as const;

type F = Record<string, string | boolean>;
const NONE = "__none";

export function LeadForm({ open, onOpenChange, lead, defaultGarimpo, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; lead?: Lead | null; defaultGarimpo?: string; onSaved?: (id: string) => void;
}) {
  const [f, setF] = useState<F>({});
  const [busy, setBusy] = useState(false);
  const { data: garimpos } = useGarimpos();
  const { data: profiles } = useProfiles();
  const invalidate = useInvalidate();

  useEffect(() => {
    if (!open) return;
    const base: F = {};
    for (const [k] of [...TEXT_FIELDS, ...NUM_FIELDS]) base[k] = lead?.[k] != null ? String(lead[k]) : "";
    base.commercial_observation = lead?.commercial_observation ?? "";
    base.whatsapp_confirmed = lead?.whatsapp_confirmed ?? false;
    base.priority = lead?.priority ?? NONE;
    base.status = lead?.status ?? "novo";
    base.website_status = lead?.website_status ?? "nao_confirmado";
    base.garimpo_id = lead?.garimpo_id ?? defaultGarimpo ?? NONE;
    base.assigned_to = lead?.assigned_to ?? NONE;
    setF(base);
  }, [open, lead, defaultGarimpo]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const s = (k: string) => { const v = String(f[k] ?? "").trim(); return v || null; };
    const n = (k: string) => { const v = String(f[k] ?? "").replace(",", ".").trim(); return v === "" || isNaN(Number(v)) ? null : Number(v); };
    const sel = (k: string) => (f[k] === NONE ? null : (f[k] as string));
    const payload = {
      company_name: s("company_name") ?? "",
      ...Object.fromEntries(TEXT_FIELDS.slice(1).map(([k]) => [k, s(k)])),
      position: n("position"), score: n("score"), instagram_followers: n("instagram_followers"),
      google_rating: n("google_rating"), google_reviews: n("google_reviews"),
      commercial_observation: s("commercial_observation"),
      whatsapp_confirmed: !!f.whatsapp_confirmed,
      priority: sel("priority") as Lead["priority"],
      status: f.status as Lead["status"],
      website_status: f.website_status as Lead["website_status"],
      garimpo_id: sel("garimpo_id"),
      assigned_to: sel("assigned_to"),
    };
    setBusy(true);
    if (lead) {
      const { error } = await supabase.from("leads").update(payload).eq("id", lead.id);
      setBusy(false);
      if (error) return toast.error(friendlyError(error));
      if (lead.status !== payload.status)
        await logActivity(lead.id, "status_changed", `Status alterado para ${LEAD_STATUS.find((x) => x.value === payload.status)?.label}`, { from: lead.status, to: payload.status });
      else await logActivity(lead.id, "lead_updated", "Dados do lead atualizados");
      toast.success("Lead atualizado.");
      onSaved?.(lead.id);
    } else {
      const { data, error } = await supabase.from("leads").insert(payload).select("id").single();
      setBusy(false);
      if (error || !data) return toast.error(friendlyError(error));
      await logActivity(data.id, "lead_created", "Lead cadastrado manualmente");
      toast.success("Lead cadastrado.");
      onSaved?.(data.id);
    }
    await invalidate("leads", "garimpos", "activities", `lead-${lead?.id}`);
    onOpenChange(false);
  };

  const Sel = ({ k, label, items }: { k: string; label: string; items: { value: string; label: string }[] }) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={(f[k] as string) ?? ""} onValueChange={(v) => setF({ ...f, [k]: v })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{lead ? "Editar lead" : "Cadastrar lead"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {TEXT_FIELDS.map(([k, label]) => (
            <div key={k} className={k === "company_name" || k === "address" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
              <Label>{label}</Label>
              <Input required={k === "company_name"} value={(f[k] as string) ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </div>
          ))}
          {NUM_FIELDS.map(([k, label]) => (
            <div key={k} className="space-y-1.5">
              <Label>{label}</Label>
              <Input inputMode="decimal" value={(f[k] as string) ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </div>
          ))}
          <Sel k="priority" label="Prioridade" items={[{ value: NONE, label: "Sem prioridade" }, ...PRIORITIES.map((p) => ({ value: p, label: p }))]} />
          <Sel k="status" label="Status" items={LEAD_STATUS} />
          <Sel k="website_status" label="Status do site" items={WEBSITE_STATUS} />
          <Sel k="garimpo_id" label="Garimpo" items={[{ value: NONE, label: "Nenhum" }, ...(garimpos ?? []).map((g) => ({ value: g.id, label: g.name }))]} />
          <Sel k="assigned_to" label="Responsável" items={[{ value: NONE, label: "Ninguém" }, ...(profiles ?? []).map((p) => ({ value: p.id, label: p.full_name || p.email || "—" }))]} />
          <div className="flex items-center gap-2 pt-6">
            <Switch checked={!!f.whatsapp_confirmed} onCheckedChange={(v) => setF({ ...f, whatsapp_confirmed: v })} id="wc" />
            <Label htmlFor="wc">WhatsApp confirmado</Label>
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label>Observação comercial</Label>
            <Textarea rows={3} value={(f.commercial_observation as string) ?? ""} onChange={(e) => setF({ ...f, commercial_observation: e.target.value })} />
          </div>
          <DialogFooter className="sm:col-span-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
