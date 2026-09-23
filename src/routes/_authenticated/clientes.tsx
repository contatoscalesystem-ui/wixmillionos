import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageHeader, StrongConfirmDialog } from "@/components/crm";
import { fmtDate, friendlyError, type Tables } from "@/lib/crm";
import { useClients, useInvalidate, useProjects } from "@/lib/queries";
import { logActivity } from "@/lib/activity";
import { clientDeleteBlocker } from "@/lib/deletes";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — WIX MILLION OS" },
      { name: "description", content: "Clientes convertidos a partir dos leads." },
      { property: "og:title", content: "Clientes — WIX MILLION OS" },
      { property: "og:description", content: "Clientes convertidos a partir dos leads." },
    ],
  }),
  component: ClientsPage,
});

type C = Tables<"clients">;
const FIELDS = [["company_name", "Empresa"], ["contact_name", "Contato"], ["whatsapp", "WhatsApp"], ["phone", "Telefone"], ["email", "E-mail"], ["city", "Cidade"], ["state", "Estado"], ["status", "Status"]] as const;
type Form = Record<(typeof FIELDS)[number][0], string>;

function ClientsPage() {
  const { data, isLoading } = useClients();
  const { data: projects } = useProjects();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState<string | null>(null);
  const [edit, setEdit] = useState<C | null>(null);
  const [f, setF] = useState<Form | null>(null);
  const [del, setDel] = useState<C | null>(null);

  const createProject = async (clientId: string, leadId: string | null) => {
    setBusy(clientId);
    const { error } = await supabase.from("site_projects").insert({ client_id: clientId });
    setBusy(null);
    if (error) return toast.error(friendlyError(error));
    if (leadId) await logActivity(leadId, "project_created", "Projeto de site criado");
    toast.success("Projeto criado.");
    invalidate("site_projects", "activities");
  };

  const openEdit = (c: C) => {
    setEdit(c);
    setF(Object.fromEntries(FIELDS.map(([k]) => [k, (c[k] as string | null) ?? ""])) as Form);
  };
  const save = async () => {
    if (!edit || !f) return;
    if (!f.company_name.trim()) return toast.error("Informe o nome da empresa.");
    const payload = Object.fromEntries(FIELDS.map(([k]) => [k, f[k].trim() || null])) as Record<string, string | null>;
    const { error } = await supabase.from("clients").update({ ...payload, company_name: f.company_name.trim(), status: f.status.trim() || "ativo" }).eq("id", edit.id);
    if (error) return toast.error(friendlyError(error));
    toast.success("Cliente atualizado.");
    setEdit(null);
    invalidate("clients");
  };

  const askDelete = async (c: C) => {
    const blocker = await clientDeleteBlocker(c.id);
    if (blocker) return toast.error(blocker, { duration: 8000 });
    setDel(c);
  };
  const remove = async () => {
    if (!del) return;
    const c = del; setDel(null);
    const blocker = await clientDeleteBlocker(c.id);
    if (blocker) return toast.error(blocker, { duration: 8000 });
    const { error } = await supabase.from("clients").delete().eq("id", c.id);
    if (error) return toast.error(friendlyError(error));
    toast.success("Cliente excluído definitivamente.");
    invalidate("clients", "site_projects", "financial_entries", "leads");
  };

  return (
    <div>
      <PageHeader title="Clientes" subtitle="Clientes são criados ao converter um lead." />
      {isLoading ? <Skeleton className="h-48" /> : !data?.length ? (
        <EmptyState title="Nenhum cliente ainda." text="Converta um lead na ficha dele para criar o primeiro cliente."><Button asChild><Link to="/leads">Ir para Leads</Link></Button></EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{["Empresa", "Contato", "WhatsApp", "Cidade", "Status", "Projeto", "Desde", "Ações"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.map((c) => {
                const hasProject = projects?.some((p) => p.client_id === c.id);
                return (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{c.lead_id ? <Link to="/leads/$id" params={{ id: c.lead_id }} className="hover:text-gold">{c.company_name}</Link> : c.company_name}</td>
                    <td className="px-4 py-3">{c.contact_name ?? "—"}</td>
                    <td className="px-4 py-3">{c.whatsapp ?? c.phone ?? "—"}</td>
                    <td className="px-4 py-3">{[c.city, c.state].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="px-4 py-3 capitalize">{c.status}</td>
                    <td className="px-4 py-3">{hasProject ? <Link to="/producao" className="text-gold">Ver produção</Link> :
                      <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => createProject(c.id, c.lead_id)}>Criar projeto</Button>}</td>
                    <td className="px-4 py-3">{fmtDate(c.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {c.lead_id && <Button size="icon" variant="ghost" asChild aria-label="Ver"><Link to="/leads/$id" params={{ id: c.lead_id }}><Eye className="h-4 w-4" /></Link></Button>}
                        <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        {isAdmin && <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => askDelete(c)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar cliente</DialogTitle></DialogHeader>
          {f && <div className="grid grid-cols-2 gap-3">
            {FIELDS.map(([k, label]) => (
              <div key={k} className="space-y-1.5"><Label>{label}</Label><Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
            ))}
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <StrongConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} text="O cliente será apagado. O lead original continua existindo." onConfirm={remove} />
    </div>
  );
}
