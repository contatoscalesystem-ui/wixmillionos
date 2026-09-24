import { useState } from "react";
import { toast } from "sonner";
import type { AccountStatus } from "@/hooks/use-auth";
import { ACCOUNT_STATUS_CLASS, ACCOUNT_STATUS_LABEL, rpc } from "@/lib/admin";
import { friendlyError } from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { AccountActionDialog, type ActionKind } from "@/components/admin-security";

export function AccountBadge({ s }: { s: AccountStatus }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${ACCOUNT_STATUS_CLASS[s] ?? ""}`}>{ACCOUNT_STATUS_LABEL[s] ?? s}</span>;
}

export function AccountActions({ userId, status, isSuperAdmin, email, name, onDone }: { userId: string; status: AccountStatus; isSuperAdmin?: boolean; email?: string | null; name?: string | null; onDone: () => void }) {
  const [kind, setKind] = useState<ActionKind | null>(null);
  if (isSuperAdmin) return <span className="text-xs text-muted-foreground">Super Admin</span>;
  const set = async (s: AccountStatus, msg: string) => {
    try {
      await rpc("admin_set_account_status", { _user_id: userId, _status: s });
      toast.success(msg);
      onDone();
    } catch (e) { toast.error(friendlyError(e)); }
  };
  return (
    <div className="flex flex-wrap gap-1">
      {status === "pending" && <>
        <Button size="sm" className="bg-gold text-gold-foreground hover:bg-gold/90" onClick={() => set("approved", "Conta aprovada. Ambiente criado.")}>Aprovar</Button>
        <Button size="sm" variant="outline" onClick={() => set("rejected", "Cadastro rejeitado.")}>Rejeitar</Button>
        <Button size="sm" variant="outline" onClick={() => setKind("block")}>Bloquear</Button>
      </>}
      {status === "approved" && <Button size="sm" variant="outline" onClick={() => setKind("block")}>Bloquear</Button>}
      {(status === "blocked" || status === "temp_blocked") && <Button size="sm" variant="outline" onClick={() => setKind("unblock")}>{status === "temp_blocked" ? "Desbloquear agora" : "Desbloquear"}</Button>}
      {status === "rejected" && <Button size="sm" variant="outline" onClick={() => set("approved", "Conta aprovada. Ambiente criado.")}>Aprovar</Button>}
      <AccountActionDialog kind={kind} target={{ userId, email: email ?? null, name: name ?? null }} onClose={() => setKind(null)} onDone={onDone} />
    </div>
  );
}
