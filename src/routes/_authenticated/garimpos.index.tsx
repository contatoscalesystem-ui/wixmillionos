import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Upload, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog, EmptyState, PageHeader } from "@/components/crm";
import { GarimpoForm, ImportSoonDialog } from "@/components/garimpo-form";
import { GARIMPO_STATUS, fmtDate, friendlyError, labelOf, type Garimpo } from "@/lib/crm";
import { useGarimpos, useInvalidate } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/garimpos")({
  head: () => ({
    meta: [
      { title: "Garimpos — WIX MILLION OS" },
      { name: "description", content: "Pesquisas de mercado que originam os leads." },
      { property: "og:title", content: "Garimpos — WIX MILLION OS" },
      { property: "og:description", content: "Pesquisas de mercado que originam os leads." },
    ],
  }),
  component: GarimposPage,
});

function GarimposPage() {
  const { data, isLoading } = useGarimpos();
  const invalidate = useInvalidate();
  const [form, setForm] = useState<{ open: boolean; g: Garimpo | null }>({ open: false, g: null });
  const [importOpen, setImportOpen] = useState(false);
  const [del, setDel] = useState<Garimpo | null>(null);

  const remove = async () => {
    if (!del) return;
    const { error } = await supabase.from("garimpos").delete().eq("id", del.id);
    setDel(null);
    if (error) return toast.error(friendlyError(error));
    toast.success("Garimpo excluído. Os leads foram mantidos sem vínculo.");
    invalidate("garimpos", "leads");
  };

  return (
    <div>
      <PageHeader
        title="Garimpos"
        subtitle="Pesquisas que originam os leads."
        actions={<>
          <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="mr-1 h-4 w-4" />Importar garimpo</Button>
          <Button className="bg-gold text-gold-foreground hover:bg-gold/90" onClick={() => setForm({ open: true, g: null })}><Plus className="mr-1 h-4 w-4" />Novo garimpo</Button>
        </>}
      />
      {isLoading ? <Skeleton className="h-48" /> : !data?.length ? (
        <EmptyState title="Nenhum garimpo cadastrado ainda." text="Cadastre o primeiro garimpo para organizar seus leads por pesquisa.">
          <Button onClick={() => setForm({ open: true, g: null })}>Novo garimpo</Button>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{["Nome", "Nicho", "Cidade", "Estado", "Data", "Leads", "Status", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.map((g) => (
                <tr key={g.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">
                    <Link to="/leads" search={{ garimpo: g.id }} className="hover:text-gold">{g.name}</Link>
                  </td>
                  <td className="px-4 py-3">{g.niche ?? "—"}</td>
                  <td className="px-4 py-3">{g.city ?? "—"}</td>
                  <td className="px-4 py-3">{g.state ?? "—"}</td>
                  <td className="px-4 py-3">{fmtDate(g.research_date)}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{g.total_leads}</td>
                  <td className="px-4 py-3">{labelOf(GARIMPO_STATUS, g.status)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setForm({ open: true, g })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => setDel(g)}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <GarimpoForm open={form.open} garimpo={form.g} onOpenChange={(o) => setForm({ open: o, g: o ? form.g : null })} />
      <ImportSoonDialog open={importOpen} onOpenChange={setImportOpen} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} destructive title="Excluir garimpo?" text="Os leads vinculados serão mantidos, apenas sem garimpo." confirmLabel="Excluir" onConfirm={remove} />
    </div>
  );
}
