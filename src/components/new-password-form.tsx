import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewPasswordForm({ onSaved }: { onSaved: () => Promise<void> | void }) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = p1.length >= 8 && p1 === p2;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: p1 });
      if (error) throw error;
      await supabase.rpc("complete_password_change" as never);
      toast.success("Senha alterada.");
      await onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(/same|different/i.test(msg) ? "A nova senha precisa ser diferente da anterior." : /weak|pwned|leaked/i.test(msg) ? "Essa senha é fraca ou conhecida. Escolha outra." : "Não foi possível alterar a senha. Tente novamente.");
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4 text-left">
      <div className="space-y-1.5"><Label htmlFor="np1">Nova senha</Label><Input id="np1" type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} required /></div>
      <div className="space-y-1.5"><Label htmlFor="np2">Confirmar nova senha</Label><Input id="np2" type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} required /></div>
      {p1 && p1.length < 8 && <p className="text-xs text-destructive">Use pelo menos 8 caracteres.</p>}
      {p2 && p1 !== p2 && <p className="text-xs text-destructive">As senhas não conferem.</p>}
      <Button type="submit" disabled={!ok || busy} className="w-full bg-gold text-gold-foreground hover:bg-gold/90">{busy ? "Aguarde..." : "Salvar nova senha"}</Button>
    </form>
  );
}
