import { ZCREDIT_RISK } from "../../config/protocol";
import type { ZCreditMarket } from "../../hooks/useZCreditMarket";

const GOLD = "#f4b728";
const LINE = "rgb(255 255 255 / 0.14)";
const DIM = "rgb(255 255 255 / 0.45)";
const mono = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.08em",
} as const;

/** Borrow rate (fraction/yr) at a given utilization, from the deployed kinked model. */
function borrowRateAt(u: number): number {
  const { baseBps, slope1Bps, kinkBps, slope2Bps } = ZCREDIT_RISK.interestModel;
  const kink = kinkBps / 10_000;
  const base = baseBps / 10_000;
  if (u <= kink) return base + (slope1Bps / 10_000) * (u / kink);
  return base + slope1Bps / 10_000 + (slope2Bps / 10_000) * ((u - kink) / (1 - kink));
}

/**
 * The interest-rate model, drawn — so an empty pool reads as "the curve you are early on",
 * not as a dead product. A marker sits at live utilization; the kink is labelled.
 */
export function RateCurve({ market }: { market: ZCreditMarket }) {
  const W = 520;
  const H = 190;
  const padL = 44;
  const padR = 16;
  const padT = 18;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxRate = borrowRateAt(1) * 1.08;
  const x = (u: number) => padL + u * plotW;
  const y = (r: number) => padT + plotH - (r / maxRate) * plotH;

  const steps = 64;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    pts.push(`${x(u).toFixed(1)},${y(borrowRateAt(u)).toFixed(1)}`);
  }

  const kink = ZCREDIT_RISK.interestModel.kinkBps / 10_000;
  const liveU = market.utilization;
  const liveRate = liveU == null ? null : borrowRateAt(liveU);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="ratecurve"
      role="img"
      aria-label="Borrow rate versus pool utilization"
    >
      {/* Axes. */}
      <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke={LINE} />
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke={LINE} />

      {/* Kink guide — labelled at the top so it never collides with the x-axis labels. */}
      <line x1={x(kink)} y1={padT} x2={x(kink)} y2={padT + plotH} stroke={LINE} strokeDasharray="3 4" />
      <text x={x(kink)} y={padT - 6} fill={DIM} style={mono} textAnchor="middle">
        {Math.round(kink * 100)}% KINK
      </text>

      {/* The curve. */}
      <polyline points={pts.join(" ")} fill="none" stroke={GOLD} strokeWidth={1.8} />

      {/* Y labels. */}
      <text x={padL - 8} y={y(0) + 3} fill={DIM} style={mono} textAnchor="end">
        0%
      </text>
      <text x={padL - 8} y={y(borrowRateAt(1)) + 3} fill={DIM} style={mono} textAnchor="end">
        {(borrowRateAt(1) * 100).toFixed(0)}%
      </text>
      <text x={padL} y={padT + plotH + 16} fill={DIM} style={mono} textAnchor="start">
        0%
      </text>
      <text x={padL + plotW} y={padT + plotH + 16} fill={DIM} style={mono} textAnchor="end">
        100% UTILIZATION
      </text>

      {/* Live marker. */}
      {liveU != null && liveRate != null ? (
        <g>
          <circle cx={x(liveU)} cy={y(liveRate)} r={4.5} fill={GOLD} />
          <circle cx={x(liveU)} cy={y(liveRate)} r={9} fill="none" stroke={GOLD} opacity={0.4}>
            <animate attributeName="r" values="6;12;6" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <text
            x={Math.min(x(liveU) + 12, padL + plotW - 4)}
            y={Math.max(y(liveRate) - 10, padT + 10)}
            fill={GOLD}
            style={mono}
          >
            NOW · {(liveU * 100).toFixed(1)}%
          </text>
        </g>
      ) : null}
    </svg>
  );
}
