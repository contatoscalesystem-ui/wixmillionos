import { createFileRoute } from "@tanstack/react-router";
import { AccountStatusPage } from "@/components/account-status-page";

export const Route = createFileRoute("/aguardando-aprovacao")({
  head: () => ({
    meta: [
      { title: "Aguardando aprovação — WIX MILLION OS" },
      { name: "description", content: "Sua conta no WIX MILLION OS está aguardando aprovação." },
      { property: "og:title", content: "Aguardando aprovação — WIX MILLION OS" },
      { property: "og:description", content: "Sua conta no WIX MILLION OS está aguardando aprovação." },
    ],
  }),
  component: () => (
    <AccountStatusPage expected="pending" title="Sua conta está aguardando aprovação.">
      <p>Recebemos seu cadastro.</p>
      <p>Assim que seu acesso for aprovado, você poderá utilizar o WIX MILLION OS.</p>
    </AccountStatusPage>
  ),
});
