import type { Signal } from "./Brand.js";
import { useOnScreen } from "./Motion.js";
import "./outcomeMotion.css";

const LABEL: Record<Signal, (amount: string) => string> = {
  paid: (a) => `Animation: a request for ${a} passes the gate and is paid.`,
  waits: (a) => `Animation: a request for ${a} stops at the gate until the owner approves it, then it is paid.`,
  blocked: (a) => `Animation: a request for ${a} meets a closed gate and is sent back.`,
};

/**
 * One outcome acted out on a short track: a request moves left to right through the gate. Each card
 * loops on its own clock (the three lengths differ, so the cards never move in step), pauses off
 * screen, and is a still frame with reduced motion.
 */
export function OutcomeMotion({ signal, amount }: { signal: Signal; amount: string }) {
  const [ref, playing] = useOnScreen<SVGSVGElement>();
  return (
    <svg
      ref={ref}
      viewBox="0 0 280 88"
      className={`mini mini-${signal} block h-auto w-full font-sans`}
      data-playing={playing}
      data-testid={`motion-${signal}`}
      role="img"
      aria-label={LABEL[signal](amount)}
    >
      <line x1={16} y1={44} x2={264} y2={44} className="mini-track stroke-line" strokeWidth={2} />
      <rect x={146} y={6} width={8} height={20} rx={4} className="mini-post" />
      <rect x={146} y={62} width={8} height={20} rx={4} className="mini-post" />

      {signal === "blocked" ? (
        <>
          <line x1={150} y1={28} x2={150} y2={60} className="mini-bar stroke-blocked" strokeWidth={4} strokeLinecap="round" />
          <text fontSize={11} x={176} y={48} className="mini-refused fill-blocked font-semibold">
            Refused
          </text>
        </>
      ) : (
        <g className="mini-check">
          <circle cx={248} cy={44} r={12} className="fill-paid" />
          <path d="M242.5 44 l4 4 l7 -8" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}

      {signal === "waits" ? (
        <g className="mini-ask">
          <rect x={176} y={62} width={68} height={20} rx={10} className="mini-pill" />
          <text fontSize={10} x={210} y={75.5} textAnchor="middle" className="mini-pill-label fill-paper font-semibold">
            Approve
          </text>
          <text fontSize={10} x={210} y={75.5} textAnchor="middle" className="mini-pill-done fill-paper font-semibold">
            Approved
          </text>
        </g>
      ) : null}

      <g className="mini-chip">
        <rect x={16} y={32} width={80} height={24} rx={12} className="fill-surface stroke-line" strokeWidth={1.5} />
        <circle cx={29} cy={44} r={3.5} className="mini-dot" />
        <text fontSize={11} x={62} y={48} textAnchor="middle" className="fill-ink font-mono">
          {amount}
        </text>
      </g>
    </svg>
  );
}
