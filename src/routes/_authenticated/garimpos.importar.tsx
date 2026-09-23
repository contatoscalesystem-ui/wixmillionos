import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/crm";
import { ImportWizard } from "@/components/import-wizard";

export const Route = createFileRoute("/_authenticated/garimpos/importar")({
  validateSearch: (s: Record<string, unknown>): { batch?: string } => ({ batch: typeof s.batch === "string" ? s.batch : undefined }),
  head: () => ({
    meta: [
      { title: "Importar garimpo — WIX MILLION OS" },
      { name: "description", content: "Importe relatórios da Manus com preview, validação e verificação de duplicidades." },
      { property: "og:title", content: "Importar garimpo — WIX MILLION OS" },
      { property: "og:description", content: "Importação inteligente de garimpos com revisão humana." },
    ],
  }),
  component: ImportPage,
});

function ImportPage() {
  const { batch } = Route.useSearch();
  return (
    <div>
      <PageHeader title="Importar garimpo" subtitle="Relatório → preview → duplicidades → confirmação. Nada entra no CRM sem a sua revisão." />
      <ImportWizard resumeBatch={batch} />
    </div>
  );
}
