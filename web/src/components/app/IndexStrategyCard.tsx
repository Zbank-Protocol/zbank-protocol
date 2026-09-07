import { Link } from "react-router-dom";
import type { IndexStrategy } from "../../config/protocol";

/**
 * One ZINDEX strategy: ticker, targets as bars, the rebalance policy stated plainly. No
 * performance figures anywhere — nothing has traded, so nothing is claimed. Execution routes
 * through ZINVEST, which is the whole point of ZINDEX being a strategy layer.
 */
export function IndexStrategyCard({ strategy }: { strategy: IndexStrategy }) {
  return (
    <div className="idx">
      <div className="idx__head">
        <span className="idx__ticker">{strategy.ticker}</span>
        <span className="chip chip--proposed">{strategy.status}</span>
      </div>
      <span className="idx__name">{strategy.name}</span>
      <p className="idx__desc">{strategy.description}</p>

      {strategy.targets.length > 0 ? (
        <ul className="alloc">
          {strategy.targets.map((t) => (
            <li className="alloc__row" key={t.symbol}>
              <span className="alloc__symbol">{t.symbol}</span>
              <span className="alloc__bar">
                <span className="alloc__fill" style={{ width: `${t.weight}%` }} />
              </span>
              <span className="alloc__weight">{t.weight}%</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="idx__desc">Define any supported Stock Token allocation alongside ZEC.</p>
      )}

      <span className="t-note">{strategy.rebalancePolicy}</span>

      <Link className="btn btn--line idx__cta" to={`/invest?index=${strategy.ticker}`}>
        Invest via ZINVEST
      </Link>
    </div>
  );
}
