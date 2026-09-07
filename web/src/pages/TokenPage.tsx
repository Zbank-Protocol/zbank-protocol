import { PageHead } from "../components/app/PageHead";
import { Rise } from "../components/Rise";
import { TwoForces } from "../components/TwoForces";
import { TreasuryBackingCalculator } from "../components/TreasuryBackingCalculator";
import { RedeemPanel } from "../components/RedeemPanel";
import { Equation } from "../components/Equation";
import { MODEL_DISCLAIMER, TOKENOMICS, TOKEN_FACTS } from "../data/site";

/**
 * /token — ZBNK economics as an investor-relations page: the two forces, the interactive
 * backing model, the proposed redemption mechanism, and the live-vs-proposed register.
 */
export default function TokenPage() {
  return (
    <main className="page">
      <div className="container">
        <PageHead
          kicker="$ZBNK"
          title="Two forces. One token."
          lede={TOKENOMICS.lede}
        />

        <Rise>
          <TwoForces />
        </Rise>

        <Rise delay={0.06}>
          <div className="why">
            <div className="why__copy">
              <h3 className="why__q">The motif</h3>
              <p>{TOKENOMICS.detail}</p>
            </div>
            <Equation />
          </div>
        </Rise>

        <Rise delay={0.08}>
          <TreasuryBackingCalculator />
        </Rise>

        <div className="token-duo">
          <Rise delay={0.1}>
            <RedeemPanel />
          </Rise>
          <Rise delay={0.14}>
            <div className="facts">
              <h3 className="facts__title">ZBNK, precisely.</h3>
              <p className="facts__copy">{TOKENOMICS.detail}</p>
              <span className="metric__label">Live vs. proposed</span>
              <ul className="facts__list">
                {TOKEN_FACTS.map((f) => (
                  <li className="facts__item" key={f.label}>
                    <span>{f.label}</span>
                    <span className={`chip ${f.status === "Live" ? "chip--gold" : "chip--proposed"}`}>
                      {f.status}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="t-note">{MODEL_DISCLAIMER}</p>
            </div>
          </Rise>
        </div>
      </div>
    </main>
  );
}
