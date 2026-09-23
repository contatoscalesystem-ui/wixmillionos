import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/crm";
import { fmtDate, friendlyError } from "@/lib/crm";
import { profileName, useProfiles } from "@/lib/queries";
import { BATCH_STATUS_LABEL } from "@/lib/import/labels";

export const Route = createFileRoute("/_authenticated/garimpos/lotes/$id")({
  head: () => ({
    meta: [
      { title: "Lote de importação — WIX MILLION OS" },
      { name: "description", content: "Estatísticas, alertas e leads de um lote de importação." },
      { property: "og:title", content: "Lote de importação — WIX MILLION OS" },
      { property: "og:description", content: "Estatísticas, alertas e leads de um lote de importação." },
    ],
  }),
  component: BatchPage,
});

function BatchPage() {
  const { id } = Route.useParams();
  const { data: profiles } = useProfiles();
  const q = useQuery({ queryKey: ["import_batches", id], queryFn: async () => {
    const { data: b, error } = await supabase.from("import_batches").select("*, garimpos(id, name)").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!b) return null;
    const { data: leads } = await supabase.from("leads").select("id, company_name, score, priority, status, raw_source_data").eq("import_batch_id", id).order("position", { ascending: true, nullsFirst: false });
    const { data: rows } = await supabase.from("import_batch_rows").select("warnings").eq("import_batch_id", id);
    return { b, leads: leads ?? [], rows: rows ?? [] };
  } });

  if (q.isLoading) return <Skeleton className="h-64" />;
  if (!q.data) return <EmptyState title="Lote não encontrado." />;
  const { b, leads, rows } = q.data;
  const g = b.garimpos as { id: string; name: string } | null;
  // warnings: from staging rows while they exist, otherwise from the imported leads' raw_source_data
  const all = rows.length ? rows.flatMap((r) => (r.warnings as string[]) ?? []) : leads.flatMap((l) => ((l.raw_source_data as { warnings?: string[] } | null)?.warnings ?? []));
  const wcount = Object.entries(all.reduce<Record<string, number>>((a, w) => ((a[w] = (a[w] ?? 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);

  const download = async () => {
    if (!b.file_url) return;
    const { data, error } = await supabase.storage.from("garimpo-imports").createSignedUrl(b.file_url, 60);
    if (error) return toast.error(friendlyError(error));
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <div className="space-y-6">
      {g ? <Link to="/garimpos/$id" params={{ id: g.id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{g.name}</Link>
        : <Link to="/garimpos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Garimpos</Link>}
      <PageHeader title={b.file_name ?? "Lote de importação"} subtitle={`${BATCH_STATUS_LABEL[b.status]} · ${fmtDate(b.created_at, true)} · ${profileName(profiles, b.created_by)}`}
        actions={<>
          {b.file_url && <Button variant="outline" onClick={download}><Download className="mr-1 h-4 w-4" />Arquivo original</Button>}
          {["preview", "ready", "failed"].includes(b.status) && <Button asChild className="bg-gold text-gold-foreground hover:bg-gold/90"><Link to="/garimpos/importar" search={{ batch: b.id }}>Continuar revisão</Link></Button>}
          {b.status === "completed" && <Button asChild variant="outline"><Link to="/leads" search={{ import_batch: b.id }}>Ver leads importados</Link></Button>}
        </>} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {([["Encontrados", b.total_rows], ["Válidos", b.valid_rows], ["Duplicados", b.duplicate_rows], ["Inválidos", b.invalid_rows], ["Importados", b.imported_rows]] as const).map(([l, v]) => (
          <div key={l} className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">{l}</div><div className="text-2xl font-semibold tabular-nums">{v}</div></div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Tipo: {b.file_type === "pasted_text" ? "Conteúdo colado" : b.file_type?.toUpperCase()} {b.completed_at && `· Finalizado em ${fmtDate(b.completed_at, true)}`}</p>
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Alertas</h2>
        {!wcount.length ? <p className="text-sm text-muted-foreground">Nenhum alerta.</p> : (
          <div className="flex flex-wrap gap-2">{wcount.map(([w, n]) => <span key={w} className="rounded-full border bg-card px-3 py-1 text-xs">{w}: <b className="tabular-nums">{n}</b></span>)}</div>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Leads importados ({leads.length})</h2>
        {!leads.length ? <p className="text-sm text-muted-foreground">Nenhum lead importado neste lote.</p> : (
          <div className="divide-y rounded-lg border bg-card text-sm">
            {leads.map((l) => (
              <Link key={l.id} to="/leads/$id" params={{ id: l.id }} className="flex items-center justify-between px-4 py-2 hover:bg-muted/40">
                <span className="font-medium">{l.company_name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{[l.score != null && `Score ${l.score}`, l.priority && `Prioridade ${l.priority}`].filter(Boolean).join(" · ")}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
