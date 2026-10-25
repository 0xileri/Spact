import { useEffect, useRef, useState, type ReactNode } from "react";

function reducedMotion(): boolean {
  return typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined";
}

/**
 * Fades its children up once, as they enter the viewport. IntersectionObserver only, never a scroll
 * listener. With reduced motion the content is simply there.
 */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(reducedMotion);

  useEffect(() => {
    const el = ref.current;
    if (shown || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  return (
    <div ref={ref} className={`reveal ${className}`} data-shown={shown}>
      {children}
    </div>
  );
}

/** Words light up one at a time, in reading order, as they cross a line 60% down the viewport. */
export function TaglineReveal({ lines, className = "" }: { lines: string[]; className?: string }) {
  const words = lines.map((line) => line.split(" "));
  const total = words.reduce((n, w) => n + w.length, 0);
  const ref = useRef<HTMLParagraphElement>(null);
  const [lit, setLit] = useState(() => (reducedMotion() ? total : 0));

  useEffect(() => {
    const el = ref.current;
    if (!el || lit >= total) return;
    let target = 0;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) target = Math.max(target, Number(e.target.getAttribute("data-word")) + 1);
      },
      { rootMargin: "0px 0px -40% 0px" },
    );
    el.querySelectorAll("[data-word]").forEach((w) => io.observe(w));
    // one word per tick, so a whole line never flips at once
    const timer = setInterval(() => {
      setLit((n) => (n < target ? n + 1 : n));
      if (target >= total) io.disconnect();
    }, 80);
    return () => {
      io.disconnect();
      clearInterval(timer);
    };
    // set up once per tagline; `lit` only decides whether it is needed at all
  }, [total]);

  let index = 0;
  return (
    <p ref={ref} className={className} data-testid="tagline">
      {words.map((line, l) => (
        <span key={l} className="block">
          {line.map((word, w) => {
            const i = index++;
            return (
              <span key={w}>
                <span data-word={i} className={`transition-colors duration-700 ease-fluid ${i < lit ? "text-ink" : "text-stone-300"}`}>
                  {word}
                </span>{" "}
              </span>
            );
          })}
        </span>
      ))}
    </p>
  );
}
