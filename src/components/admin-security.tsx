import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MoreVertical, Copy } from "lucide-react";
import { toast } from "sonner";
import type { AccountStatus } from "@/hooks/use-auth";
import { dt, rpc } from "@/lib/admin";
import { friendlyError } from "@/lib/crm";
import { adminPurgeAccount, adminSendPasswordReset, adminSetPassword, adminTempPassword } from "@/lib/admin-security.functions";
import { AccountBadge } from "@/components/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type ActionKind =
  | "block" | "temp_block" | "unblock" | "ban" | "unban" | "soft_delete" | "purge"
  | "reset" | "set_password" | "temp_password" | "require_change";

type Target = { userId: string; email: string | null; name: string | null };

type Security = {
  user_id: string; full_name: string | null; email: string | null; status: AccountStatus; role: string | null;
  created_at: string; last_seen_at: string | null; password_changed_at: string | null; must_change_password: boolean;
  blocked_at: string | null; blocked_reason: string | null; blocked_until: string | null;
  banned_at: string | null; banned_reason: string | null; banned_note: string | null; deleted_at: string | null;
  is_super_admin: boolean;
  counts: { leads: number; garimpos: number; clientes: number; projetos: number; financeiro: number };
};

const DURATIONS: [string, number][] = [
  ["1 hora", 1], ["6 horas", 6], ["12 horas", 12], ["24 horas", 24], ["3 dias", 72], ["7 dias", 168], ["15 dias", 360], ["30 dias", 720],
];
const blockedUntilText = (v: string | null) =>
  v ? new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) + " • " + new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";

/** Which actions are available for a status (section 18). */
export function actionsFor(s: AccountStatus): ActionKind[] {
  switch (s) {
    case "approved": return ["block", "temp_block", "ban", "soft_delete"];
    case "blocked": return ["unblock", "ban", "soft_delete"];
    case "temp_blocked": return ["unblock", "ban", "soft_delete"];
    case "banned": return ["unban", "soft_delete"];
    case "deleted": return ["purge"];
    default: return ["ban", "soft_delete"];
  }
}
const ACTION_LABEL: Record<ActionKind, string> = {
  block: "Bloquear", temp_block: "Bloquear temporariamente", unblock: "Desbloquear", ban: "Banir", unban: "Remover banimento",
  soft_delete: "Excluir conta", purge: "Excluir definitivamente", reset: "Enviar recuperação de senha",
  set_password: "Definir nova senha", temp_password: "Gerar senha temporária", require_change: "Forçar troca de senha",
};

export function AccountActionDialog({ kind, target, status, onClose, onDone }: {
  kind: ActionKind | null; target: Target; status?: AccountStatus; onClose: () => void; onDone: () => void;
}) {
  const sendReset = useServerFn(adminSendPasswordReset);
  const setPwd = useServerFn(adminSetPassword);
  const tempPwd = useServerFn(adminTempPassword);
  const purge = useServerFn(adminPurgeAccount);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [hours, setHours] = useState<string>("24");
  const [custom, setCustom] = useState("");
  const [confirm, setConfirm] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [must, setMust] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const needsCounts = kind === "soft_delete";
  const sec = useQuery({ enabled: needsCounts, queryKey: ["admin", "security", target.userId], queryFn: () => rpc<Security>("admin_account_security", { _user_id: target.userId }) });

  const close = () => {
    setReason(""); setNote(""); setConfirm(""); setP1(""); setP2(""); setMust(false); setGenerated(null); setCustom(""); setHours("24");
    onClose();
  };
  const who = target.email ?? target.name ?? "esta conta";

  const run = async () => {
    if (!kind) return;
    setBusy(true);
    try {
      if (kind === "reset") {
        await sendReset({ data: { userId: target.userId, redirectTo: `${window.location.origin}/redefinir-senha` } });
        toast.success("Link de recuperação enviado.");
      } else if (kind === "set_password") {
        await setPwd({ data: { userId: target.userId, password: p1, mustChange: must } });
        toast.success("Nova senha definida.");
      } else if (kind === "temp_password") {
        const r = await tempPwd({ data: { userId: target.userId } });
        setGenerated(r.password);
        onDone();
        return;
      } else if (kind === "purge") {
        await purge({ data: { userId: target.userId } });
        toast.success("Conta excluída definitivamente.");
      } else {
        const action = kind === "require_change" ? "require_password_change" : kind;
        let until: string | null = null;
        if (kind === "temp_block") {
          until = hours === "custom" ? (custom ? new Date(custom).toISOString() : null) : new Date(Date.now() + Number(hours) * 3600_000).toISOString();
        }
        await rpc("admin_account_action", { _user_id: target.userId, _action: action, _reason: reason || null, _until: until, _note: note || null });
        toast.success({
          block: "Conta bloqueada.", temp_block: "Conta bloqueada temporariamente.", unblock: "Conta desbloqueada.", ban: "Conta banida.",
          unban: "Banimento removido.", soft_delete: "Conta excluída. Os dados foram preservados.", require_change: "Troca de senha exigida no próximo acesso.",
        }[kind as "block"]);
      }
      onDone();
      close();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally { setBusy(false); }
  };

  const phrase = kind === "ban" ? "BANIR" : kind === "soft_delete" ? "EXCLUIR CONTA" : kind === "purge" ? "EXCLUIR DEFINITIVAMENTE" : null;
  const phraseOk = !phrase || confirm.trim().toUpperCase() === phrase;
  const reasonOk = !(kind === "block" || kind === "temp_block" || kind === "ban") || reason.trim().length > 0;
  const untilOk = kind !== "temp_block" || hours !== "custom" || (custom && new Date(custom).getTime() > Date.now());
  const pwdOk = kind !== "set_password" || (p1.length >= 8 && p1 === p2);
  const destructive = kind === "ban" || kind === "soft_delete" || kind === "purge" || kind === "block" || kind === "temp_block";

  return (
    <Dialog open={!!kind} onOpenChange={(o) => { if (!o && !busy) close(); }}>
      <DialogContent>
        {kind && generated ? (
          <>
            <DialogHeader><DialogTitle>Senha temporária</DialogTitle>
              <DialogDescription>Esta senha será exibida somente agora. A pessoa terá que criar uma nova senha no próximo acesso.</DialogDescription></DialogHeader>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
              <code className="flex-1 select-all break-all font-mono text-lg">{generated}</code>
              <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(generated); toast.success("Senha copiada."); }}><Copy className="mr-1 h-4 w-4" />Copiar</Button>
            </div>
            <DialogFooter><Button onClick={close}>Fechar</Button></DialogFooter>
          </>
        ) : kind && (
          <>
            <DialogHeader>
              <DialogTitle>{kind === "ban" ? "Banir usuário" : kind === "block" ? "Bloquear conta" : ACTION_LABEL[kind]}</DialogTitle>
              <DialogDescription>
                {kind === "reset" ? `Enviar um link de redefinição de senha para: ${who}?`
                  : kind === "temp_password" ? `Gerar uma senha forte para ${who}. A senha atual deixará de funcionar.`
                  : kind === "require_change" ? `${who} terá que criar uma nova senha no próximo acesso.`
                  : kind === "unblock" ? `Liberar o acesso de ${who}? Todos os dados continuam como estavam.`
                  : kind === "unban" ? `Remover o banimento de ${who}? O acesso volta e o histórico da auditoria é mantido.`
                  : kind === "soft_delete" ? "Esta conta perderá o acesso ao sistema. Os dados ficam guardados e podem ser recuperados."
                  : kind === "purge" ? "Todos os dados deste ambiente serão removidos permanentemente."
                  : kind === "set_password" ? `Definir uma nova senha para ${who}. A senha anterior deixará de funcionar.`
                  : `Conta: ${who}. Os dados não são apagados.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {kind === "soft_delete" && (sec.data ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border p-3 text-sm">
                  <dt className="text-muted-foreground">Nome</dt><dd>{sec.data.full_name || "—"}</dd>
                  <dt className="text-muted-foreground">E-mail</dt><dd className="truncate">{sec.data.email}</dd>
                  <dt className="text-muted-foreground">Leads</dt><dd>{sec.data.counts.leads}</dd>
                  <dt className="text-muted-foreground">Garimpos</dt><dd>{sec.data.counts.garimpos}</dd>
                  <dt className="text-muted-foreground">Clientes</dt><dd>{sec.data.counts.clientes}</dd>
                  <dt className="text-muted-foreground">Projetos</dt><dd>{sec.data.counts.projetos}</dd>
                  <dt className="text-muted-foreground">Registros financeiros</dt><dd>{sec.data.counts.financeiro}</dd>
                </dl>
              ) : <Skeleton className="h-32 w-full" />)}
              {(kind === "block" || kind === "temp_block" || kind === "ban") && (
                <div className="space-y-1.5"><Label>Motivo {kind === "ban" ? "do banimento" : "do bloqueio"} *</Label>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></div>
              )}
              {kind === "ban" && (
                <div className="space-y-1.5"><Label>Observação administrativa (opcional)</Label>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} /></div>
              )}
              {kind === "temp_block" && (
                <div className="space-y-1.5"><Label>Duração</Label>
                  <div className="flex flex-wrap gap-1">
                    {DURATIONS.map(([l, h]) => (
                      <button key={h} type="button" onClick={() => setHours(String(h))}
                        className={`rounded-md border px-2.5 py-1 text-sm ${hours === String(h) ? "border-gold bg-gold-soft font-semibold" : ""}`}>{l}</button>
                    ))}
                    <button type="button" onClick={() => setHours("custom")} className={`rounded-md border px-2.5 py-1 text-sm ${hours === "custom" ? "border-gold bg-gold-soft font-semibold" : ""}`}>Data e hora personalizada</button>
                  </div>
                  {hours === "custom" && <Input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} />}
                </div>
              )}
              {kind === "set_password" && (
                <>
                  <div className="space-y-1.5"><Label>Nova senha</Label><Input type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Confirmar nova senha</Label><Input type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} /></div>
                  {p1 && p1.length < 8 && <p className="text-xs text-destructive">Use pelo menos 8 caracteres.</p>}
                  {p2 && p1 !== p2 && <p className="text-xs text-destructive">As senhas não conferem.</p>}
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={must} onCheckedChange={(v) => setMust(!!v)} />Obrigar troca no próximo acesso</label>
                </>
              )}
              {phrase && (
                <div className="space-y-1.5"><Label>Digite <strong>{phrase}</strong> para confirmar</Label>
                  <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={busy}>Cancelar</Button>
              <Button disabled={busy || !phraseOk || !reasonOk || !untilOk || !pwdOk || (kind === "soft_delete" && !sec.data)}
                variant={destructive ? "destructive" : "default"}
                className={destructive ? "" : "bg-gold text-gold-foreground hover:bg-gold/90"} onClick={run}>
                {busy ? "Aguarde..." : kind === "reset" ? "Enviar" : kind === "set_password" ? "Salvar nova senha" : kind === "temp_password" ? "Gerar senha" : ACTION_LABEL[kind]}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** ⋮ menu in the users table. */
export function AccountMenu({ user, onDone }: { user: { user_id: string; email: string | null; full_name: string | null; status: AccountStatus; is_super_admin: boolean }; onDone: () => void }) {
  const [kind, setKind] = useState<ActionKind | null>(null);
  if (user.is_super_admin) return null;
  const acts = actionsFor(user.status).filter((a) => a !== "block");
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Mais ações"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild><Link to="/admin/usuarios/$id" params={{ id: user.user_id }} search={{ tab: "seguranca" }}>{user.status === "deleted" ? "Visualizar dados administrativos" : "Segurança e senha"}</Link></DropdownMenuItem>
          <DropdownMenuSeparator />
          {acts.map((a) => (
            <DropdownMenuItem key={a} onSelect={() => setKind(a)} className={a === "ban" || a === "soft_delete" || a === "purge" ? "text-destructive" : ""}>
              {a === "unblock" && user.status === "temp_blocked" ? "Desbloquear agora" : a === "soft_delete" ? "Excluir" : ACTION_LABEL[a]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <AccountActionDialog kind={kind} target={{ userId: user.user_id, email: user.email, name: user.full_name }} onClose={() => setKind(null)} onDone={onDone} />
    </>
  );
}

/** "Segurança e acesso" tab. */
export function SecurityPanel({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<ActionKind | null>(null);
  const q = useQuery({ queryKey: ["admin", "security", userId], queryFn: () => rpc<Security>("admin_account_security", { _user_id: userId }) });
  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  if (q.isError || !q.data) return <p className="text-sm text-destructive">Não foi possível carregar os dados.</p>;
  const s = q.data;
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["admin"] }); };
  const row = (l: string, v: React.ReactNode) => <><dt className="text-muted-foreground">{l}</dt><dd>{v}</dd></>;
  const pwdActs: ActionKind[] = ["reset", "set_password", "temp_password", "require_change"];
  const statusActs = actionsFor(s.status);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h3 className="font-semibold">Segurança e acesso</h3>
        <dl className="grid grid-cols-[180px_1fr] gap-y-2 text-sm">
          {row("Status da conta", <AccountBadge s={s.status} />)}
          {row("E-mail", s.email ?? "—")}
          {row("Role", s.role === "super_admin" ? "Super Admin" : s.role ?? "—")}
          {row("Data de cadastro", dt(s.created_at))}
          {row("Último acesso", dt(s.last_seen_at))}
          {row("Última alteração de senha", s.password_changed_at ? dt(s.password_changed_at) : "Não disponível")}
          {row("Troca obrigatória", s.must_change_password ? "Sim, no próximo acesso" : "Não")}
          {row("Bloqueio atual", s.status === "blocked" ? "Bloqueado" : s.status === "temp_blocked" ? "Bloqueado temporariamente" : s.status === "banned" ? "Banido" : s.status === "deleted" ? "Conta excluída" : "Nenhum")}
          {(s.status === "blocked" || s.status === "temp_blocked") && row("Motivo do bloqueio", s.blocked_reason ?? "—")}
          {s.status === "temp_blocked" && row("Bloqueado até", <span className="font-semibold">{blockedUntilText(s.blocked_until)}</span>)}
          {s.status === "banned" && row("Motivo do banimento", s.banned_reason ?? "—")}
          {s.status === "banned" && s.banned_note && row("Observação", s.banned_note)}
          {s.status === "deleted" && row("Excluída em", dt(s.deleted_at))}
        </dl>
        <p className="text-xs text-muted-foreground">A senha atual nunca é exibida. Só é possível enviar recuperação ou definir uma nova.</p>
      </section>
      <section className="space-y-4 rounded-lg border bg-card p-4">
        {s.is_super_admin ? <p className="text-sm text-muted-foreground">A conta do Super Admin não pode ser bloqueada, banida nem excluída.</p> : (
          <>
            {s.status !== "deleted" && (
              <div className="space-y-2"><h3 className="font-semibold">Senha</h3>
                <div className="flex flex-wrap gap-2">{pwdActs.map((a) => <Button key={a} size="sm" variant="outline" onClick={() => setKind(a)}>{ACTION_LABEL[a]}</Button>)}</div>
              </div>
            )}
            <div className="space-y-2"><h3 className="font-semibold">Acesso</h3>
              <div className="flex flex-wrap gap-2">
                {statusActs.map((a) => (
                  <Button key={a} size="sm" variant={a === "ban" || a === "soft_delete" || a === "purge" ? "destructive" : "outline"} onClick={() => setKind(a)}>
                    {a === "unblock" && s.status === "temp_blocked" ? "Desbloquear agora" : ACTION_LABEL[a]}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
      <AccountActionDialog kind={kind} target={{ userId, email: s.email, name: s.full_name }} status={s.status} onClose={() => setKind(null)} onDone={refresh} />
    </div>
  );
}
