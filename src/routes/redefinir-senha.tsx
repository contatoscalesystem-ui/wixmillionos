import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { NewPasswordForm } from "@/components/new-password-form";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — WIX MILLION OS" },
      { name: "description", content: "Defina uma nova senha para sua conta do WIX MILLION OS." },
      { property: "og:title", content: "Redefinir senha — WIX MILLION OS" },
      { property: "og:description", content: "Defina uma nova senha para sua conta do WIX MILLION OS." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => { if (s && (e === "PASSWORD_RECOVERY" || e === "SIGNED_IN")) setReady(true); });
    const t = setTimeout(() => { void supabase.auth.getSession().then(({ data }) => setReady(!!data.session)); }, 1500);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-8">
        <div className="text-center text-xs font-semibold tracking-[0.3em] text-gold">WIX MILLION OS</div>
        <h1 className="text-center text-2xl font-bold">Redefinir senha</h1>
        {ready === null ? <p className="text-center text-sm text-muted-foreground">Verificando o link...</p>
          : ready ? <NewPasswordForm onSaved={async () => { await refreshProfile(); navigate({ to: "/login" }); }} />
          : <p className="text-center text-sm text-muted-foreground">Este link é inválido ou expirou. Peça um novo link ao administrador. <Link to="/login" className="underline">Voltar ao login</Link></p>}
      </div>
    </div>
  );
}
