import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/crm";
import { fmtDate, friendlyError } from "@/lib/crm";
import { useClients, useInvalidate, useProjects } from "@/lib/queries";
import { logActivity } from "@/lib/activity";

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

function ClientsPage() {
  const { data, isLoading } = useClients();
  const { data: projects } = useProjects();
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState<string | null>(null);

  const createProject = async (clientId: string, leadId: string | null) => {
    setBusy(clientId);
    const { error } = await supabase.from("site_projects").insert({ client_id: clientId });
    setBusy(null);
    if (error) return toast.error(friendlyError(error));
    if (leadId) await logActivity(leadId, "project_created", "Projeto de site criado");
    toast.success("Projeto criado.");
    invalidate("site_projects", "activities");
  };

  return (
    <div>
      <PageHeader title="Clientes" subtitle="Clientes são criados ao converter um lead." />
      {isLoading ? <Skeleton className="h-48" /> : !data?.length ? (
        <EmptyState title="Nenhum cliente ainda." text="Converta um lead na ficha dele para criar o primeiro cliente."><Button asChild><Link to="/leads">Ir para Leads</Link></Button></EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{["Empresa", "Contato", "WhatsApp", "Cidade", "Status", "Projeto", "Desde"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
