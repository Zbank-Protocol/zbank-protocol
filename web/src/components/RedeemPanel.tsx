import { REDEMPTION } from "../data/site";

/**
 * The redemption interface, as a concept mock.
 *
 * Everything here is deliberately inert: no wallet, no submit, no state. Until a redemption
 * contract is deployed and the legal structure is final, this panel's job is to teach the
 * mechanism — burn ZBNK, receive the proportional ZEC, supply falls — while saying plainly
 * that it is proposed, not live.
 */
export function RedeemPanel() {
  return (
    <div className="redeem">
      <div className="redeem__head">
        <span className="redeem__title">Redeem</span>
        <span className="chip chip--proposed">{REDEMPTION.badge}</span>
      </div>

      <div className="redeem__rows">
        <div className="redeem__row">
          <span className="metric__label">{REDEMPTION.burnLabel}</span>
          <span className="redeem__value">{REDEMPTION.burn}</span>
        </div>
        <div className="redeem__row">
          <span className="metric__label">{REDEMPTION.rateLabel}</span>
          <span className="redeem__value">{REDEMPTION.rate}</span>
        </div>
        <div className="redeem__row redeem__row--receive">
          <span className="metric__label">{REDEMPTION.receiveLabel}</span>
          <span className="redeem__value redeem__value--gold">{REDEMPTION.receive}</span>
        </div>
        <div className="redeem__row">
          <span className="metric__label">{REDEMPTION.burnedLabel}</span>
          <span className="redeem__value">{REDEMPTION.burned}</span>
        </div>
      </div>

      {/* The tooltip, as a disclosure — visible on every device, no hover dependency. */}
      <details className="redeem__info">
        <summary>How redemption would work</summary>
        <p>{REDEMPTION.tooltip}</p>
      </details>

      <p className="t-demo">{REDEMPTION.note}</p>
    </div>
  );
}
