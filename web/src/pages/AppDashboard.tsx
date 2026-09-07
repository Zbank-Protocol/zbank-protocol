import { Link } from "react-router-dom";
import { PageHead } from "../components/app/PageHead";
import { MetricCard } from "../components/MetricCard";
import { HealthFactor } from "../components/app/HealthFactor";
import { WalletButton } from "../components/app/WalletButton";
import { useWallet } from "../hooks/useWallet";
import { usePortfolio } from "../hooks/usePortfolio";
import { useTreasuryMetrics } from "../hooks/useTreasuryMetrics";
import { fmtRatio, fmtUsd, fmtZec } from "../lib/economics";

const QUICK_ACTIONS = [
  { label: "Invest", to: "/invest" },
  { label: "Borrow", to: "/credit" },
  { label: "Earn", to: "/earn" },
  { label: "Loop", to: "/credit/loop" },
  { label: "Treasury", to: "/treasury" },
] as const;

/**
 * /app — the unified dashboard: the user's whole ZBANK position in one screen, most important
 * figures first. Composes usePortfolio and useTreasuryMetrics; renders "—" for everything that
 * cannot honestly be read yet.
 */
export default function AppDashboard() {
  const wallet = useWallet();
  const portfolio = usePortfolio(wallet.address);
  const treasury = useTreasuryMetrics();

  return (
    <main className="page">
      <div className="container">
        <PageHead
          kicker="ZBANK"
          title="Your bank, in one view."
          lede={
            wallet.ready
              ? "Balances and positions populate as products go live."
              : "Connect your wallet on Robinhood Chain to see balances and positions."
          }
          aside={<WalletButton />}
        />

        {/* Quick actions first — this page is a launchpad. */}
        <div className="quick">
          {QUICK_ACTIONS.map((a) => (
            <Link className="btn btn--line" to={a.to} key={a.to}>
              {a.label}
            </Link>
          ))}
        </div>

        {/* Portfolio. */}
        <div className="board">
          <div className="board__grid">
            <MetricCard label="ZEC balance" value={fmtZec(portfolio.zecBalance)} />
            <MetricCard label="USDG balance" value={fmtUsd(portfolio.usdgBalance)} />
            <MetricCard label="ZBNK balance" value={portfolio.zbnkBalance == null ? "—" : String(portfolio.zbnkBalance)} />
            <MetricCard
              label="Stock Token positions"
              value={portfolio.stockTokenPositions == null ? "—" : String(portfolio.stockTokenPositions.length)}
            />
            <MetricCard
              label="ZINDEX positions"
              value={portfolio.indexPositions == null ? "—" : String(portfolio.indexPositions.length)}
            />
            <MetricCard label="Interest earned" value={fmtUsd(portfolio.credit.interestEarnedUsdg)} />
          </div>
        </div>

        {/* Credit position + health. */}
        <div className="workbench">
          <div className="panel">
            <span className="metric__label">ZCREDIT position</span>
            <div className="txpreview__rows">
              <div className="txpreview__row">
                <span className="txpreview__label">Collateral</span>
                <span className="txpreview__value">{fmtZec(portfolio.credit.collateralZec)} ZEC</span>
              </div>
              <div className="txpreview__row">
                <span className="txpreview__label">USDG debt</span>
                <span className="txpreview__value">{fmtUsd(portfolio.credit.borrowedUsdg)}</span>
              </div>
              <div className="txpreview__row">
                <span className="txpreview__label">USDG supplied</span>
                <span className="txpreview__value">{fmtUsd(portfolio.credit.suppliedUsdg)}</span>
              </div>
            </div>
            <div className="panel__actions">
              <Link className="btn btn--line" to="/credit">
                Manage credit
              </Link>
              <Link className="btn btn--line" to="/earn">
                Manage earning
              </Link>
            </div>
          </div>

          <div className="panel">
            <HealthFactor value={portfolio.credit.healthFactor} />
          </div>
        </div>

        {/* Treasury strip — the protocol context every account view carries. */}
        <div className="board">
          <div className="board__grid board__grid--details">
            <MetricCard label="ZEC treasury" value={fmtZec(treasury.treasury.totalZec)} unit="ZEC" />
            <MetricCard label="ZEC per eligible ZBNK" value={fmtRatio(treasury.metrics.zecPerEligibleZbnk)} />
            <MetricCard
              label="1% mission"
              value={
                treasury.metrics.missionProgress == null
                  ? "—"
                  : `${(treasury.metrics.missionProgress * 100).toFixed(1)}`
              }
              unit="%"
            />
          </div>
        </div>
        <p className="t-note container__note">
          Figures marked "—" populate when the corresponding contracts are deployed. Treasury
          value shown is an illustrative pre-launch figure.
        </p>
      </div>
    </main>
  );
}
