import { useId } from "react";

import { S_AT, S_GAP, S_PATH, V_AT, V_GAP, V_PATH } from "../brandMark.js";

/** The SpactVault mark (DECISIONS ADR-027). The weave's gaps are cut in `ground`, so it sits on that color. */
export function SvMark({ className = "h-6 w-6", ground = "#ffffff" }: { className?: string; ground?: string }) {
  // the weave's clip region must have an id unique on the page; useId may include characters url() dislikes
  const clip = `sv${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <rect x="50" y="0" width="50" height="100" />
        </clipPath>
      </defs>
      <path d={S_PATH} transform={S_AT} className="fill-brand" />
      <path d={V_PATH} transform={V_AT} className="fill-ink" stroke={ground} strokeWidth={V_GAP} strokeLinejoin="round" paintOrder="stroke" />
      <g clipPath={`url(#${clip})`}>
        <path d={S_PATH} transform={S_AT} className="fill-brand" stroke={ground} strokeWidth={S_GAP} strokeLinejoin="round" paintOrder="stroke" />
      </g>
    </svg>
  );
}

/** The mark on its white tile, as in the favicon and app icon. */
export function MarkTile() {
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-white">
      <SvMark />
    </span>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <MarkTile />
      <span className="font-display text-lg font-bold tracking-tight text-ink">
        Spact<span className="text-brand">Vault</span>
      </span>
    </span>
  );
}

export type Signal = "paid" | "waits" | "blocked";

const SIGNAL_DOT: Record<Signal, string> = { paid: "bg-paid", waits: "bg-waits", blocked: "bg-blocked" };

/** The colored dot for one of the three outcomes. */
export function SignalDot({ signal, className = "" }: { signal: Signal; className?: string }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${SIGNAL_DOT[signal]} ${className}`} aria-hidden="true" />;
}
