import { useEffect, useState } from "react";
import symbol from "@/assets/million-symbol.png.asset.json";
import { initPWA, useUpdateAvailable } from "@/lib/pwa";

export function PwaShell() {
  const { available, update } = useUpdateAvailable();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    initPWA();
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);

  return (
    <>
      {available && (
        <div className="fixed inset-x-3 z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-[color:var(--wm-gold,#B9943B)]/40 bg-[#111111] px-4 py-3 text-sm text-[#F7F7F4] shadow-lg" style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
          <span>Nova versão disponível.</span>
          <button onClick={update} className="rounded-md bg-[#B9943B] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#111111]">Atualizar agora</button>
        </div>
      )}
      {offline && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0D0D0D] px-6 text-center text-[#F7F7F4]">
          <div className="max-w-sm">
            <img src={symbol.url} alt="WIX MILLION OS" className="mx-auto mb-6 w-20" />
            <div className="mx-auto mb-5 h-px w-10 bg-[#B9943B]" />
            <h1 className="text-2xl font-bold">Você está sem conexão.</h1>
            <p className="mt-3 text-sm text-[#F7F7F4]/70">Conecte-se à internet para continuar usando o WIX MILLION OS.</p>
            <button onClick={() => (navigator.onLine ? setOffline(false) : location.reload())} className="mt-7 rounded-lg bg-[#B9943B] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#111111]">Tentar novamente</button>
          </div>
        </div>
      )}
    </>
  );
}
