import { HERO_ACCOUNT, HERO_FLOW } from "../data/site";

/**
 * The hero visual: real protocol facts beside the ZEC → markets transaction flow.
 * Every row is a verifiable statement about the deployed system — no invented balances.
 */
export function HeroPanel() {
  return (
    <div className="hero-panel">
      {/* ---- Left: the account. ---- */}
      <div className="hero-panel__account">
        <div className="hero-panel__head">
          <span className="hero-panel__title">{HERO_ACCOUNT.title}</span>
          <span className="t-demo">{HERO_ACCOUNT.badge}</span>
        </div>
        <dl className="hero-panel__rows">
          {HERO_ACCOUNT.rows.map((row) => (
            <div className="hero-panel__row" key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ---- Right: the flow. ---- */}
      <div
        className="hero-panel__flow"
        role="img"
        aria-label="ZEC flows through ZBANK to Robinhood Chain and into stocks, indexes and credit"
      >
        {HERO_FLOW.map((node, i) => (
          <div className="hero-panel__flow-item" key={node}>
            {i > 0 ? (
              <span className="hero-panel__flow-arrow" aria-hidden="true">
                ↓
              </span>
            ) : null}
            <span className="hero-panel__flow-node" data-hub={node === "ZBANK"}>
              {node}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
