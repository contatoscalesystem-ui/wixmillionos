import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth, statusPath, signOutWithLog, type AccountStatus } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export function AccountStatusPage({ expected, title, children }: { expected: AccountStatus; title: string; children: ReactNode }) {
  const { session, loading, account, checked, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
    else if (checked && account && account.status !== expected) navigate({ to: statusPath(account.status) });
  }, [loading, session, checked, account, expected, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-4 rounded-lg border bg-card p-8 text-center">
        <div className="text-xs font-semibold tracking-[0.3em] text-gold">WIX MILLION OS</div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {expected === "pending" && (
            <Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); await refreshProfile(); setBusy(false); }}>
              {busy ? "Verificando..." : "Verificar novamente"}
            </Button>
          )}
          <Button variant="ghost" onClick={async () => { await signOutWithLog(); navigate({ to: "/login" }); }}>Sair</Button>
        </div>
      </div>
    </div>
  );
}
