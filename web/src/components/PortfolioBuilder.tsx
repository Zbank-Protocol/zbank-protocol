import { useState } from "react";
import { PORTFOLIO_TEMPLATES, ZINVEST } from "../data/site";

/**
 * The ZINVEST portfolio builder, as a working mock.
 *
 * Template selection and the allocation readout are real UI state; nothing else is. The
 * preview button performs no transaction and says so inline — a disabled-looking action that
 * silently does nothing would read as broken, and a fake confirmation would be worse.
 */
export function PortfolioBuilder() {
  const [active, setActive] = useState(0);
  const [previewed, setPreviewed] = useState(false);
  const template = PORTFOLIO_TEMPLATES[active];

  return (
    <div className="builder" aria-label="ZINVEST portfolio builder — concept preview">
      {/* ---- Left: amount and template selection. ---- */}
      <div className="builder__left">
        <div className="builder__block">
          <span className="metric__label">Amount</span>
          <span className="builder__amount">{ZINVEST.amount}</span>
        </div>

        <div className="builder__block">
          <span className="metric__label">Portfolio template</span>
          <div className="builder__templates" role="tablist" aria-label="Portfolio templates">
            {PORTFOLIO_TEMPLATES.map((t, i) => (
              <button
                key={t.name}
                role="tab"
                aria-selected={i === active}
                className="builder__template"
                data-active={i === active}
                onClick={() => {
                  setActive(i);
                  setPreviewed(false);
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="builder__block builder__block--foot">
          <span className="metric__label">Estimated portfolio value</span>
          <span className="builder__amount">{ZINVEST.amount}</span>
          <button className="btn btn--gold" onClick={() => setPreviewed(true)}>
            Preview allocation
          </button>
          {previewed ? (
            <p className="t-note" role="status">
              Execution opens with ZINVEST. This preview is non-transactional.
            </p>
          ) : null}
        </div>
      </div>

      {/* ---- Right: the example allocation for the selected template. ---- */}
      <div className="builder__right">
        <div className="builder__alloc-head">
          <span className="metric__label">Example allocation</span>
          <span className="t-demo">Illustrative</span>
        </div>

        {template.allocation.length === 0 ? (
          <p className="builder__empty">
            Custom allocations are defined by you at launch — any supported Stock Token,
            weighted however you decide, alongside ZEC.
          </p>
        ) : (
          <ul className="alloc">
            {template.allocation.map((a) => (
              <li className="alloc__row" key={a.symbol}>
                <span className="alloc__symbol">{a.symbol}</span>
                <span className="alloc__bar">
                  <span className="alloc__fill" style={{ width: `${a.weight}%` }} />
                </span>
                <span className="alloc__weight">{a.weight}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
