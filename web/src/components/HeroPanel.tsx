import { HERO_ACCOUNT } from "../data/site";

/**
 * The hero visual: the protocol as a live system console.
 *
 * Top rail: a breathing status dot and the onchain chip. Center: the routing circuit —
 * ZEC into the ZBANK hub, fanning out to stocks, indexes, and credit — drawn in the same
 * grammar as the glyph set (thin strokes, gold nodes) with current flowing along the lines.
 * Foot: four verifiable facts about the deployed system. No invented balances anywhere.
 */

const GOLD = "#e7b348";
const LINE = "#2a2b33";
const INK = "#c9cad3";
const DIM = "#6f7078";
const mono = { fontFamily: "var(--font-mono)", letterSpacing: "0.08em" } as const;

function Node({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={2.4} fill={GOLD} />;
}

function Terminal({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <rect x={x} y={y} width={62} height={30} fill="#0b0b0f" stroke={LINE} />
      <text x={x + 31} y={y + 19} textAnchor="middle" fontSize="8.5" fill={INK} style={mono}>
        {label}
      </text>
    </g>
  );
}

function Circuit() {
  return (
    <svg className="syspanel__fig" viewBox="0 0 340 236" aria-label="ZEC routes through ZBANK on Robinhood Chain into stocks, indexes and credit">
      {/* Input. */}
      <rect x={14} y={103} width={58} height={30} fill="#0b0b0f" stroke={LINE} />
      <text x={43} y={122} textAnchor="middle" fontSize="9" fill={INK} style={mono}>
        ZEC
      </text>

      {/* Input → hub. */}
      <path className="flowline" d="M72 118 H136" stroke={LINE} fill="none" />
      <Node x={72} y={118} />

      {/* The hub. */}
      <rect x={138} y={92} width={78} height={52} fill="rgba(231,179,72,0.07)" stroke={GOLD} strokeOpacity={0.75} />
      <text x={177} y={114} textAnchor="middle" fontSize="10" fill={GOLD} style={mono}>
        ZBANK
      </text>
      <text x={177} y={129} textAnchor="middle" fontSize="6.5" fill={DIM} style={mono}>
        ROBINHOOD CHAIN
      </text>

      {/* Hub → terminals. */}
      <path className="flowline" d="M216 118 H240 L262 48 H268" stroke={LINE} fill="none" />
      <path className="flowline" d="M216 118 H268" stroke={LINE} fill="none" />
      <path className="flowline" d="M216 118 H240 L262 188 H268" stroke={LINE} fill="none" />
      <Node x={216} y={118} />
      <Node x={268} y={48} />
      <Node x={268} y={118} />
      <Node x={268} y={188} />

      <Terminal x={270} y={33} label="STOCKS" />
      <Terminal x={270} y={103} label="INDEXES" />
      <Terminal x={270} y={173} label="CREDIT" />

      {/* The return: revenue back to the treasury, drawn quiet. */}
      <path className="flowline flowline--slow" d="M177 144 V210 H43 V133" stroke={LINE} fill="none" />
      <Node x={43} y={133} />
      <text x={110} y={222} textAnchor="middle" fontSize="6.5" fill={DIM} style={mono}>
        REVENUE → ZEC TREASURY
      </text>
    </svg>
  );
}

export function HeroPanel() {
  return (
    <div className="syspanel">
      <div className="syspanel__head">
        <span className="syspanel__title">
          <span className="syspanel__live" aria-hidden="true" />
          {HERO_ACCOUNT.title}
        </span>
        <span className="syspanel__chip">{HERO_ACCOUNT.badge} · Chain 4663</span>
      </div>

      <Circuit />

      <dl className="syspanel__grid">
        {HERO_ACCOUNT.rows.map((row) => (
          <div className="syspanel__cell" key={row.label}>
            <dt>{row.label}</dt>
            <dd data-live={row.value === "Live" || undefined}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
