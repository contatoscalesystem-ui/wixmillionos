import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/crm";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EVENT_LABEL, dt, eventSentence, rpc, type PlatformEvent } from "@/lib/admin";

export const Route = createFileRoute("/admin/atividade")({ component: ActivityPage });

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

function ActivityPage() {
  const q = useQuery({ queryKey: ["admin", "activity", 2000], queryFn: () => rpc<PlatformEvent[]>("admin_activity", { _limit: 2000 }) });
  const [user, setUser] = useState(""); const [type, setType] = useState(""); const [ws, setWs] = useState(""); const [day, setDay] = useState("");
  const all = q.data ?? [];
  const users = useMemo(() => [...new Map(all.filter((e) => e.user_id).map((e) => [e.user_id!, e.full_name || e.email || "—"])).entries()], [all]);
  const wss = useMemo(() => [...new Map(all.filter((e) => e.workspace_id).map((e) => [e.workspace_id!, e.workspace_name || "—"])).entries()], [all]);
  const rows = all.filter((e) => (!user || e.user_id === user) && (!type || e.event_type === type) && (!ws || e.workspace_id === ws)
    && (!day || new Date(e.created_at).toLocaleDateString("sv-SE") === day));
  return (
    <div className="space-y-6">
      <PageHeader title="Atividade global" subtitle="Linha do tempo de todas as contas." />
      <div className="flex flex-wrap gap-3">
        <select className={sel} value={user} onChange={(e) => setUser(e.target.value)}><option value="">Todos os usuários</option>{users.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        <select className={sel} value={type} onChange={(e) => setType(e.target.value)}><option value="">Todos os tipos</option>{Object.entries(EVENT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select className={sel} value={ws} onChange={(e) => setWs(e.target.value)}><option value="">Todos os ambientes</option>{wss.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-44" />
      </div>
      {!q.data ? <Skeleton className="h-40 w-full" /> : rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma atividade encontrada.</p> : (
        <ul className="divide-y rounded-lg border bg-card">
          {rows.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-sm">
              <span className="w-32 shrink-0 font-medium">{dt(e.created_at)}</span>
              <span className="flex-1">{eventSentence(e)}</span>
              <span className="text-xs text-muted-foreground">{e.workspace_name ?? ""}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
