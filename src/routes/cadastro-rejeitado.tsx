import { createFileRoute } from "@tanstack/react-router";
import { AccountStatusPage } from "@/components/account-status-page";

export const Route = createFileRoute("/cadastro-rejeitado")({
  head: () => ({
    meta: [
      { title: "Cadastro não aprovado — WIX MILLION OS" },
      { name: "description", content: "Este cadastro no WIX MILLION OS não foi aprovado." },
      { property: "og:title", content: "Cadastro não aprovado — WIX MILLION OS" },
      { property: "og:description", content: "Este cadastro no WIX MILLION OS não foi aprovado." },
    ],
  }),
  component: () => (
    <AccountStatusPage expected="rejected" title="Seu cadastro não foi aprovado.">
      <p>Seu pedido de acesso ao WIX MILLION OS não foi aprovado.</p>
      <p>Se acredita que houve um engano, entre em contato com o administrador da plataforma.</p>
    </AccountStatusPage>
  ),
});
