import { createFileRoute } from "@tanstack/react-router";
import { LeadsView } from "@/components/leads-view";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline — WIX MILLION OS" },
      { name: "description", content: "Kanban do pipeline comercial com arrastar e soltar." },
      { property: "og:title", content: "Pipeline — WIX MILLION OS" },
      { property: "og:description", content: "Kanban do pipeline comercial." },
    ],
  }),
  component: () => <LeadsView forceKanban />,
});
