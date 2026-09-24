import { createElement, useEffect } from "react";
import { PlayCircle } from "lucide-react";

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
  useEffect(() => {
    load("https://fast.wistia.com/player.js");
    load(`https://fast.wistia.com/embed/${MEDIA}.js`, true);
  }, []);

  return (
    <section className="mb-6 rounded-lg border bg-card px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">
          <PlayCircle className="h-3.5 w-3.5" />
          Videoaula
        </span>
        <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-[28px]">Aprenda a importar seu garimpo</h2>
        <span className="mt-3 h-[2px] w-10 rounded-full bg-gold" />
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Assista à aula rápida e veja, na prática, como preparar, importar e validar seus leads no WIX MILLION OS.
        </p>
      </div>
      <style>{`wistia-player[media-id='${MEDIA}']:not(:defined){background:center / contain no-repeat url('https://fast.wistia.com/embed/medias/${MEDIA}/swatch');display:block;filter:blur(5px);padding-top:56.25%;}`}</style>
      <div className="mx-auto mt-7 w-full max-w-[960px] overflow-hidden rounded-md border shadow-sm">
        {createElement("wistia-player", { "media-id": MEDIA, aspect: "1.7777777777777777", style: { display: "block", width: "100%" } })}
      </div>
    </section>
  );
}
