import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Horizontal scroll container with a synced scrollbar on top (plus the native one at the bottom). */
export function DualScroll({ children, className }: { children: ReactNode; className?: string }) {
  const top = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const [w, setW] = useState(0);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => { setW(el.scrollWidth); setOverflow(el.scrollWidth > el.clientWidth + 1); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);

  const sync = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    if (!from || !to) return;
    if (syncing.current) { syncing.current = false; return; }
    if (to.scrollLeft !== from.scrollLeft) { syncing.current = true; to.scrollLeft = from.scrollLeft; }
  };

  return (
    <div className={className}>
      <div ref={top} aria-hidden onScroll={() => sync(top.current, body.current)} className={cn("wm-hscroll overflow-x-auto overflow-y-hidden", !overflow && "hidden")} style={{ height: 12 }}>
        <div style={{ width: w, height: 1 }} />
      </div>
      <div ref={body} onScroll={() => sync(body.current, top.current)} className="wm-hscroll w-full overflow-x-auto">
        {children}
      </div>
    </div>
  );
}
