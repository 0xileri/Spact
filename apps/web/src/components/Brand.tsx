/** The gate: two posts, and a payment passing between them in the "paid" signal color. */
export function GateMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-ink" />
      <rect x="7.5" y="8" width="3.5" height="16" rx="1.75" className="fill-paper" />
      <rect x="21" y="8" width="3.5" height="16" rx="1.75" className="fill-paper" />
      <circle cx="16" cy="16" r="3.25" className="fill-paid" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <GateMark />
      <span className="font-display text-lg font-bold tracking-[0.14em] text-ink">SPACT</span>
    </span>
  );
}

export type Signal = "paid" | "waits" | "blocked";

const SIGNAL_DOT: Record<Signal, string> = { paid: "bg-paid", waits: "bg-waits", blocked: "bg-blocked" };

/** The colored dot for one of the three outcomes. */
export function SignalDot({ signal, className = "" }: { signal: Signal; className?: string }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${SIGNAL_DOT[signal]} ${className}`} aria-hidden="true" />;
}
