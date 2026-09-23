import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GARIMPO_STATUS, friendlyError, type Garimpo, type GarimpoStatus } from "@/lib/crm";
import { useInvalidate } from "@/lib/queries";

const empty = { name: "", niche: "", city: "", state: "", research_date: "", source: "", status: "rascunho" as GarimpoStatus };

export function GarimpoForm({ open, onOpenChange, garimpo }: { open: boolean; onOpenChange: (o: boolean) => void; garimpo?: Garimpo | null }) {
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const invalidate = useInvalidate();

  useEffect(() => {
    if (!open) return;
    setF(garimpo ? {
      name: garimpo.name, niche: garimpo.niche ?? "", city: garimpo.city ?? "", state: garimpo.state ?? "",
      research_date: garimpo.research_date ?? "", source: garimpo.source ?? "", status: garimpo.status,
    } : empty);
  }, [open, garimpo]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload = { ...f, niche: f.niche || null, city: f.city || null, state: f.state || null, research_date: f.research_date || null, source: f.source || null };
    const { error } = garimpo
      ? await supabase.from("garimpos").update(payload).eq("id", garimpo.id)
      : await supabase.from("garimpos").insert(payload);
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    toast.success(garimpo ? "Garimpo atualizado." : "Garimpo cadastrado.");
    await invalidate("garimpos");
    onOpenChange(false);
  };

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{garimpo ? "Editar garimpo" : "Novo garimpo"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5"><Label>Nome *</Label><Input required value={f.name} onChange={set("name")} /></div>
          <div className="space-y-1.5"><Label>Nicho</Label><Input value={f.niche} onChange={set("niche")} /></div>
          <div className="space-y-1.5"><Label>Fonte</Label><Input value={f.source} onChange={set("source")} placeholder="Ex.: Manus" /></div>
          <div className="space-y-1.5"><Label>Cidade</Label><Input value={f.city} onChange={set("city")} /></div>
          <div className="space-y-1.5"><Label>Estado</Label><Input value={f.state} maxLength={2} onChange={set("state")} placeholder="UF" /></div>
          <div className="space-y-1.5"><Label>Data da pesquisa</Label><Input type="date" value={f.research_date} onChange={set("research_date")} /></div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as GarimpoStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{GARIMPO_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
