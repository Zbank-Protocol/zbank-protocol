import { PageHead } from "../components/app/PageHead";
import { PreviewBanner } from "../components/app/PreviewBanner";
import { MetricCard } from "../components/MetricCard";
import { TreasuryTracker } from "../components/TreasuryTracker";
import { PRODUCT_STATUS, REVENUE_ALLOCATION } from "../config/protocol";
import { useTreasuryMetrics } from "../hooks/useTreasuryMetrics";
import { fmtAmount, fmtPct, fmtRatio, fmtUsd, fmtZec } from "../lib/economics";
import type { TreasuryWindow } from "../hooks/useTreasuryMetrics";

function WindowTable({ title, rows }: { title: string; rows: TreasuryWindow[] }) {
  return (
    <div className="panel">
      <span className="metric__label">{title}</span>
      <div className="txpreview__rows">
        {rows.map((r) => (
          <div className="txpreview__row" key={r.window}>
            <span className="txpreview__label">{r.window}</span>
            <span className="txpreview__value" data-pending={r.value == null}>
              {r.value == null ? "Pending token launch" : fmtAmount(r.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ZTREASURY — "watch the machine work." Every figure flows from useTreasuryMetrics, which
 * derives from the same economics module as the rest of the site. Nothing on this page is
 * fabricated: what isn't onchain yet says Pending launch.
 */
export default function Treasury() {
  const t = useTreasuryMetrics();

  return (
    <main className="page">
      <div className="container">
        <PageHead
          kicker="ZTREASURY"
          status={PRODUCT_STATUS.ztreasury}
          title="Watch the machine work."
          lede="The protocol's ZEC treasury, ZBNK supply mechanics, and revenue flows — live from chain data at launch."
        />
        <PreviewBanner product="ztreasury" />

        {/* Core treasury figures. */}
        <div className="board">
          <div className="board__grid">
            <MetricCard label="Total ZEC treasury" value={fmtZec(t.treasury.totalZec)} unit="ZEC" />
            <MetricCard
              label="Redeemable ZEC"
              value={t.treasury.redeemableZec == null ? "—" : fmtZec(t.treasury.redeemableZec)}
            />
            <MetricCard
              label="Strategic / reserved ZEC"
              value={t.treasury.strategicZec == null ? "—" : fmtZec(t.treasury.strategicZec)}
            />
            <MetricCard
              label="Eligible ZBNK supply"
              value={t.token.eligibleSupply == null ? "—" : fmtAmount(t.token.eligibleSupply)}
            />
            <MetricCard label="ZEC per eligible ZBNK" value={fmtRatio(t.metrics.zecPerEligibleZbnk)} />
            <MetricCard
              label="Treasury asset value / ZBNK"
              value={fmtUsd(t.metrics.treasuryAssetValuePerZbnk)}
            />
          </div>
        </div>

        {/* The 1% mission. */}
        <TreasuryTracker />

        {/* Flows. */}
        <div className="workbench workbench--even">
          <WindowTable title="ZEC acquired" rows={t.zecAcquired} />
          <WindowTable title="ZBNK burned" rows={t.zbnkBurned} />
        </div>

        {/* Token market comparison. */}
        <div className="board">
          <div className="board__grid board__grid--details">
            <MetricCard label="ZBNK market price" value={fmtUsd(t.token.currentPrice)} />
            <MetricCard label="Premium / discount" value={fmtPct(t.metrics.premiumDiscount)} />
            <MetricCard label="Protocol revenue" value={fmtUsd(t.protocolRevenueUsd)} />
          </div>
        </div>

        {/* Revenue allocation — explicitly not final. */}
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

        {/* Activity. */}
        <div className="workbench workbench--even">
          <div className="panel">
            <span className="metric__label">Recent treasury transactions</span>
            <p className="protocol__value" data-pending="true">
              Pending token launch
            </p>
          </div>
          <div className="panel">
            <span className="metric__label">Recent burns</span>
            <p className="protocol__value" data-pending="true">
              Pending token launch
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
