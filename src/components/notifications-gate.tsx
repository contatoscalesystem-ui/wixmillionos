import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { rpc } from "@/lib/admin";
import { NoticeModal, type NoticeData } from "@/components/notice-modal";

type Note = NoticeData & { id: string };

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
          // Filter in the query (Super Admin's RLS can read all rows; they must still only receive their own).
          supabase.from("admin_notifications" as never).select("id,title,message,type,extra_title,extra_message,created_at")
            .or(`target_type.eq.all,and(target_type.eq.specific_user,target_user_id.eq.${uid})`)
            .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
            .order("created_at"),
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

  const current = queue[0] ?? null;
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

  return <NoticeModal key={current?.id} notice={current} onAck={() => void ack()} actionLabel={current?.id === "welcome" ? "Começar" : "Entendi"} />;
}
