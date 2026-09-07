import { useState } from "react";
import { ZCREDIT } from "../data/site";

/**
 * The ZCREDIT concept calculator.
 *
 * The LTV slider is real UI; every dollar figure is "—" because no oracle exists yet, and the
 * panel is labelled Concept UI so the state cannot be mistaken for a quote. When pricing goes
 * live, the "—" values come from data/site.ts like everything else.
 */
export function CreditCalculator() {
  const [ltv, setLtv] = useState<number>(ZCREDIT.mock.targetLtv);

  return (
    <div className="credit" aria-label="ZCREDIT loan calculator — concept UI">
      <div className="credit__head">
        <span className="metric__label">Loan calculator</span>
        <span className="t-demo">Concept UI</span>
      </div>

      <div className="credit__grid">
        <div className="metric">
          <span className="metric__label">Collateral</span>
          <span className="metric__value metric__value--sm">{ZCREDIT.mock.collateral}</span>
        </div>
        <div className="metric">
          <span className="metric__label">Collateral value</span>
          <span className="metric__value metric__value--sm">{ZCREDIT.mock.collateralValue}</span>
        </div>
        <div className="metric">
          <span className="metric__label">Borrow</span>
          <span className="metric__value metric__value--sm">{ZCREDIT.mock.borrow}</span>
        </div>
        <div className="metric">
          <span className="metric__label">Health</span>
          <span className="metric__value metric__value--sm">{ZCREDIT.mock.health}</span>
        </div>
      </div>

      <div className="credit__ltv">
        <label className="metric__label" htmlFor="ltv">
          Target LTV
        </label>
        <div className="credit__slider">
          <input
            id="ltv"
            type="range"
            min={5}
            max={50}
            step={1}
            value={ltv}
            onChange={(e) => setLtv(Number(e.target.value))}
          />
          <span className="credit__ltv-value">{ltv}%</span>
        </div>
      </div>

      <p className="t-note">
        Borrowing figures populate when collateral pricing is live. Nothing here is an offer of
        credit.
      </p>
    </div>
  );
}
