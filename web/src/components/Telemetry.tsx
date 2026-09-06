import { PONS } from "../config";
import type { TreasuryState } from "../lib/chain";

/**
 * Fixed readout rail. Blocks reveal as their station is reached, so the panel reads as
 * instrumentation that comes online during the descent rather than a static sidebar.
 */
export function Telemetry({ stage, state }: { stage: number; state: TreasuryState }) {
  const blocks = [
    {
      from: 1,
      label: "Trading fee",
      value: `${(PONS.protocolFeeBps / 100).toFixed(2)}%`,
    },
    {
      from: 2,
      label: "Creator share",
      value: `${PONS.creatorShareBps / 100}%`,
    },
    {
      from: 3,
      label: "ZEC in reserve",
      value: state.reserveZec === null ? "—" : state.reserveZec.toFixed(3),
    },
    {
      from: 5,
      label: "Registered",
      value: state.registered === null ? "—" : String(state.registered),
    },
  ];

  return (
    <aside
      className="telemetry"
      style={{ "--enter": stage > 0 ? 1 : 0 } as React.CSSProperties}
      aria-hidden="true"
    >
      {blocks.map((block) => (
        <div className="telemetry__block" key={block.label} data-hidden={stage < block.from}>
          <span className="ro__label">{block.label}</span>
          <span className="ro__value t-mono">{block.value}</span>
        </div>
      ))}
    </aside>
  );
}
