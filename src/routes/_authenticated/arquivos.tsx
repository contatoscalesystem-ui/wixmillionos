import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/crm";

export const Route = createFileRoute("/_authenticated/arquivos")({
  head: () => ({
    meta: [
      { title: "Arquivos — WIX MILLION OS" },
      { name: "description", content: "Arquivos da operação — disponível no próximo MVP." },
      { property: "og:title", content: "Arquivos — WIX MILLION OS" },
      { property: "og:description", content: "Arquivos da operação." },
    ],
  }),
  component: () => <ComingSoon title="Arquivos" text="Gestão de arquivos e integração com Google Drive serão disponibilizadas em um próximo MVP." />,
});
