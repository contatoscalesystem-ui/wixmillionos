import { createFileRoute } from "@tanstack/react-router";
import { AccountStatusPage } from "@/components/account-status-page";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/conta-bloqueada")({
  head: () => ({
    meta: [
      { title: "Conta bloqueada — WIX MILLION OS" },
      { name: "description", content: "O acesso desta conta ao WIX MILLION OS está bloqueado." },
      { property: "og:title", content: "Conta bloqueada — WIX MILLION OS" },
      { property: "og:description", content: "O acesso desta conta ao WIX MILLION OS está bloqueado." },
    ],
  }),
  component: Blocked,
});

function Blocked() {
  const { account } = useAuth();
  const until = account?.status === "temp_blocked" && account.blocked_until ? new Date(account.blocked_until) : null;
  return (
    <AccountStatusPage expected={["blocked", "temp_blocked"]} title={until ? "Sua conta está bloqueada temporariamente." : "Sua conta está bloqueada."}>
      <p>O acesso ao WIX MILLION OS foi suspenso pelo administrador da plataforma.</p>
      {until && <p className="font-semibold text-foreground">Bloqueado até {until.toLocaleDateString("pt-BR")} • {until.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>}
      <p>Seus dados continuam preservados. Entre em contato com o administrador para mais informações.</p>
    </AccountStatusPage>
  );
}
