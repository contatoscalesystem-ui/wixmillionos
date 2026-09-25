import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { dt, rpc, type AdminUser } from "@/lib/admin";
import { friendlyError } from "@/lib/crm";
import { NoticeModal, NOTICE_TYPES } from "@/components/notice-modal";

export const Route = createFileRoute("/admin/mensagens")({ component: MessagesPage });

const TYPES = Object.entries(NOTICE_TYPES).filter(([k]) => k !== "welcome").map(([k, v]) => [k, v.label] as const);
const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
type Note = { id: string; title: string; type: string; target_type: string; target_user_id: string | null; created_at: string; expires_at: string | null };

function MessagesPage() {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["admin", "users"], queryFn: () => rpc<AdminUser[]>("admin_list_users") });
  const list = useQuery({
    queryKey: ["admin", "notifications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_notifications" as never).select("id,title,type,target_type,target_user_id,created_at,expires_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Note[];
    },
  });
  const receipts = useQuery({
    queryKey: ["admin", "receipts"],
    queryFn: async () => {
      const { data } = await supabase.from("notification_receipts" as never).select("notification_id,acknowledged_at");
      return (data ?? []) as unknown as { notification_id: string; acknowledged_at: string | null }[];
    },
  });
  const [title, setTitle] = useState(""); const [message, setMessage] = useState("");
  const [type, setType] = useState<string>("information"); const [target, setTarget] = useState<"all" | "specific_user">("all");
  const [extraTitle, setExtraTitle] = useState(""); const [extraMsg, setExtraMsg] = useState(""); const [preview, setPreview] = useState(false);
  const [userId, setUserId] = useState(""); const [expires, setExpires] = useState(""); const [busy, setBusy] = useState(false);
  const active = (users.data ?? []).filter((u) => u.status === "approved");
  const name = (id: string | null) => { const u = users.data?.find((x) => x.user_id === id); return u?.full_name || u?.email || "—"; };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (target === "specific_user" && !userId) { toast.error("Escolha o usuário."); return; }
    if (expires && new Date(expires).getTime() <= Date.now() + 5 * 60_000) {
      toast.error("A data de expiração já passou ou está muito próxima. Escolha um horário futuro ou deixe em branco."); return;
    }
    setBusy(true);
    const { error } = await supabase.from("admin_notifications" as never).insert({
      title: title.trim(), message: message.trim(), type, extra_title: extraTitle.trim() || null, extra_message: extraMsg.trim() || null, target_type: target, show_once: true,
      target_user_id: target === "specific_user" ? userId : null, expires_at: expires ? new Date(expires).toISOString() : null,
    } as never);
    setBusy(false);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Mensagem enviada. Aparece no próximo acesso.");
    setTitle(""); setMessage(""); setExtraTitle(""); setExtraMsg(""); void qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("admin_notifications" as never).delete().eq("id", id);
    if (error) toast.error(friendlyError(error)); else { toast.success("Mensagem removida."); void qc.invalidateQueries({ queryKey: ["admin", "notifications"] }); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Mensagens" subtitle="Avisos que aparecem uma única vez, como pop-up, no próximo acesso." />
      <form onSubmit={submit} className="grid max-w-2xl gap-4 rounded-lg border bg-card p-5">
        <div className="space-y-1.5"><Label htmlFor="t">Título</Label><Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
        <div className="space-y-1.5"><Label htmlFor="m">Mensagem</Label><Textarea id="m" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} required /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="et">Título adicional (opcional)</Label><Input id="et" value={extraTitle} onChange={(e) => setExtraTitle(e.target.value)} placeholder="Informação adicional" /></div>
          <div className="space-y-1.5"><Label htmlFor="em">Texto adicional (opcional)</Label><Textarea id="em" rows={2} value={extraMsg} onChange={(e) => setExtraMsg(e.target.value)} /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5"><Label>Tipo</Label><select className={sel} value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div className="space-y-1.5"><Label>Destino</Label><select className={sel} value={target} onChange={(e) => setTarget(e.target.value as "all" | "specific_user")}><option value="all">Todos os usuários ativos</option><option value="specific_user">Usuário específico</option></select></div>
          <div className="space-y-1.5"><Label>Expira em (opcional)</Label><Input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
        </div>
        {target === "specific_user" && (
          <div className="space-y-1.5"><Label>Usuário</Label><select className={sel} value={userId} onChange={(e) => setUserId(e.target.value)}><option value="">Escolha…</option>{active.map((u) => <option key={u.user_id} value={u.user_id}>{u.full_name || u.email}</option>)}</select></div>
        )}
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!title.trim() || !message.trim()} onClick={() => setPreview(true)}>Pré-visualizar</Button>
        <Button type="submit" disabled={busy} className="w-fit bg-gold text-gold-foreground hover:bg-gold/90">{busy ? "Enviando..." : "Enviar mensagem"}</Button></div>
      </form>
      <NoticeModal notice={preview ? { title, message, type, extra_title: extraTitle, extra_message: extraMsg } : null} onAck={() => setPreview(false)} />
      {!list.data ? <Skeleton className="h-24 w-full" /> : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr>{["Enviada", "Título", "Tipo", "Destino", "Confirmaram", "Expira", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {list.data.length === 0 ? <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nenhuma mensagem enviada.</td></tr> : list.data.map((n) => (
                <tr key={n.id} className="border-t">
                  <td className="px-3 py-2">{dt(n.created_at)}</td><td className="px-3 py-2 font-medium">{n.title}</td>
                  <td className="px-3 py-2">{TYPES.find((t) => t[0] === n.type)?.[1]}</td>
                  <td className="px-3 py-2">{n.target_type === "all" ? "Todos" : name(n.target_user_id)}</td>
                  <td className="px-3 py-2">{(receipts.data ?? []).filter((r) => r.notification_id === n.id && r.acknowledged_at).length}</td>
                  <td className="px-3 py-2">{dt(n.expires_at)}</td>
                  <td className="px-3 py-2"><Button size="sm" variant="ghost" onClick={() => remove(n.id)}>Remover</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
