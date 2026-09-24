import { useEffect, useState } from "react";
import { Info, AlertTriangle, AlertOctagon, Wrench, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { rpc } from "@/lib/admin";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Note = { id: string; title: string; message: string; type: "information" | "warning" | "important" | "maintenance" | "welcome" };

const STYLE: Record<Note["type"], { icon: typeof Info; label: string; cls: string }> = {
  information: { icon: Info, label: "Informação", cls: "text-foreground" },
  warning: { icon: AlertTriangle, label: "Aviso", cls: "text-gold" },
  important: { icon: AlertOctagon, label: "Importante", cls: "text-destructive" },
  maintenance: { icon: Wrench, label: "Manutenção", cls: "text-muted-foreground" },
  welcome: { icon: Sparkles, label: "Boas-vindas", cls: "text-gold" },
};

/** Shows admin messages (and the one-time welcome) as a queue of pop-ups. Never blocks navigation on failure. */
export function NotificationsGate() {
  const { session, account, refreshProfile } = useAuth();
  const [queue, setQueue] = useState<Note[]>([]);
  const uid = session?.user.id;

  useEffect(() => {
    if (!uid || account?.status !== "approved") return;
    let alive = true;
    (async () => {
      try {
        const [{ data: notes }, { data: receipts }] = await Promise.all([
          supabase.from("admin_notifications" as never).select("id,title,message,type,created_at").order("created_at"),
          supabase.from("notification_receipts" as never).select("notification_id,acknowledged_at").eq("user_id", uid),
        ]);
        const done = new Set(((receipts ?? []) as { notification_id: string; acknowledged_at: string | null }[])
          .filter((r) => r.acknowledged_at).map((r) => r.notification_id));
        const pending = ((notes ?? []) as Note[]).filter((n) => !done.has(n.id));
        const list: Note[] = [];
        if (account.show_welcome) list.push({
          id: "welcome", type: "welcome", title: "Bem-vindo ao WIX MILLION OS",
          message: "Seu ambiente está pronto.\n\nComece criando seu primeiro garimpo ou importando seu relatório da Manus.",
        });
        if (alive) setQueue([...list, ...pending]);
      } catch { /* never break navigation */ }
    })();
    return () => { alive = false; };
  }, [uid, account?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = queue[0];
  useEffect(() => {
    if (!current || current.id === "welcome" || !uid) return;
    void supabase.from("notification_receipts" as never).upsert(
      { notification_id: current.id, user_id: uid } as never, { onConflict: "notification_id,user_id", ignoreDuplicates: true },
    );
  }, [current?.id, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const ack = async () => {
    if (!current) return;
    setQueue((q) => q.slice(1));
    try {
      if (current.id === "welcome") { await rpc("ack_welcome"); void refreshProfile(); }
      else await supabase.from("notification_receipts" as never).upsert(
        { notification_id: current.id, user_id: uid, acknowledged_at: new Date().toISOString() } as never,
        { onConflict: "notification_id,user_id" },
      );
    } catch { /* ignore */ }
  };

  if (!current) return null;
  const st = STYLE[current.type] ?? STYLE.information;
  const Icon = st.icon;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) void ack(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] ${st.cls}`}>
            <Icon className="h-4 w-4" /> {st.label}
          </div>
          <DialogTitle className="text-xl">{current.title}</DialogTitle>
          <DialogDescription className="whitespace-pre-line text-sm text-foreground/80">{current.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button className="bg-gold text-gold-foreground hover:bg-gold/90" onClick={() => void ack()}>
            {current.id === "welcome" ? "Começar" : "Entendi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
