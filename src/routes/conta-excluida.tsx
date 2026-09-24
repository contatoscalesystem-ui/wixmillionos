import { createFileRoute } from "@tanstack/react-router";
import { AccountStatusPage } from "@/components/account-status-page";

export const Route = createFileRoute("/conta-excluida")({
  head: () => ({
    meta: [
      { title: "Conta excluída — WIX MILLION OS" },
      { name: "description", content: "Esta conta do WIX MILLION OS foi excluída." },
      { property: "og:title", content: "Conta excluída — WIX MILLION OS" },
      { property: "og:description", content: "Esta conta do WIX MILLION OS foi excluída." },
    ],
  }),
  component: () => (
    <AccountStatusPage expected="deleted" title="Conta excluída">
      <p>Esta conta não tem mais acesso ao WIX MILLION OS.</p>
      <p>Entre em contato com o administrador da plataforma se achar que isso é um engano.</p>
    </AccountStatusPage>
  ),
});
