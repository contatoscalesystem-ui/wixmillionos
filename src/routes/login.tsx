import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, statusPath } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — WIX MILLION OS" },
      { name: "description", content: "Acesso à central de operação comercial WIX MILLION OS." },
      { property: "og:title", content: "Entrar — WIX MILLION OS" },
      { property: "og:description", content: "Acesso à central de operação comercial WIX MILLION OS." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { session, loading, checked, account } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session && checked) navigate({ to: statusPath(account?.status) });
  }, [session, loading, checked, account, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      void supabase.rpc("log_event" as never, { _type: "LOGIN" } as never);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(
        /invalid login/i.test(msg) ? "E-mail ou senha incorretos."
          : /not confirmed/i.test(msg) ? "Confirme seu e-mail antes de entrar."
          : "Não foi possível entrar. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="text-sm font-semibold tracking-[0.3em] text-gold">WIX MILLION</div>
        <div>
          <h1 className="text-5xl font-extrabold leading-tight text-sidebar-accent-foreground">WIX MILLION OS</h1>
          <p className="mt-4 text-sm uppercase tracking-[0.25em] text-sidebar-foreground/70">Central de operação comercial</p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">Garimpo → Leads → Abordagem → Conversão → Produção → Financeiro</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <div className="text-xs font-semibold tracking-[0.3em] text-gold lg:hidden">WIX MILLION OS</div>
            <h2 className="mt-2 text-2xl font-bold">Entrar</h2>
            <p className="text-sm text-muted-foreground">Acesse a central de operação.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full bg-gold text-gold-foreground hover:bg-gold/90" disabled={busy}>
            {busy ? "Aguarde..." : "Entrar"}
          </Button>
          <Link to="/cadastro" className="block w-full text-center text-sm text-muted-foreground hover:text-foreground">
            Não tem conta? Criar conta
          </Link>
        </form>
      </div>
    </div>
  );
}
