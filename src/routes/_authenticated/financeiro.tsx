import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog, EmptyState, PageHeader, StatCard } from "@/components/crm";
import { FINANCIAL_STATUS, fmtDate, fmtMoney, friendlyError, labelOf, sumByCurrency, type FinancialStatus, type Tables } from "@/lib/crm";
import { useClients, useFinance, useInvalidate } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — WIX MILLION OS" },
      { name: "description", content: "Vendas e comissões registradas manualmente." },
      { property: "og:title", content: "Financeiro — WIX MILLION OS" },
      { property: "og:description", content: "Vendas e comissões registradas manualmente." },
    ],
  }),
  component: FinanceiroPage,
});

type E = Tables<"financial_entries">;
const NONE = "__none";
const CURRENCIES = ["BRL", "USD", "EUR"];
const empty = { description: "", client_id: NONE, platform_amount: "", platform_currency: "BRL", commission_amount: "", commission_currency: "BRL", status: "pendente" as FinancialStatus, expected_date: "", paid_date: "" };

function FinanceiroPage() {
  const { data, isLoading } = useFinance();
  const { data: clients } = useClients();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<E | null>(null);
  const [f, setF] = useState(empty);
  const [del, setDel] = useState<E | null>(null);

  const rows = data ?? [];
  const live = rows.filter((r) => r.status !== "cancelado");
  const com = (e: E): [number | null, string] => [e.commission_amount, e.commission_currency];

  const openForm = (e?: E) => {
    setEditing(e ?? null);
    setF(e ? {
      description: e.description ?? "", client_id: e.client_id ?? NONE, platform_amount: e.platform_amount?.toString() ?? "", platform_currency: e.platform_currency,
      commission_amount: e.commission_amount?.toString() ?? "", commission_currency: e.commission_currency, status: e.status, expected_date: e.expected_date ?? "", paid_date: e.paid_date ?? "",
    } : empty);
    setOpen(true);
  };
  const num = (v: string) => (v.trim() === "" || isNaN(Number(v.replace(",", "."))) ? null : Number(v.replace(",", ".")));
  const save = async () => {
    const client = clients?.find((c) => c.id === f.client_id);
    const payload = {
      type: "venda", description: f.description || null, client_id: client?.id ?? null, lead_id: client?.lead_id ?? null,
      platform_amount: num(f.platform_amount), platform_currency: f.platform_currency,
      commission_amount: num(f.commission_amount), commission_currency: f.commission_currency,
      status: f.status, expected_date: f.expected_date || null, paid_date: f.paid_date || null,
    };
    const { error } = editing ? await supabase.from("financial_entries").update(payload).eq("id", editing.id) : await supabase.from("financial_entries").insert(payload);
    if (error) return toast.error(friendlyError(error));
    toast.success(editing ? "Lançamento atualizado." : "Venda registrada.");
    setOpen(false);
    invalidate("financial_entries");
  };
  const remove = async () => {
    const { error } = await supabase.from("financial_entries").delete().eq("id", del!.id);
    setDel(null);
    if (error) return toast.error(friendlyError(error));
    toast.success("Lançamento excluído.");
    invalidate("financial_entries");
  };

  return (
    <div>
      <PageHeader title="Financeiro" subtitle="Registre manualmente vendas e comissões."
        actions={<Button className="bg-gold text-gold-foreground hover:bg-gold/90" onClick={() => openForm()}><Plus className="mr-1 h-4 w-4" />Registrar venda</Button>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Comissão prevista" highlight value={sumByCurrency(live, com)} />
        <StatCard label="A receber" value={sumByCurrency(live.filter((r) => ["pendente", "confirmado", "a_receber"].includes(r.status)), com)} />
        <StatCard label="Recebida" highlight value={sumByCurrency(rows.filter((r) => r.status === "recebido"), com)} />
        <StatCard label="Vendas" value={live.length} />
      </div>
      {isLoading ? <Skeleton className="h-48" /> : !rows.length ? (
        <EmptyState title="Nenhum lançamento financeiro." text="Registre a primeira venda quando ela acontecer." />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{["Venda", "Cliente", "Valor plataforma", "Comissão", "Status", "Prevista", "Recebida", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{e.description || "Venda"}</td>
                  <td className="px-4 py-3">{clients?.find((c) => c.id === e.client_id)?.company_name ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{e.platform_amount != null ? fmtMoney(Number(e.platform_amount), e.platform_currency) : "—"}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-gold">{e.commission_amount != null ? fmtMoney(Number(e.commission_amount), e.commission_currency) : "—"}</td>
                  <td className="px-4 py-3">{labelOf(FINANCIAL_STATUS, e.status)}</td>
                  <td className="px-4 py-3">{fmtDate(e.expected_date)}</td>
                  <td className="px-4 py-3">{fmtDate(e.paid_date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => openForm(e)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => setDel(e)}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar lançamento" : "Registrar venda"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5"><Label>Venda (descrição)</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Cliente</Label>
              <Select value={f.client_id} onValueChange={(v) => setF({ ...f, client_id: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={NONE}>Sem cliente</SelectItem>{(clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Valor pago na plataforma</Label><Input inputMode="decimal" value={f.platform_amount} onChange={(e) => setF({ ...f, platform_amount: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Moeda</Label>
              <Select value={f.platform_currency} onValueChange={(v) => setF({ ...f, platform_currency: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Comissão prevista</Label><Input inputMode="decimal" value={f.commission_amount} onChange={(e) => setF({ ...f, commission_amount: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Moeda da comissão</Label>
              <Select value={f.commission_currency} onValueChange={(v) => setF({ ...f, commission_currency: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            <div className="col-span-2 space-y-1.5"><Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as FinancialStatus })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FINANCIAL_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Data prevista</Label><Input type="date" value={f.expected_date} onChange={(e) => setF({ ...f, expected_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Data recebida</Label><Input type="date" value={f.paid_date} onChange={(e) => setF({ ...f, paid_date: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} destructive title="Excluir lançamento?" confirmLabel="Excluir" onConfirm={remove} />
    </div>
  );
}
