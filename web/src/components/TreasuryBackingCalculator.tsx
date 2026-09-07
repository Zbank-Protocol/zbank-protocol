import { useState } from "react";
import { EXAMPLE_MODEL } from "../data/site";
import { deriveMetrics, fmtAmount, fmtPct, fmtRatio, fmtUsd } from "../lib/economics";

/**
 * The treasury backing calculator — the interactive proof of the whole model.
 *
 * The visitor edits four numbers (redeemable ZEC, eligible supply, and the two prices) and
 * watches the core ratio respond. Two scenario buttons — grow the treasury 25%, burn 10% of
 * supply — teach the two forces one press at a time, with the delta against the example
 * baseline printed beside the result.
 *
 * Everything is a MODEL SIMULATION over the spec's example values (168,500 ZEC / 100M ZBNK).
 * Nothing here reads live data, and nothing here is a forecast.
 */

const BASELINE = {
  treasury: EXAMPLE_MODEL.redeemableZec as number,
  supply: EXAMPLE_MODEL.eligibleSupply as number,
};

/** Parse a human-typed figure ("168,500") into a number, or null when it isn't one. */
function parse(raw: string): number | null {
  const n = Number(raw.replace(/[,$\s]/g, ""));
  return Number.isFinite(n) && n >= 0 && raw.trim() !== "" ? n : null;
}

type Field = { raw: string; label: string; hint?: string };

export function TreasuryBackingCalculator() {
  const [treasury, setTreasury] = useState(String(BASELINE.treasury));
  const [supply, setSupply] = useState(String(BASELINE.supply));
  const [zecPrice, setZecPrice] = useState("");
  const [zbnkPrice, setZbnkPrice] = useState("");

  const t = parse(treasury);
  const s = parse(supply);

  const metrics = deriveMetrics(
    { totalZec: t, redeemableZec: t, strategicZec: null, currentZecPrice: parse(zecPrice) },
    {
      totalSupply: null,
      circulatingSupply: null,
      eligibleSupply: s,
      burnedSupply: null,
      currentPrice: parse(zbnkPrice),
    },
    null,
  );

  // Delta of the core ratio against the untouched example baseline.
  const baseRatio = BASELINE.treasury / BASELINE.supply;
  const delta =
    metrics.zecPerEligibleZbnk != null ? metrics.zecPerEligibleZbnk / baseRatio - 1 : null;

  const growTreasury = () => {
    if (t != null) setTreasury(String(Math.round(t * 1.25 * 100) / 100));
  };
  const burnSupply = () => {
    if (s != null) setSupply(String(Math.round(s * 0.9)));
  };
  const reset = () => {
    setTreasury(String(BASELINE.treasury));
    setSupply(String(BASELINE.supply));
    setZecPrice("");
    setZbnkPrice("");
  };

  const fields: (Field & { value: string; set: (v: string) => void })[] = [
    { label: "Redeemable ZEC treasury", raw: treasury, value: treasury, set: setTreasury },
    { label: "Eligible ZBNK supply", raw: supply, value: supply, set: setSupply },
    { label: "ZEC price (USD)", raw: zecPrice, value: zecPrice, set: setZecPrice, hint: "Optional" },
    { label: "ZBNK price (USD)", raw: zbnkPrice, value: zbnkPrice, set: setZbnkPrice, hint: "Optional" },
  ];

  return (
    <div className="calc">
      <div className="calc__head">
        <span className="calc__title">Treasury backing calculator</span>
        <span className="chip chip--proposed">Model simulation</span>
      </div>

      <div className="calc__body">
        <div className="calc__inputs">
          {fields.map((f) => (
            <label className="calc__field" key={f.label}>
              <span className="metric__label">
                {f.label}
                {f.hint ? <span className="calc__hint"> · {f.hint}</span> : null}
              </span>
              <input
                className="calc__input"
                inputMode="decimal"
                value={f.value}
                placeholder="—"
                onChange={(e) => f.set(e.target.value)}
              />
            </label>
          ))}

          <div className="calc__actions">
            <button className="btn btn--line" type="button" onClick={growTreasury}>
              +25% Treasury
            </button>
            <button className="btn btn--line" type="button" onClick={burnSupply}>
              −10% ZBNK Supply
            </button>
            <button className="btn btn--ghost" type="button" onClick={reset}>
              Reset
            </button>
          </div>
        </div>

        <div className="calc__outputs">
          <div className="calc__out calc__out--main">
            <span className="metric__label">ZEC per eligible ZBNK</span>
            <span className="calc__out-value calc__out-value--gold">
              {fmtRatio(metrics.zecPerEligibleZbnk)}
            </span>
            {delta != null && Math.abs(delta) > 0.0005 ? (
              <span className="calc__delta" data-up={delta > 0}>
                {fmtPct(delta)} vs. example baseline
              </span>
            ) : null}
          </div>
          <div className="calc__out">
            <span className="metric__label">Treasury asset value per ZBNK</span>
            <span className="calc__out-value">{fmtUsd(metrics.treasuryAssetValuePerZbnk)}</span>
          </div>
          <div className="calc__out">
            <span className="metric__label">ZBNK market price</span>
            <span className="calc__out-value">{fmtUsd(parse(zbnkPrice))}</span>
          </div>
          <div className="calc__out calc__out--premium">
            <span className="metric__label">Premium / discount to treasury asset value</span>
            <span className="calc__out-value">{fmtPct(metrics.premiumDiscount)}</span>
          </div>
        </div>
      </div>

      {/* The worked example from the model spec, as a fixed three-stage rail. */}
      <div className="calc__rail" aria-label="Worked example: burn, then treasury growth">
        <div className="calc__stage">
          <span className="metric__label">Current</span>
          <span className="calc__stage-line">{fmtAmount(BASELINE.treasury)} ZEC</span>
          <span className="calc__stage-line">{fmtAmount(BASELINE.supply)} ZBNK</span>
          <span className="calc__stage-ratio">{fmtRatio(baseRatio)}</span>
        </div>
        <span className="calc__arrow" aria-hidden="true">
          →
        </span>
        <div className="calc__stage">
          <span className="metric__label">{fmtAmount(EXAMPLE_MODEL.scenario.burned)} ZBNK burned</span>
          <span className="calc__stage-line">{fmtAmount(BASELINE.treasury)} ZEC</span>
          <span className="calc__stage-line">
            {fmtAmount(BASELINE.supply - EXAMPLE_MODEL.scenario.burned)} ZBNK
          </span>
          <span className="calc__stage-ratio">
            {fmtRatio(BASELINE.treasury / (BASELINE.supply - EXAMPLE_MODEL.scenario.burned))}
            <span className="calc__stage-delta">
              {fmtPct(
                (BASELINE.treasury / (BASELINE.supply - EXAMPLE_MODEL.scenario.burned)) /
                  baseRatio -
                  1,
              )}
            </span>
          </span>
        </div>
        <span className="calc__arrow" aria-hidden="true">
          →
        </span>
        <div className="calc__stage">
          <span className="metric__label">
            Treasury grows to {fmtAmount(EXAMPLE_MODEL.scenario.grownTreasuryZec)} ZEC
          </span>
          <span className="calc__stage-line">
            {fmtAmount(EXAMPLE_MODEL.scenario.grownTreasuryZec)} ZEC
          </span>
          <span className="calc__stage-line">
            {fmtAmount(BASELINE.supply - EXAMPLE_MODEL.scenario.burned)} ZBNK
          </span>
          <span className="calc__stage-ratio">
            {fmtRatio(
              EXAMPLE_MODEL.scenario.grownTreasuryZec /
                (BASELINE.supply - EXAMPLE_MODEL.scenario.burned),
            )}
          </span>
        </div>
      </div>

      <p className="t-demo">
        Example values only — not live protocol data, not a forecast. Backing math uses
        redeemable ZEC and eligible supply exclusively.
      </p>
    </div>
  );
}
