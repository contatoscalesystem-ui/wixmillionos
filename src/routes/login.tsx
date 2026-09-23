import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — WIX MILLION OS" },
      { name: "description", content: "Acesso à central de operação comercial da WIX MILLION." },
      { property: "og:title", content: "Entrar — WIX MILLION OS" },
      { property: "og:description", content: "Acesso à central de operação comercial da WIX MILLION." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [signupOpen, setSignupOpen] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.rpc("signup_open").then(({ data }) => setSignupOpen(data ?? false));
  }, []);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [session, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: name } },
        });
        if (error) throw error;
        if (!data.session) toast.success("Conta criada. Confirme seu e-mail para entrar.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(
        /invalid login/i.test(msg) ? "E-mail ou senha incorretos."
          : /not confirmed/i.test(msg) ? "Confirme seu e-mail antes de entrar."
          : /database error saving new user|SIGNUP_INVITE_ONLY/i.test(msg) ? "Novos acessos são liberados somente por convite."
          : /already registered/i.test(msg) ? "Este e-mail já possui conta."
          : /password/i.test(msg) ? "A senha precisa ter pelo menos 6 caracteres."
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
            <h2 className="mt-2 text-2xl font-bold">{mode === "in" ? "Entrar" : "Criar conta"}</h2>
            <p className="text-sm text-muted-foreground">
              {mode === "in" ? "Acesse a central de operação." : signupOpen ? "O primeiro usuário cadastrado vira administrador." : "Use exatamente o e-mail que recebeu o convite."}
            </p>
            {mode === "up" && signupOpen === false && (
              <p role="status" className="mt-3 rounded-md border border-gold/40 bg-gold/10 p-3 text-sm">Novos acessos são liberados somente por convite.</p>
            )}
          </div>
          {mode === "up" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome completo</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full bg-gold text-gold-foreground hover:bg-gold/90" disabled={busy}>
            {busy ? "Aguarde..." : mode === "in" ? "Entrar" : "Criar conta"}
          </Button>
          <button type="button" className="w-full text-center text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
