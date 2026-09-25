import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Info, TriangleAlert, CircleCheck, RefreshCw, Sparkles, Wrench, Phone, MessageCircle, Shield, Wallet,
  Monitor, AlertOctagon, CircleX, Bell, FileText, ChevronRight, X, type LucideIcon,
} from "lucide-react";
import symbol from "@/assets/million-symbol.png.asset.json";

type Tone = "blue" | "amber" | "green" | "purple" | "gold" | "red" | "gray";
export const NOTICE_TYPES: Record<string, { label: string; icon: LucideIcon; tone: Tone }> = {
  information: { label: "Informação", icon: Info, tone: "blue" },
  warning: { label: "Atenção", icon: TriangleAlert, tone: "amber" },
  important: { label: "Importante", icon: AlertOctagon, tone: "red" },
  success: { label: "Sucesso", icon: CircleCheck, tone: "green" },
  update: { label: "Atualização", icon: RefreshCw, tone: "purple" },
  news: { label: "Novidade", icon: Sparkles, tone: "gold" },
  welcome: { label: "Boas-vindas", icon: Sparkles, tone: "gold" },
  maintenance: { label: "Manutenção", icon: Wrench, tone: "gray" },
  call: { label: "Ligação", icon: Phone, tone: "gold" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, tone: "green" },
  security: { label: "Segurança", icon: Shield, tone: "blue" },
  financial: { label: "Financeiro", icon: Wallet, tone: "gold" },
  system: { label: "Sistema", icon: Monitor, tone: "gray" },
  error: { label: "Erro", icon: CircleX, tone: "red" },
};
const FALLBACK = { label: "Comunicado", icon: Bell, tone: "gold" as Tone };

export type NoticeData = { title: string; message: string; type: string; extra_title?: string | null; extra_message?: string | null };

export function NoticeModal({ notice, onAck, actionLabel = "Entendi" }: { notice: NoticeData | null; onAck: () => void; actionLabel?: string }) {
  const t = (notice && NOTICE_TYPES[notice.type]) || FALLBACK;
  const Icon = t.icon;
  const hasExtra = !!(notice?.extra_title?.trim() || notice?.extra_message?.trim());
  return (
    <DialogPrimitive.Root open={!!notice} onOpenChange={(o) => { if (!o) onAck(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="nm-overlay fixed inset-0 z-50" />
        <DialogPrimitive.Content className="nm-card fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[640px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl focus:outline-none">
          {notice && (
            <>
              <div className="nm-topbar h-1 w-full shrink-0" />
              <DialogPrimitive.Close aria-label="Fechar" className="absolute right-3 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full text-[#1A1A1A] transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C69A32]">
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
              <div className="overflow-y-auto px-5 pb-6 pt-7 sm:px-10 sm:pb-8 sm:pt-8">
                <div className="flex items-center justify-center gap-2.5 sm:gap-3">
                  <img src={symbol.url} alt="" className="h-10 w-auto object-contain sm:h-14" />
                  <div className="text-left leading-none">
                    <div className="text-[19px] font-extrabold tracking-tight text-[#0D0D0D] sm:text-[26px]">WIX MILLION <span className="text-[#C69A32]">OS</span></div>
                    <div className="mt-1 text-[7.5px] font-semibold uppercase tracking-[0.28em] text-[#666666] sm:text-[9px]">Central de operação comercial</div>
                  </div>
                </div>

                <div className={`nm-icon nm-${t.tone} mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-full sm:mt-6 sm:h-16 sm:w-16`}>
                  <Icon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.8} />
                </div>
                <div className="mt-3 flex items-center justify-center gap-3">
                  <span className="h-px w-8 bg-[#C69A32]/70 sm:w-10" />
                  <span className={`nm-label nm-${t.tone} text-[10.5px] font-bold uppercase tracking-[0.24em] sm:text-[11px]`}>{t.label}</span>
                  <span className="h-px w-8 bg-[#C69A32]/70 sm:w-10" />
                </div>

                <DialogPrimitive.Title className="mx-auto mt-3 max-w-[520px] text-balance text-center text-[23px] font-extrabold leading-tight text-[#0D0D0D] sm:text-[30px]">
                  {notice.title}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mx-auto mt-3 max-w-[520px] whitespace-pre-line break-words text-center text-[15px] leading-relaxed text-[#444444] sm:text-[16px]">
                  {notice.message}
                </DialogPrimitive.Description>

                {hasExtra && (
                  <div className="mt-5 flex gap-3 rounded-xl border border-[#C69A32]/25 bg-[#FBF6EA] p-4 text-left">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#C69A32]/10 text-[#9A7722]"><FileText className="h-5 w-5" /></div>
                    <div className="min-w-0">
                      {notice.extra_title?.trim() && <div className="text-[14.5px] font-bold text-[#9A7722]">{notice.extra_title}</div>}
                      {notice.extra_message?.trim() && <p className="mt-0.5 whitespace-pre-line break-words text-[14px] leading-relaxed text-[#555555]">{notice.extra_message}</p>}
                    </div>
                  </div>
                )}

                <button type="button" onClick={onAck} className="nm-btn mt-6 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl text-[16px] font-bold text-white sm:h-[52px] sm:text-[17px]">
                  {actionLabel} <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
