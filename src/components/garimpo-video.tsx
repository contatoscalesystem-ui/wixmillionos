import { createElement, useEffect, useState } from "react";
import { PlayCircle, X } from "lucide-react";

const MEDIA = "85n4gmuccw";

function load(src: string, module = false) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const s = document.createElement("script");
  s.src = src;
  s.async = true;
  if (module) s.type = "module";
  document.head.appendChild(s);
}

export function GarimpoVideo() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    load("https://fast.wistia.com/player.js");
    load(`https://fast.wistia.com/embed/${MEDIA}.js`, true);
  }, [open]);

  return (
    <section className="mb-6 rounded-lg border bg-card px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">
          <PlayCircle className="h-3.5 w-3.5" />
          Videoaula
        </span>
        <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-[28px]">Aprenda a importar seu garimpo</h2>
        <span className="mt-3 h-[2px] w-10 rounded-full bg-gold" />
        <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">
          Assista à aula prática e entenda como preparar, importar e validar seus leads no WIX MILLION OS.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Se for sua primeira vez no módulo de garimpos, clique no botão abaixo para assistir à aula e entender o processo completo de importação.
        </p>
        <div className="mt-6">
          {open ? (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-11 items-center gap-2 rounded-md border bg-card px-5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <X className="h-4 w-4" /> Fechar aula
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-gold px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              <PlayCircle className="h-4 w-4" /> Assistir à aula
            </button>
          )}
        </div>
      </div>

      <div
        className="grid transition-[grid-template-rows,opacity] duration-500 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
      >
        <div className="overflow-hidden">
          {open && (
            <>
              <style>{`wistia-player[media-id='${MEDIA}']:not(:defined){background:center / contain no-repeat url('https://fast.wistia.com/embed/medias/${MEDIA}/swatch');display:block;filter:blur(5px);padding-top:56.25%;}`}</style>
              <div className="mx-auto mt-7 w-full max-w-[960px] overflow-hidden rounded-md border shadow-sm">
                {createElement("wistia-player", { "media-id": MEDIA, aspect: "1.7777777777777777", style: { display: "block", width: "100%" } })}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
