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
    <section className="mb-6 rounded-lg border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold">
          <PlayCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Aprenda a importar seu garimpo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Assista à aula rápida e veja, na prática, como preparar, importar e validar seus leads no WIX MILLION OS.
          </p>
        </div>
      </div>
      <style>{`wistia-player[media-id='${MEDIA}']:not(:defined){background:center / contain no-repeat url('https://fast.wistia.com/embed/medias/${MEDIA}/swatch');display:block;filter:blur(5px);padding-top:56.25%;}`}</style>
      <div className="mt-4 w-full max-w-[960px] overflow-hidden rounded-md border">
        {createElement("wistia-player", { "media-id": MEDIA, aspect: "1.7777777777777777", style: { display: "block", width: "100%" } })}
      </div>
    </section>
  );
}
