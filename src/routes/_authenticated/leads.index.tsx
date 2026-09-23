import { createFileRoute } from "@tanstack/react-router";
import { LeadsView } from "@/components/leads-view";

type Search = { garimpo?: string; view?: "tabela" | "kanban"; import_batch?: string };

export const Route = createFileRoute("/_authenticated/leads/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    garimpo: typeof s.garimpo === "string" ? s.garimpo : undefined,
    import_batch: typeof s.import_batch === "string" ? s.import_batch : undefined,
    view: s.view === "kanban" ? "kanban" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Leads — WIX MILLION OS" },
      { name: "description", content: "CRM de leads com filtros, tabela e Kanban." },
      { property: "og:title", content: "Leads — WIX MILLION OS" },
      { property: "og:description", content: "CRM de leads com filtros, tabela e Kanban." },
    ],
  }),
  component: () => <LeadsView />,
});
