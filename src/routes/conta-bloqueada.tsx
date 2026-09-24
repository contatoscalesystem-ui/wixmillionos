import { createFileRoute } from "@tanstack/react-router";
import { AccountStatusPage } from "@/components/account-status-page";

export const Route = createFileRoute("/conta-bloqueada")({
  head: () => ({
    meta: [
      { title: "Conta bloqueada — WIX MILLION OS" },
      { name: "description", content: "O acesso desta conta ao WIX MILLION OS está bloqueado." },
      { property: "og:title", content: "Conta bloqueada — WIX MILLION OS" },
      { property: "og:description", content: "O acesso desta conta ao WIX MILLION OS está bloqueado." },
    ],
  }),
  component: () => (
    <AccountStatusPage expected="blocked" title="Sua conta está bloqueada.">
      <p>O acesso ao WIX MILLION OS foi suspenso pelo administrador da plataforma.</p>
      <p>Seus dados continuam preservados. Entre em contato com o administrador para mais informações.</p>
    </AccountStatusPage>
  ),
});
