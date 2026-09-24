import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, statusPath } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — WIX MILLION OS" },
      { name: "description", content: "Cadastre-se no WIX MILLION OS e aguarde a aprovação do seu acesso." },
      { property: "og:title", content: "Criar conta — WIX MILLION OS" },
      { property: "og:description", content: "Cadastre-se no WIX MILLION OS e aguarde a aprovação do seu acesso." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { session, loading, checked, account } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!loading && session && checked) navigate({ to: statusPath(account?.status, account?.must_change_password) });
  }, [loading, session, checked, account, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error("As senhas não conferem."); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin + "/aguardando-aprovacao", data: { full_name: name.trim() } },
      });
      if (error) throw error;
      if (!data.session) setSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(
        /already registered/i.test(msg) ? "Este e-mail já possui conta."
          : /password/i.test(msg) ? "A senha precisa ter pelo menos 6 caracteres."
          : "Não foi possível criar a conta. Tente novamente.",
      );
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      {sent ? (
        <div className="w-full max-w-sm space-y-3 text-center">
          <div className="text-xs font-semibold tracking-[0.3em] text-gold">WIX MILLION OS</div>
          <h1 className="text-2xl font-bold">Confirme seu e-mail</h1>
          <p className="text-sm text-muted-foreground">Enviamos um link de confirmação para {email}. Depois de confirmar, sua conta ficará aguardando aprovação.</p>
          <Link to="/login" className="text-sm underline">Voltar para o login</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <div className="text-xs font-semibold tracking-[0.3em] text-gold">WIX MILLION OS</div>
            <h1 className="mt-2 text-2xl font-bold">Criar conta</h1>
            <p className="text-sm text-muted-foreground">Seu acesso será liberado depois da aprovação.</p>
          </div>
          <div className="space-y-1.5"><Label htmlFor="name">Nome completo</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label htmlFor="password">Senha</Label><Input id="password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label htmlFor="confirm">Confirmar senha</Label><Input id="confirm" type="password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></div>
          <Button type="submit" className="w-full bg-gold text-gold-foreground hover:bg-gold/90" disabled={busy}>{busy ? "Aguarde..." : "Criar conta"}</Button>
          <Link to="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground">Já tem conta? Entrar</Link>
        </form>
      )}
    </div>
  );
}
