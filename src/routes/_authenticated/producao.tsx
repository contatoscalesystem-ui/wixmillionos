import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/crm";
import { PROJECT_STATUS, fmtDate, friendlyError, labelOf, type ProjectStatus, type Tables } from "@/lib/crm";
import { profileName, useClients, useInvalidate, useProfiles, useProjects } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/producao")({
  head: () => ({
    meta: [
      { title: "Produção — WIX MILLION OS" },
      { name: "description", content: "Acompanhamento da produção dos sites dos clientes." },
      { property: "og:title", content: "Produção — WIX MILLION OS" },
      { property: "og:description", content: "Acompanhamento da produção dos sites." },
    ],
  }),
  component: ProducaoPage,
});

type P = Tables<"site_projects">;
const NONE = "__none";

function ProducaoPage() {
  const { data, isLoading } = useProjects();
  const { data: clients } = useClients();
  const { data: profiles } = useProfiles();
  const invalidate = useInvalidate();
  const [edit, setEdit] = useState<P | null>(null);
  const [f, setF] = useState({ status: "aguardando" as ProjectStatus, responsible_user_id: NONE, preview_url: "", published_url: "", due_date: "", notes: "" });

  const openEdit = (p: P) => {
    setEdit(p);
    setF({ status: p.status, responsible_user_id: p.responsible_user_id ?? NONE, preview_url: p.preview_url ?? "", published_url: p.published_url ?? "", due_date: p.due_date ?? "", notes: p.notes ?? "" });
  };
  const save = async () => {
    if (!edit) return;
    const { error } = await supabase.from("site_projects").update({
      status: f.status, responsible_user_id: f.responsible_user_id === NONE ? null : f.responsible_user_id,
      preview_url: f.preview_url || null, published_url: f.published_url || null, due_date: f.due_date || null, notes: f.notes || null,
    }).eq("id", edit.id);
    if (error) return toast.error(friendlyError(error));
    toast.success("Projeto atualizado.");
    setEdit(null);
    invalidate("site_projects");
  };
  const clientName = (id: string) => clients?.find((c) => c.id === id)?.company_name ?? "—";

  return (
    <div>
      <PageHeader title="Produção" subtitle="Projetos de site criados a partir de clientes." />
      {isLoading ? <Skeleton className="h-48" /> : !data?.length ? (
        <EmptyState title="Nenhum projeto em produção." text="Crie um projeto ao converter um lead ou pela tela de Clientes." />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{["Cliente", "Projeto", "Responsável", "Status", "Prazo", "Preview", "URL publicada", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{clientName(p.client_id)}</td>
                  <td className="px-4 py-3">Site — {clientName(p.client_id)}</td>
                  <td className="px-4 py-3">{profileName(profiles, p.responsible_user_id)}</td>
                  <td className="px-4 py-3"><span className={p.status === "publicado" ? "font-semibold text-gold" : ""}>{labelOf(PROJECT_STATUS, p.status)}</span></td>
                  <td className="px-4 py-3">{fmtDate(p.due_date)}</td>
                  <td className="px-4 py-3">{p.preview_url ? <a className="underline" href={p.preview_url} target="_blank" rel="noreferrer">Abrir</a> : "—"}</td>
                  <td className="px-4 py-3">{p.published_url ? <a className="underline" href={p.published_url} target="_blank" rel="noreferrer">Abrir</a> : "—"}</td>
                  <td className="px-4 py-3 text-right"><Button size="icon" variant="ghost" aria-label="Editar" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Projeto — {edit && clientName(edit.client_id)}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as ProjectStatus })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROJECT_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Responsável</Label>
              <Select value={f.responsible_user_id} onValueChange={(v) => setF({ ...f, responsible_user_id: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={NONE}>Ninguém</SelectItem>{(profiles ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Prazo</Label><Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Preview</Label><Input value={f.preview_url} onChange={(e) => setF({ ...f, preview_url: e.target.value })} /></div>
            <div className="col-span-2 space-y-1.5"><Label>URL publicada</Label><Input value={f.published_url} onChange={(e) => setF({ ...f, published_url: e.target.value })} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Notas</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
