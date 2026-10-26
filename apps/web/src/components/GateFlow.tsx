import { Robot } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import type { GateExample } from "../landing.js";
import "./gateFlow.css";

const NARROW = "(max-width: 639px)";

/** True on a phone-sized screen, where the graphic drops its legend so the rest stays readable. */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(NARROW).matches);
  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const update = () => setNarrow(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return narrow;
}

/** A payment request on its way down the track. Its center starts just under the agent. */
function Chip({ name, amount }: { name: "a" | "b" | "c"; amount: string }) {
  return (
    <g className={`gate-chip gate-chip-${name}`}>
      <rect x={192} y={80} width={96} height={32} rx={16} className="fill-surface stroke-line" strokeWidth={1.5} />
      <circle cx={210} cy={96} r={4} className={`gate-chip-dot gate-chip-dot-${name}`} />
      <text fontSize={12} x={248} y={100} textAnchor="middle" className="fill-ink font-mono">
        {amount}
      </text>
    </g>
  );
}

const DOT = { paid: "fill-paid", waits: "fill-waits", blocked: "fill-blocked" } as const;

function RuleRow({ y, signal, text }: { y: number; signal: keyof typeof DOT; text: string }) {
  return (
    <g className={`gate-row gate-row-${signal}`}>
      <circle cx={30} cy={y - 4} r={4} className={DOT[signal]} />
      <text fontSize={11} x={42} y={y} className="fill-ink font-mono">
        {text}
      </text>
    </g>
  );
}

/**
 * The hero graphic: three requests go through the vault's gate in a loop. One is paid, one waits for
 * the owner's wallet and is approved, one is blocked. CSS animations only; paused while off screen,
 * and a still frame with reduced motion.
 */
export function GateFlow({ example, source }: { example: GateExample; source: string }) {
  const ref = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(false);
  const compact = useNarrow();

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => setPlaying(entries.some((e) => e.isIntersecting)), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const captions = [
    `${example.paid} is within the ${example.auto} auto limit. Paid at once.`,
    `${example.waits} is over ${example.auto}, so it waits. Your wallet approves the exact terms.`,
    `${example.blocked} is over the ${example.cap} cap. Blocked on chain, nothing moves.`,
  ];

  return (
    <figure
      ref={ref}
      className="gate rounded-3xl border border-line bg-surface p-4 shadow-xl shadow-stone-900/5 sm:p-6"
      data-playing={playing}
      data-testid="gate-flow"
    >
      <svg
        viewBox={compact ? "136 0 344 480" : "0 0 480 480"}
        className="block h-auto w-full font-sans"
        role="img"
        aria-label={`Animation: a request for ${example.paid} is paid at once, ${example.waits} waits for the owner's wallet, ${example.blocked} is blocked.`}
      >
        <line x1={240} y1={80} x2={240} y2={400} className="gate-track stroke-line" strokeWidth={2} />

        {/* the agent */}
        <rect x={150} y={20} width={180} height={60} rx={16} className="fill-ink" />
        <Robot x={168} y={38} size={24} className="text-paper" aria-hidden="true" />
        <text fontSize={14} x={202} y={47} className="fill-paper font-semibold">
          Your agent
        </text>
        <text fontSize={11} x={202} y={65} className="fill-stone-400 font-mono">
          asks to pay
        </text>

        {/* the rules the gate applies; on a phone the caption says them instead */}
        {compact ? null : (
          <g>
            <text fontSize={12} x={24} y={214} className="fill-stone-500 font-medium">
              Vault rules, on chain
            </text>
            <RuleRow y={240} signal="paid" text={`≤ ${example.auto} paid`} />
            <RuleRow y={262} signal="waits" text={`≤ ${example.cap} asks you`} />
            <RuleRow y={284} signal="blocked" text={`> ${example.cap} blocked`} />
          </g>
        )}

        {/* the owner's wallet, for payments that wait */}
        <line x1={310} y1={250} x2={330} y2={250} className="gate-link stroke-waits" strokeWidth={2} strokeDasharray="3 3" />
        <g className="gate-wallet">
          <rect x={330} y={196} width={136} height={108} rx={14} className="fill-paper stroke-line" strokeWidth={1.5} />
          <text fontSize={11} x={344} y={218} className="fill-stone-500">
            Your wallet
          </text>
          <text fontSize={12} x={344} y={238} className="fill-ink font-semibold">
            Pay {example.waits}?
          </text>
          <rect x={344} y={254} width={108} height={32} rx={8} className="gate-btn" />
          <text fontSize={12} x={398} y={274} textAnchor="middle" className="gate-btn-label fill-paper font-semibold">
            Approve
          </text>
          <text fontSize={12} x={398} y={274} textAnchor="middle" className="gate-btn-done fill-paper font-semibold">
            Approved
          </text>
          <circle cx={398} cy={270} r={12} className="gate-tap fill-ink" />
        </g>

        {/* requests, drawn under the gate posts */}
        <Chip name="a" amount={example.paid} />
        <Chip name="b" amount={example.waits} />
        <Chip name="c" amount={example.blocked} />

        {/* the gate, and the bar that closes it on a blocked request */}
        <line x1={186} y1={196} x2={294} y2={196} className="gate-bar stroke-blocked" strokeWidth={4} strokeLinecap="round" />
        <text fontSize={11} x={240} y={222} textAnchor="middle" className="gate-refused fill-blocked font-semibold">
          Refused on chain
        </text>
        <rect x={170} y={200} width={14} height={100} rx={7} className="gate-post" />
        <rect x={296} y={200} width={14} height={100} rx={7} className="gate-post" />
        {[177, 303].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy={186} r={6} className="gate-ring" strokeWidth={2} fill="none" />
            <circle cx={cx} cy={186} r={6} className="gate-light" />
          </g>
        ))}

        {/* the payee */}
        <rect x={150} y={400} width={180} height={60} rx={16} className="fill-paper stroke-line" strokeWidth={1.5} />
        <text fontSize={11} x={240} y={426} textAnchor="middle" className="fill-stone-500">
          Payee on your list
        </text>
        <text fontSize={12} x={240} y={444} textAnchor="middle" className="fill-ink font-semibold">
          Receives the payment
        </text>
        <g className="gate-check">
          <circle cx={326} cy={404} r={11} className="fill-paid" />
          <path d="M321 404 l3.5 3.5 l6.5 -7" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <text fontSize={12} x={346} y={438} className="gate-toast gate-toast-a fill-paid font-mono font-semibold">
          +{example.paid}
        </text>
        <text fontSize={12} x={346} y={438} className="gate-toast gate-toast-b fill-paid font-mono font-semibold">
          +{example.waits}
        </text>
      </svg>
      <figcaption className="mt-4 border-t border-line pt-4">
        <span className="grid min-h-10 text-sm font-medium text-ink" aria-hidden="true">
          {captions.map((c, i) => (
            <span key={c} className={`gate-caption gate-caption-${"abc"[i]} [grid-area:1/1]`}>
              {c}
            </span>
          ))}
        </span>
        <span className="mt-2 block text-xs text-stone-500" data-testid="gate-source">
          {source}
        </span>
      </figcaption>
    </figure>
  );
}
