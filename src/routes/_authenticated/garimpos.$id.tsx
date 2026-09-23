import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/crm";
import { GARIMPO_STATUS, fmtDate, labelOf } from "@/lib/crm";
import { profileName, useProfiles } from "@/lib/queries";
import { BATCH_STATUS_LABEL } from "@/lib/import/labels";

export const Route = createFileRoute("/_authenticated/garimpos/$id")({
  head: () => ({
    meta: [
      { title: "Garimpo — WIX MILLION OS" },
      { name: "description", content: "Detalhes do garimpo e histórico de importações." },
      { property: "og:title", content: "Garimpo — WIX MILLION OS" },
      { property: "og:description", content: "Detalhes do garimpo e histórico de importações." },
    ],
  }),
  component: GarimpoPage,
});

function GarimpoPage() {
  const { id } = Route.useParams();
  const { data: profiles } = useProfiles();
  const g = useQuery({ queryKey: ["garimpos", id], queryFn: async () => {
    const { data, error } = await supabase.from("garimpos").select("*").eq("id", id).maybeSingle(); if (error) throw error; return data;
  } });
  const batches = useQuery({ queryKey: ["import_batches", "garimpo", id], queryFn: async () => {
    const { data, error } = await supabase.from("import_batches").select("*").eq("garimpo_id", id).order("created_at", { ascending: false }); if (error) throw error; return data;
  } });

  if (g.isLoading) return <Skeleton className="h-64" />;
  if (!g.data) return <EmptyState title="Garimpo não encontrado." />;
  const x = g.data;
  return (
    <div className="space-y-6">
      <Link to="/garimpos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Garimpos</Link>
      <PageHeader title={x.name} subtitle={[x.niche, [x.city, x.state].filter(Boolean).join("/")].filter(Boolean).join(" · ")}
        actions={<>
          <Button asChild variant="outline"><Link to="/leads" search={{ garimpo: x.id }}>Ver leads</Link></Button>
          <Button asChild variant="outline"><Link to="/garimpos/importar"><Upload className="mr-1 h-4 w-4" />Nova importação</Link></Button>
        </>} />
      <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-card p-5 text-sm sm:grid-cols-4">
        {([["Nome", x.name], ["Nicho", x.niche], ["Cidade", x.city], ["Estado", x.state], ["Data", fmtDate(x.research_date)], ["Fonte", x.source], ["Total de leads", x.total_leads], ["Status", labelOf(GARIMPO_STATUS, x.status)]] as const).map(([k, v]) => (
          <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className={k === "Total de leads" ? "text-xl font-semibold tabular-nums text-gold" : "font-medium"}>{v ?? "—"}</dd></div>
        ))}
      </dl>
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Importações</h2>
        {batches.isLoading ? <Skeleton className="h-24" /> : !batches.data?.length ? (
          <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">Nenhuma importação neste garimpo.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>{["Arquivo", "Tipo", "Data", "Usuário", "Status", "Encontrados", "Importados", "Duplicados", "Inválidos"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {batches.data.map((b) => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium"><Link to="/garimpos/lotes/$id" params={{ id: b.id }} className="hover:text-gold">{b.file_name ?? "—"}</Link></td>
                    <td className="px-3 py-2">{b.file_type === "pasted_text" ? "Colado" : b.file_type?.toUpperCase()}</td>
                    <td className="whitespace-nowrap px-3 py-2">{fmtDate(b.created_at, true)}</td>
                    <td className="px-3 py-2">{profileName(profiles, b.created_by)}</td>
                    <td className="px-3 py-2">{BATCH_STATUS_LABEL[b.status]}</td>
                    {[b.total_rows, b.imported_rows, b.duplicate_rows, b.invalid_rows].map((n, i) => <td key={i} className="px-3 py-2 tabular-nums">{n}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
