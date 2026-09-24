import { createFileRoute } from "@tanstack/react-router";
import { AccountStatusPage } from "@/components/account-status-page";

export const Route = createFileRoute("/conta-banida")({
  head: () => ({
    meta: [
      { title: "Conta banida — WIX MILLION OS" },
      { name: "description", content: "O acesso desta conta ao WIX MILLION OS foi suspenso." },
      { property: "og:title", content: "Conta banida — WIX MILLION OS" },
      { property: "og:description", content: "O acesso desta conta ao WIX MILLION OS foi suspenso." },
    ],
  }),
  component: () => (
    <AccountStatusPage expected="banned" title="Conta banida">
      <p>Seu acesso ao WIX MILLION OS foi suspenso.</p>
    </AccountStatusPage>
  ),
});
