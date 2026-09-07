import { PageHead } from "../components/app/PageHead";
import { MetricCard } from "../components/MetricCard";
import { TreasuryTracker } from "../components/TreasuryTracker";
import { PRODUCT_STATUS, REVENUE_ALLOCATION } from "../config/protocol";
import { useTreasuryMetrics } from "../hooks/useTreasuryMetrics";
import { useZCreditMarket } from "../hooks/useZCreditMarket";
import { fmtAmount, fmtPct, fmtRatio, fmtUsd, fmtZec } from "../lib/economics";

/**
 * ZTREASURY — "watch the machine work."
 *
 * Structured live-first: the top of the page is what is verifiably running today (the credit
 * market, the oracle, accruing reserves), because a dashboard that opens with a wall of
 * dashes reads as dead even when every dash is honest. Everything gated on the ZBNK token
 * launch is collapsed into one clearly-labelled block of compact rows instead of a grid of
 * empty hero cells.
 */
export default function Treasury() {
  const t = useTreasuryMetrics();
  const market = useZCreditMarket();

  /** Token-launch figures, as one compact register instead of dash-walls. */
  const launchRows: { label: string; value: string | null }[] = [
    { label: "Total ZEC treasury", value: t.treasury.totalZec == null ? null : fmtZec(t.treasury.totalZec) },
    { label: "Redeemable ZEC", value: t.treasury.redeemableZec == null ? null : fmtZec(t.treasury.redeemableZec) },
    { label: "Strategic / reserved ZEC", value: t.treasury.strategicZec == null ? null : fmtZec(t.treasury.strategicZec) },
    { label: "Eligible ZBNK supply", value: t.token.eligibleSupply == null ? null : fmtAmount(t.token.eligibleSupply) },
    { label: "ZEC per eligible ZBNK", value: t.metrics.zecPerEligibleZbnk == null ? null : fmtRatio(t.metrics.zecPerEligibleZbnk) },
    { label: "Treasury asset value / ZBNK", value: t.metrics.treasuryAssetValuePerZbnk == null ? null : fmtUsd(t.metrics.treasuryAssetValuePerZbnk) },
    { label: "ZBNK market price", value: t.token.currentPrice == null ? null : fmtUsd(t.token.currentPrice) },
    { label: "Premium / discount", value: t.metrics.premiumDiscount == null ? null : fmtPct(t.metrics.premiumDiscount) },
    { label: "ZEC acquired (all time)", value: t.zecAcquired.find((w) => w.window === "All time")?.value == null ? null : fmtAmount(t.zecAcquired.find((w) => w.window === "All time")!.value!) },
    { label: "ZBNK burned (all time)", value: t.zbnkBurned.find((w) => w.window === "All time")?.value == null ? null : fmtAmount(t.zbnkBurned.find((w) => w.window === "All time")!.value!) },
    { label: "Recent treasury transactions", value: null },
    { label: "Recent burns", value: null },
  ];

  return (
    <main className="page">
      <div className="container">
        <PageHead
          kicker="ZTREASURY"
          status={PRODUCT_STATUS.ztreasury}
          title="Watch the machine work."
          lede="The protocol's live machinery today — and the ZEC treasury it starts filling at token launch."
        />

        {/* ---- Live now: real reads from deployed contracts, refreshed every 15s. ---- */}
        <div className="board">
          <span className="metric__label">Live now — read from Robinhood Chain</span>
          <div className="board__grid">
            <MetricCard
              label="ZEC / USD oracle"
              value={market.oracle.price == null ? (market.oracle.status === "live" ? "Live" : "Standby") : fmtUsd(market.oracle.price)}
              unit="Chainlink"
            />
            <MetricCard
              label="USDG supplied"
              value={market.totalSupplied == null ? "—" : fmtUsd(market.totalSupplied)}
            />
            <MetricCard
              label="USDG borrowed"
              value={market.totalBorrowed == null ? "—" : fmtUsd(market.totalBorrowed)}
            />
            <MetricCard
              label="Available liquidity"
              value={market.availableLiquidity == null ? "—" : fmtUsd(market.availableLiquidity)}
            />
            <MetricCard
              label="Utilization"
              value={market.utilization == null ? "—" : `${(market.utilization * 100).toFixed(1)}%`}
            />
            <MetricCard
              label="Protocol revenue basis"
              value={`${(market.reserveFactorBps / 100).toFixed(0)}%`}
              unit="of borrower interest"
            />
          </div>
          <p className="t-note">
            Protocol revenue accrues as the credit market's reserve share of borrower interest.
            At token launch, revenue routes to ZEC acquisition and the proposed ZBNK burn per the
            allocation below.
          </p>
        </div>

        {/* ---- The 1% mission. ---- */}
        <TreasuryTracker />

        {/* ---- Revenue allocation — explicitly not final. ---- */}
        <div className="panel panel--wide">
          <span className="metric__label">Revenue allocation</span>
          <div className="txpreview__rows">
            <div className="txpreview__row">
              <span className="txpreview__label">ZEC treasury acquisition</span>
              <span className="txpreview__value">{(REVENUE_ALLOCATION.treasuryBps / 100).toFixed(0)}%</span>
            </div>
            <div className="txpreview__row">
              <span className="txpreview__label">ZBNK buyback + burn</span>
              <span className="txpreview__value">{(REVENUE_ALLOCATION.burnBps / 100).toFixed(0)}%</span>
            </div>
            <div className="txpreview__row">
              <span className="txpreview__label">Protocol reserve / operations</span>
              <span className="txpreview__value">{(REVENUE_ALLOCATION.reserveBps / 100).toFixed(0)}%</span>
            </div>
          </div>
          <p className="t-note">
            Placeholder split — final percentages are not confirmed and will be published with
            the treasury contracts.
          </p>
        </div>

        {/* ---- Everything gated on the token, in one honest register. ---- */}
        <div className="panel panel--wide">
          <span className="metric__label">Unlocks at token launch</span>
          <div className="txpreview__rows">
            {launchRows.map((r) => (
              <div className="txpreview__row" key={r.label}>
                <span className="txpreview__label">{r.label}</span>
                <span className="txpreview__value" data-pending={r.value == null}>
                  {r.value ?? "Pending token launch"}
                </span>
              </div>
            ))}
          </div>
          <p className="t-note">
            The treasury contract requires the ZBNK token at construction; these figures switch
            to live chain reads the moment it deploys. Nothing here is ever estimated.
          </p>
        </div>
      </div>
    </main>
  );
}
