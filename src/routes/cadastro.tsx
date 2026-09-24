import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import panelAsset from "@/assets/login-panel.png.asset.json";
import symbolAsset from "@/assets/million-symbol.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, statusPath } from "@/hooks/use-auth";

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
  const [show, setShow] = useState(false);
  const [showC, setShowC] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session && checked) navigate({ to: statusPath(account?.status, account?.must_change_password) });
  }, [loading, session, checked, account, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (password !== confirm) { setErr("As senhas não coincidem."); return; }
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
      setErr(
        /already registered/i.test(msg) ? "Este e-mail já possui conta."
          : /password/i.test(msg) ? "A senha precisa ter pelo menos 6 caracteres."
          : "Não foi possível criar a conta. Tente novamente.",
      );
    } finally { setBusy(false); }
  };

  const inputCls =
    "block h-12 w-full rounded-[10px] border border-[#E0E0DC] bg-white px-4 text-[15px] text-[#171717] shadow-[0_4px_14px_rgba(0,0,0,0.05)] outline-none transition-[border-color,box-shadow] duration-200 focus:border-[#C79A32] focus:shadow-[0_4px_14px_rgba(0,0,0,0.05),0_0_0_3px_rgba(199,154,50,0.12)]";
  const labelCls = "mb-1.5 block text-[14px] font-medium text-[#171717]";
  const eyeCls = "absolute right-3 top-1/2 -translate-y-1/2 rounded p-1.5 text-[#8a8a84] transition-colors hover:text-[#171717]";
  const clear = () => setErr(null);

  return (
    <div className="grid min-h-[100dvh] w-full bg-[#FAFAF7] lg:h-screen lg:grid-cols-2 lg:overflow-hidden">
      <div className="relative hidden h-full overflow-hidden bg-[#101010] lg:block">
        <img src={panelAsset.url} alt="WIX MILLION OS — Central de operação comercial" className="absolute inset-0 h-full w-full object-cover object-left" />
      </div>
      <div className="flex items-center justify-center px-6 py-10 lg:overflow-y-auto lg:py-6">
        <div className="w-[min(400px,100%)]">
          <div className="flex flex-col items-center">
            <img src={symbolAsset.url} alt="" style={{ width: "min(110px, 12vh)" }} className="h-auto mix-blend-multiply" />
            <div className="mt-1 whitespace-nowrap text-[22px] font-normal tracking-[0.3em] text-[#101010] lg:text-[24px]">
              MILLION <span className="text-[#C39A39]">OS</span>
            </div>
          </div>
          {sent ? (
            <div className="mt-9 text-left">
              <h2 className="text-[28px] font-bold leading-tight text-[#171717] lg:text-[30px]">Confirme seu e-mail</h2>
              <p className="mt-2 text-[15px] text-[#777771]">Seu cadastro foi realizado. Enviamos um link de confirmação para {email}. Seu acesso será liberado depois da aprovação.</p>
              <p className="mt-6 text-center text-[14px]"><Link to="/login" className="font-medium text-[#C39A39] hover:underline">Voltar para o login</Link></p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <h2 className="mt-8 text-[28px] font-bold leading-tight text-[#171717] lg:mt-[min(32px,3.5vh)] lg:text-[30px]">Criar conta</h2>
              <p className="mt-1 text-[15px] text-[#777771]">Seu acesso será liberado depois da aprovação.</p>
              <div className="mt-6">
                <label htmlFor="name" className={labelCls}>Nome completo</label>
                <input id="name" autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); clear(); }} required className={inputCls} />
              </div>
              <div className="mt-4">
                <label htmlFor="email" className={labelCls}>E-mail</label>
                <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); clear(); }} required className={inputCls} />
              </div>
              <div className="mt-4">
                <label htmlFor="password" className={labelCls}>Senha</label>
                <div className="relative">
                  <input id="password" type={show ? "text" : "password"} autoComplete="new-password" minLength={6} value={password} onChange={(e) => { setPassword(e.target.value); clear(); }} required className={inputCls + " pr-12"} />
                  <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Ocultar senha" : "Mostrar senha"} className={eyeCls}>
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <label htmlFor="confirm" className={labelCls}>Confirmar senha</label>
                <div className="relative">
                  <input id="confirm" type={showC ? "text" : "password"} autoComplete="new-password" minLength={6} value={confirm} onChange={(e) => { setConfirm(e.target.value); clear(); }} required className={inputCls + " pr-12"} />
                  <button type="button" onClick={() => setShowC((v) => !v)} aria-label={showC ? "Ocultar senha" : "Mostrar senha"} className={eyeCls}>
                    {showC ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <p role="alert" className="min-h-[22px] pt-2 text-sm text-[#C0504D]">{err ?? ""}</p>
              <button
                type="submit"
                disabled={busy}
                className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-[linear-gradient(90deg,#B78A25_0%,#C99D39_45%,#E0B954_75%,#BF9028_100%)] text-[15px] font-semibold text-white shadow-[0_10px_30px_rgba(190,145,40,0.22),0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-200 ease-out hover:-translate-y-px hover:brightness-[1.06] hover:shadow-[0_14px_34px_rgba(190,145,40,0.3),0_2px_8px_rgba(0,0,0,0.08)] active:translate-y-0 active:brightness-95 disabled:cursor-wait disabled:hover:translate-y-0"
              >
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando conta...</> : "Criar conta"}
              </button>
              <p className="mt-6 text-center text-[14px] text-[#777771]">
                Já tem conta? <Link to="/login" className="font-medium text-[#C39A39] hover:underline">Entrar</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
