import { useState } from "react";
import { PageHead } from "../components/app/PageHead";
import { PreviewBanner } from "../components/app/PreviewBanner";
import { AssetAmountInput } from "../components/app/AssetAmountInput";
import { TransactionPreview } from "../components/app/TransactionPreview";
import { HealthFactor } from "../components/app/HealthFactor";
import { WalletButton } from "../components/app/WalletButton";
import { INDEX_STRATEGIES, PRODUCT_STATUS } from "../config/protocol";
import { useZCreditMarket } from "../hooks/useZCreditMarket";
import { fmtRate, fmtUsd, fmtZec } from "../lib/economics";

/** The risks a leveraged position carries, stated as the primary content — never fine print. */
const LOOP_RISKS = [
  "Borrowed USDG creates debt that must be repaid.",
  "Interest accrues on the debt for as long as it is open.",
  "Your ZEC collateral can be liquidated.",
  "Investment losses do not reduce the debt owed.",
  "ZEC price declines increase liquidation risk.",
] as const;

/**
 * ZLOOP — borrow against ZEC and invest the borrowed USDG through ZINVEST, in one guided flow.
 * A composition of the two existing engines; it deliberately has no contracts of its own.
 *
 * The full position is on screen before any confirmation, and execution additionally requires
 * an explicit risk acknowledgment. Pre-launch, execution stays disabled regardless.
 */
export default function Loop() {
  const market = useZCreditMarket();
  const [collateral, setCollateral] = useState("100");
  const [ltvPct, setLtvPct] = useState(25);
  const [strategyIdx, setStrategyIdx] = useState(0);
  const [acknowledged, setAcknowledged] = useState(false);

  const strategies = INDEX_STRATEGIES.filter((s) => s.targets.length > 0);
  const strategy = strategies[strategyIdx];
  const collateralNum = Number(collateral.replace(/[,\s]/g, "")) || null;

  return (
    <main className="page">
      <div className="container">
        <PageHead
          kicker="ZLOOP"
          status={PRODUCT_STATUS.zloop}
          title="Keep your ZEC. Invest anyway."
          lede="Deposit ZEC as collateral, borrow USDG, and invest the borrowed liquidity through ZINVEST — one guided flow, the whole position visible before you confirm."
          aside={<WalletButton />}
        />
        <PreviewBanner product="zloop" />

        <div className="workbench">
          {/* ---- Left: build the position. ---- */}
          <div className="panel">
            <AssetAmountInput
              label="ZEC collateral"
              symbol="ZEC"
              value={collateral}
              onChange={setCollateral}
              balance={null}
            />

            <div className="mode__body">
              <label className="metric__label" htmlFor="loop-ltv">
                Borrow at LTV
              </label>
              <div className="credit__slider">
                <input
                  id="loop-ltv"
                  type="range"
                  min={5}
                  max={market.risk.maxLtvBps / 100}
                  step={1}
                  value={ltvPct}
                  onChange={(e) => setLtvPct(Number(e.target.value))}
                />
                <span className="credit__ltv-value">{ltvPct}%</span>
              </div>
              <span className="t-note">
                Max LTV {(market.risk.maxLtvBps / 100).toFixed(0)}% · liquidation at{" "}
                {(market.risk.liquidationThresholdBps / 100).toFixed(0)}%
              </span>
            </div>

            <div className="mode__body">
              <span className="metric__label">Invest borrowed USDG into</span>
              <div className="builder__templates" role="tablist" aria-label="Strategies">
                {strategies.map((s, i) => (
                  <button
                    key={s.ticker}
                    role="tab"
                    aria-selected={i === strategyIdx}
                    data-active={i === strategyIdx}
                    className="builder__template"
                    onClick={() => setStrategyIdx(i)}
                  >
                    {s.ticker}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk is body copy on this product, not a footnote. */}
            <div className="loop-risks" role="note">
              <span className="metric__label">This is a leveraged position</span>
              <ul className="notes">
                {LOOP_RISKS.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* ---- Right: the whole position, then the acknowledgment, then the button. ---- */}
          <div className="panel">
            <TransactionPreview
              title="Position preview"
              rows={[
                { label: "ZEC collateral", value: `${fmtZec(collateralNum)} ZEC` },
                { label: "Collateral value", value: fmtUsd(null) },
                { label: "USDG borrowed", value: fmtUsd(null) },
                { label: "LTV after borrow", value: `${ltvPct}%` },
                { label: "Investment", value: strategy.ticker },
                { label: "Portfolio purchase", value: fmtUsd(null) },
                { label: "Borrow APY", value: fmtRate(market.borrowApy, 2) },
                { label: "Estimated annual interest", value: fmtUsd(null) },
                { label: "Estimated liquidation price", value: fmtUsd(null) },
                { label: "Total fees", value: fmtUsd(null) },
                { label: "Net position", value: "—", emphasis: true },
              ]}
              note="Dollar figures populate when the oracle and routing are live. Estimates are not guarantees."
            />

            <HealthFactor value={null} />

            <label className="loop-ack">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              <span>
                I understand this position uses borrowed funds and my ZEC collateral may be
                liquidated.
              </span>
            </label>

            <button className="btn btn--gold panel__execute" disabled data-disabled="true">
              Open position
            </button>
            <p className="t-note" role="note">
              Execution disabled: the ZCREDIT market and ZINVEST routing are not deployed.
              {acknowledged ? "" : " Acknowledgment is also required before any execution."}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
