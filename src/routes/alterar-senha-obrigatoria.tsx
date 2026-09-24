import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, statusPath, signOutWithLog } from "@/hooks/use-auth";
import { NewPasswordForm } from "@/components/new-password-form";

export const Route = createFileRoute("/alterar-senha-obrigatoria")({
  head: () => ({
    meta: [
      { title: "Criar nova senha — WIX MILLION OS" },
      { name: "description", content: "Crie uma nova senha para continuar no WIX MILLION OS." },
      { property: "og:title", content: "Criar nova senha — WIX MILLION OS" },
      { property: "og:description", content: "Crie uma nova senha para continuar no WIX MILLION OS." },
    ],
  }),
  component: ForcedChange,
});

function ForcedChange() {
  const { session, loading, checked, account, refreshProfile } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
    else if (checked && account && !(account.status === "approved" && account.must_change_password)) navigate({ to: statusPath(account.status, account.must_change_password) });
  }, [loading, session, checked, account, navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-8">
        <div className="text-center text-xs font-semibold tracking-[0.3em] text-gold">WIX MILLION OS</div>
        <h1 className="text-center text-2xl font-bold">Criar nova senha</h1>
        <p className="text-center text-sm text-muted-foreground">Por segurança, crie uma nova senha antes de continuar.</p>
        <NewPasswordForm onSaved={async () => { await refreshProfile(); navigate({ to: "/dashboard" }); }} />
        <button className="block w-full text-center text-sm text-muted-foreground underline" onClick={async () => { await signOutWithLog(); navigate({ to: "/login" }); }}>Sair</button>
      </div>
    </div>
  );
}
