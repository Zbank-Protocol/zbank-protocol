import { HEALTH_BANDS, healthBand } from "../../config/protocol";

/**
 * The liquidation-risk meter. Four bands, always all visible — risk states are the primary
 * display, never a tooltip. A null health factor (no position / market not live) shows the
 * scale with no needle rather than pretending safety.
 */
export function HealthFactor({ value }: { value: number | null }) {
  const band = healthBand(value);

  return (
    <div className="health">
      <div className="health__row">
        <span className="metric__label">Health factor</span>
        <span className="health__value" data-band={band ?? "none"}>
          {value == null ? "—" : value.toFixed(2)}
          {band ? <span className="health__band">{band}</span> : null}
        </span>
      </div>
      <div className="health__meter" role="img" aria-label={`Health factor ${value ?? "unknown"}`}>
        {HEALTH_BANDS.map((b) => (
          <span
            className="health__seg"
            data-band={b.label}
            data-active={band === b.label}
            key={b.label}
          >
            {b.label}
          </span>
        ))}
      </div>
      <p className="t-note">
        Positions at or below a health factor of 1.00 can be liquidated. ZEC price declines
        increase liquidation risk.
      </p>
    </div>
  );
}
