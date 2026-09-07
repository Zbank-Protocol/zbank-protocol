import type { ZCreditMarket } from "../../hooks/useZCreditMarket";
import { fmtRate } from "../../lib/economics";

/**
 * Supply-rate honesty: base APY earned from borrower interest, shown separately from any ZBNK
 * incentives. Incentive lines render ONLY when an emission system exists — a promotional APY
 * is never folded into the lending rate.
 */
export function InterestRateBreakdown({ market }: { market: ZCreditMarket }) {
  const hasIncentives = market.incentiveApy != null;

  return (
    <div className="ratebreak">
      <div className="txpreview__row">
        <span className="txpreview__label">Base supply APY (from borrower interest)</span>
        <span className="txpreview__value">{fmtRate(market.supplyApy, 2)}</span>
      </div>
      {hasIncentives ? (
        <>
          <div className="txpreview__row">
            <span className="txpreview__label">ZBNK incentive APY</span>
            <span className="txpreview__value">{fmtRate(market.incentiveApy, 2)}</span>
          </div>
          <div className="txpreview__row" data-emphasis="true">
            <span className="txpreview__label">Total displayed APY</span>
            <span className="txpreview__value">
              {fmtRate(
                market.supplyApy != null && market.incentiveApy != null
                  ? market.supplyApy + market.incentiveApy
                  : null,
                2,
              )}
            </span>
          </div>
        </>
      ) : (
        <p className="t-note">No incentive emissions are configured. Rates shown are borrower-paid only.</p>
      )}
      <div className="txpreview__row">
        <span className="txpreview__label">Borrow APY</span>
        <span className="txpreview__value">{fmtRate(market.borrowApy, 2)}</span>
      </div>
      <div className="txpreview__row">
        <span className="txpreview__label">Utilization</span>
        <span className="txpreview__value">{fmtRate(market.utilization, 1)}</span>
      </div>
      <div className="txpreview__row">
        <span className="txpreview__label">Reserve factor</span>
        <span className="txpreview__value">{(market.reserveFactorBps / 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}
