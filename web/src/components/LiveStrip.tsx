import { MetricCard } from "./MetricCard";
import { useZCreditMarket } from "../hooks/useZCreditMarket";
import { STOCK_TOKENS } from "../config/protocol";
import { CHAIN } from "../config";
import { fmtUsd } from "../lib/economics";

/**
 * The institutional strip under the hero — live reads from the deployed credit market and
 * the ZEC/USD oracle, not pre-launch dashes. Every figure here is real: it may be small on
 * day one, but it moves, and honest-and-moving beats impressive-and-fake.
 */
export function LiveStrip() {
  const market = useZCreditMarket();
  const universe = Object.keys(STOCK_TOKENS).length;

  const oracleValue =
    market.oracle.price != null
      ? fmtUsd(market.oracle.price)
      : market.oracle.status === "live"
        ? "Live"
        : "Standby";

  return (
    <div className="strip" aria-label="Live protocol metrics">
      <MetricCard label="ZEC / USD Oracle" value={oracleValue} unit={market.oracle.price != null ? "Chainlink" : ""} />
      <MetricCard
        label="USDG Supplied"
        value={market.totalSupplied == null ? "—" : fmtUsd(market.totalSupplied)}
      />
      <MetricCard
        label="Available Liquidity"
        value={market.availableLiquidity == null ? "—" : fmtUsd(market.availableLiquidity)}
      />
      <MetricCard label="Stock Tokens" value={String(universe)} unit="listed" />
      <MetricCard label="Network" value={CHAIN.name} unit={`· ${CHAIN.id}`} />
      <span className="strip__note t-demo">Live from Robinhood Chain · refreshes every 15s</span>
    </div>
  );
}
