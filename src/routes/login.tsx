import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, statusPath } from "@/hooks/use-auth";
import panelAsset from "@/assets/login-panel.png.asset.json";
import symbolAsset from "@/assets/million-symbol.png.asset.json";

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
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session && checked) navigate({ to: statusPath(account?.status, account?.must_change_password) });
  }, [session, loading, checked, account, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      void supabase.rpc("log_event" as never, { _type: "LOGIN" } as never);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setErr(
        /invalid login/i.test(msg) ? "E-mail ou senha incorretos."
          : /not confirmed/i.test(msg) ? "Confirme seu e-mail antes de entrar."
          : "Não foi possível entrar. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "block h-[62px] [@media(min-width:1024px)_and_(max-height:820px)]:h-[52px] w-full rounded-[11px] border border-[#E0E0DC] bg-white px-4 text-[16px] text-[#171717] shadow-[0_4px_14px_rgba(0,0,0,0.05)] outline-none transition-[border-color,box-shadow] duration-200 focus:border-[#C79A32] focus:shadow-[0_4px_14px_rgba(0,0,0,0.05),0_0_0_3px_rgba(199,154,50,0.12)]";

  return (
    <div className="grid min-h-[100dvh] w-full bg-[#FAFAF7] lg:h-screen lg:grid-cols-2 lg:overflow-hidden">
      <div className="relative hidden h-full overflow-hidden bg-[#101010] lg:block">
        <img src={panelAsset.url} alt="WIX MILLION OS — Central de operação comercial" className="absolute inset-0 h-full w-full object-cover object-center" />
      </div>
      <div className="flex items-center justify-center px-6 py-10 lg:py-6">
        <form onSubmit={submit} className="w-[min(470px,100%)]">
          <div className="flex flex-col items-center">
            <img src={symbolAsset.url} alt="" className="h-auto w-[170px] mix-blend-multiply sm:w-[200px] lg:w-[min(210px,17vh)]" />
            <div className="mt-1 whitespace-nowrap text-[28px] font-normal tracking-[0.32em] text-[#101010] sm:text-[34px] lg:text-[36px]">
              MILLION <span className="text-[#C39A39]">OS</span>
            </div>
          </div>
          <h2 className="mt-12 text-[36px] font-bold leading-tight text-[#171717] lg:mt-[min(56px,4.5vh)] lg:text-[40px]">Entrar</h2>
          <p className="mt-1.5 text-[18px] text-[#777771]">Acesse a central de operação.</p>
          <div className="mt-9 lg:mt-[min(40px,4.5vh)]">
            <label htmlFor="email" className="mb-2 block text-[16px] font-medium text-[#171717]">E-mail</label>
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(null); }} required className={inputCls} />
          </div>
          <div className="mt-7 lg:mt-[min(28px,3vh)]">
            <label htmlFor="password" className="mb-2 block text-[16px] font-medium text-[#171717]">Senha</label>
            <div className="relative">
              <input id="password" type={show ? "text" : "password"} autoComplete="current-password" minLength={6} value={password} onChange={(e) => { setPassword(e.target.value); setErr(null); }} required className={inputCls + " pr-12"} />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1.5 text-[#8a8a84] transition-colors hover:text-[#171717]">
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <p role="alert" className="min-h-[22px] pt-2 text-sm text-[#C0504D]">{err ?? ""}</p>
          <button
            type="submit"
            disabled={busy}
            className="mt-1 flex h-[62px] [@media(min-width:1024px)_and_(max-height:820px)]:h-[54px] w-full items-center justify-center gap-2 rounded-[11px] bg-[linear-gradient(90deg,#B78A25_0%,#C99D39_45%,#E0B954_75%,#BF9028_100%)] text-[17px] font-semibold text-white shadow-[0_10px_30px_rgba(190,145,40,0.22),0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-200 ease-out hover:-translate-y-px hover:brightness-[1.06] hover:shadow-[0_14px_34px_rgba(190,145,40,0.3),0_2px_8px_rgba(0,0,0,0.08)] disabled:cursor-wait disabled:hover:translate-y-0"
          >
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Entrando...</> : "Entrar"}
          </button>
          <p className="mt-8 [@media(min-width:1024px)_and_(max-height:820px)]:mt-5 text-center text-[16px] text-[#777771]">
            Não tem conta?{" "}
            <Link to="/cadastro" className="font-medium text-[#C39A39] underline-offset-4 transition-colors hover:text-[#A8822B] hover:underline">Criar conta</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
