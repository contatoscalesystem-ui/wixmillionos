import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog, PageHeader } from "@/components/crm";
import { useAuth } from "@/hooks/use-auth";
import { fmtDate, friendlyError, type Tables } from "@/lib/crm";
import { useInvalidate, useProfiles } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/configuracoes_/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — WIX MILLION OS" },
      { name: "description", content: "Membros, convites e permissões da equipe." },
      { property: "og:title", content: "Equipe — WIX MILLION OS" },
      { property: "og:description", content: "Membros, convites e permissões da equipe." },
    ],
  }),
  component: TeamPage,
});

const INVITE_STATUS: Record<string, string> = { pending: "Pendente", accepted: "Aceito", revoked: "Cancelado" };

function TeamPage() {
  const { role, session } = useAuth();
  const isAdmin = role === "admin";
  const { data: profiles } = useProfiles();
  const invalidate = useInvalidate();
  const rolesQ = useQuery({
    queryKey: ["user_roles"],
    queryFn: async () => { const { data, error } = await supabase.from("user_roles").select("*"); if (error) throw error; return data; },
  });
  const invitesQ = useQuery({
    enabled: isAdmin,
    queryKey: ["workspace_invites"],
    queryFn: async () => { const { data, error } = await supabase.from("workspace_invites").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });
  const [email, setEmail] = useState("");
  const [remove, setRemove] = useState<Tables<"profiles"> | null>(null);

  const rolesOf = (id: string) => (rolesQ.data ?? []).filter((r) => r.user_id === id).map((r) => r.role);
  const members = (profiles ?? []).map((p) => ({ p, roles: rolesOf(p.id) }));

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) return toast.error("Informe um e-mail válido.");
    if (members.some((m) => m.p.email?.toLowerCase() === em && m.roles.length)) return toast.error("Este e-mail já é membro da equipe.");
    const { error } = await supabase.from("workspace_invites").insert({ email: em, role: "operador" });
    if (error) return toast.error(/duplicate|unique/i.test(error.message) ? "Já existe um convite pendente para este e-mail." : friendlyError(error));
    toast.success("Convite registrado. Peça para a pessoa criar a conta com este e-mail em /login.");
    setEmail(""); invalidate("workspace_invites");
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("workspace_invites").update({ status: "revoked" }).eq("id", id);
    if (error) return toast.error(friendlyError(error));
    toast.success("Convite cancelado."); invalidate("workspace_invites");
  };

  const toggleAdmin = async (p: Tables<"profiles">, isAdm: boolean) => {
    if (isAdm && !rolesOf(p.id).includes("operador")) {
      const { error: e1 } = await supabase.from("user_roles").insert({ user_id: p.id, workspace_id: p.workspace_id, role: "operador" });
      if (e1) return toast.error(friendlyError(e1));
    }
    const { error } = isAdm
      ? await supabase.from("user_roles").delete().eq("user_id", p.id).eq("role", "admin")
      : await supabase.from("user_roles").insert({ user_id: p.id, workspace_id: p.workspace_id, role: "admin" });
    if (error) return toast.error(friendlyError(error));
    toast.success("Função atualizada."); invalidate("user_roles");
  };

  const removeAccess = async () => {
    const p = remove; setRemove(null);
    if (!p) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", p.id);
    if (error) return toast.error(friendlyError(error));
    toast.success("Acesso removido."); invalidate("user_roles");
  };

  return (
    <div className="space-y-5">
      <Link to="/configuracoes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Configurações</Link>
      <PageHeader title="Equipe" subtitle={isAdmin ? "Convide operadores e gerencie o acesso." : "Somente administradores podem convidar ou remover membros."} />

      {isAdmin && (
        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-3 font-semibold">Convidar operador</h2>
          <form onSubmit={invite} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5"><Label htmlFor="inv">E-mail</Label><Input id="inv" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@empresa.com" /></div>
            <Button type="submit" className="bg-gold text-gold-foreground hover:bg-gold/90">Convidar</Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">O convite libera o cadastro deste e-mail na tela de login. Nenhum e-mail é enviado automaticamente — avise a pessoa.</p>
        </div>
      )}

      <div className="rounded-lg border bg-card p-5">
        <h2 className="mb-2 font-semibold">Membros</h2>
        <ul className="divide-y">
          {members.map(({ p, roles }) => {
            const adm = roles.includes("admin");
            const active = roles.length > 0;
            return (
              <li key={p.id} className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div><div className="font-medium">{p.full_name || "—"}</div><div className="text-xs text-muted-foreground">{p.email}</div></div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={active ? "text-foreground" : "text-muted-foreground"}>{!active ? "Acesso removido" : adm ? "Admin" : "Operador"}</span>
                  {isAdmin && active && p.id !== session?.user.id && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => toggleAdmin(p, adm)}>{adm ? "Tornar operador" : "Tornar admin"}</Button>
                      <Button size="sm" variant="outline" onClick={() => setRemove(p)}>Remover acesso</Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {isAdmin && (
        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-2 font-semibold">Convites</h2>
          {!invitesQ.data?.length ? <p className="text-sm text-muted-foreground">Nenhum convite enviado.</p> : (
            <ul className="divide-y">
              {invitesQ.data.map((i) => (
                <li key={i.id} className="flex items-center justify-between py-3 text-sm">
                  <div><div className="font-medium">{i.email}</div><div className="text-xs text-muted-foreground">Convidado em {fmtDate(i.created_at)}{i.accepted_at ? ` · aceito em ${fmtDate(i.accepted_at)}` : ""}</div></div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{INVITE_STATUS[i.status] ?? i.status}</span>
                    {i.status === "pending" && <Button size="sm" variant="outline" onClick={() => revoke(i.id)}>Cancelar</Button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog open={!!remove} onOpenChange={(o) => !o && setRemove(null)} destructive title="Remover acesso?" text={`${remove?.full_name || remove?.email} deixará de acessar todos os dados do workspace. O histórico registrado por essa pessoa é mantido. Para devolver o acesso, envie um novo convite.`} confirmLabel="Remover acesso" onConfirm={removeAccess} />
    </div>
  );
}
