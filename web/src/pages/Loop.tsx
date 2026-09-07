import { useState } from "react";
import { PageHead } from "../components/app/PageHead";
import { PreviewBanner } from "../components/app/PreviewBanner";
import { AssetAmountInput } from "../components/app/AssetAmountInput";
import { TransactionPreview } from "../components/app/TransactionPreview";
import { HealthFactor } from "../components/app/HealthFactor";
import { WalletButton } from "../components/app/WalletButton";
import { INDEX_STRATEGIES, NETWORK, PRODUCT_STATUS } from "../config/protocol";
import { useZCreditMarket } from "../hooks/useZCreditMarket";
import { useZCreditPosition } from "../hooks/useZCreditPosition";
import { useWallet } from "../hooks/useWallet";
import { fmtRate, fmtUsd, fmtZec } from "../lib/economics";
import { ASSETS } from "../config/protocol";
import { ensureAllowance, fromUsdg, fromZec, marketAddress, marketWrite } from "../lib/zcredit";
import { executeBasket, quoteBasket } from "../lib/zinvest";

/** The risks a leveraged position carries, stated as the primary content — never fine print. */
const LOOP_RISKS = [
  "Borrowed USDG creates debt that must be repaid.",
  "Interest accrues on the debt for as long as it is open.",
  "Your ZEC collateral can be liquidated.",
  "Investment losses do not reduce the debt owed.",
  "ZEC price declines increase liquidation risk.",
] as const;

type LoopStep = "idle" | "collateral" | "borrow" | "invest" | "done" | "error";

const STEP_LABEL: Record<LoopStep, string> = {
  idle: "Open position",
  collateral: "1/3 · Depositing collateral…",
  borrow: "2/3 · Borrowing USDG…",
  invest: "3/3 · Investing…",
  done: "Position open",
  error: "Retry",
};

/**
 * ZLOOP — borrow against ZEC and invest the borrowed USDG, in one guided flow. Live:
 * the credit legs run on the deployed ZCREDIT market, the invest leg executes through
 * Uniswap v3. Three transactions, sequenced, each step reported as it happens.
 */
export default function Loop() {
  const wallet = useWallet();
  const market = useZCreditMarket();
  const position = useZCreditPosition(wallet.address);
  const [collateral, setCollateral] = useState("100");
  const [ltvPct, setLtvPct] = useState(25);
  const [strategyIdx, setStrategyIdx] = useState(0);
  const [acknowledged, setAcknowledged] = useState(false);
  const [step, setStep] = useState<LoopStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const strategies = INDEX_STRATEGIES.filter((s) => s.targets.length > 0);
  const strategy = strategies[strategyIdx];
  const collateralNum = Number(collateral.replace(/[,\s]/g, "")) || null;

  // Live position math from the oracle — never a frontend price table.
  const zecPrice = market.oracle.price;
  const collateralValue =
    collateralNum != null && zecPrice != null ? collateralNum * zecPrice : null;
  const borrowUsdg = collateralValue != null ? (collateralValue * ltvPct) / 100 : null;
  const liqThreshold = market.risk.liquidationThresholdBps / 10_000;
  const healthAfter =
    collateralValue != null && borrowUsdg != null && borrowUsdg > 0
      ? (collateralValue * liqThreshold) / borrowUsdg
      : null;
  const liqPrice =
    collateralNum != null && borrowUsdg != null && borrowUsdg > 0
      ? borrowUsdg / (collateralNum * liqThreshold)
      : null;
  const annualInterest =
    borrowUsdg != null && market.borrowApy != null ? borrowUsdg * market.borrowApy : null;

  const connected = wallet.address != null;
  const onChain = wallet.chainId === NETWORK.chainId;
  const needsSwitch = connected && !onChain;
  const busy = step === "collateral" || step === "borrow" || step === "invest";
  const ready =
    wallet.ready &&
    market.live &&
    acknowledged &&
    collateralNum != null &&
    collateralNum > 0 &&
    borrowUsdg != null &&
    borrowUsdg > 0 &&
    !busy;

  const openPosition = async () => {
    if (!ready || !wallet.address || collateralNum == null || borrowUsdg == null) return;
    const account = wallet.address as `0x${string}`;
    const marketAddr = marketAddress() as `0x${string}`;
    setError(null);
    setTxHash(null);
    try {
      setStep("collateral");
      await ensureAllowance(
        account,
        ASSETS.ZEC.address as `0x${string}`,
        marketAddr,
        fromZec(collateralNum),
      );
      await marketWrite(account, "depositCollateral", [fromZec(collateralNum)]);

      setStep("borrow");
      await marketWrite(account, "borrow", [fromUsdg(borrowUsdg)]);

      setStep("invest");
      const quote = await quoteBasket(borrowUsdg, [...strategy.targets]);
      if (quote.legs.length === 0) throw new Error("No executable legs in strategy");
      const hash = await executeBasket(account, quote, 50);
      setTxHash(hash);
      setStep("done");
      position.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message.split("\n")[0].slice(0, 160) : "Transaction failed";
      setError(message);
      setStep("error");
      position.refresh();
    }
  };

  return (
    <main className="page">
      <div className="container">
        <PageHead
          kicker="ZLOOP"
          status={PRODUCT_STATUS.zloop}
          title="Keep your ZEC. Invest anyway."
          lede="Deposit ZEC as collateral, borrow USDG, and invest the borrowed liquidity — one guided flow, the whole position visible before you confirm."
          aside={<WalletButton />}
        />
        <PreviewBanner product="zloop" />

        <div className="workbench">
          {/* ---- Left: build the position. ---- */}
          <div className="panel">
            <AssetAmountInput
              label="ZEC collateral"
              symbol="zZEC"
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
                { label: "ZEC collateral", value: `${fmtZec(collateralNum)} zZEC` },
                { label: "Collateral value", value: fmtUsd(collateralValue) },
                { label: "USDG borrowed", value: fmtUsd(borrowUsdg) },
                { label: "LTV after borrow", value: `${ltvPct}%` },
                { label: "Investment", value: strategy.ticker },
                { label: "Portfolio purchase", value: fmtUsd(borrowUsdg) },
                { label: "Borrow APY", value: fmtRate(market.borrowApy, 2) },
                { label: "Estimated annual interest", value: fmtUsd(annualInterest) },
                { label: "Estimated liquidation price", value: fmtUsd(liqPrice) },
                {
                  label: "ZEC price (oracle)",
                  value: fmtUsd(zecPrice),
                },
              ]}
              note="Live figures from the deployed market and oracle. Three transactions: deposit collateral, borrow, invest. Estimates are not guarantees."
            />

            <HealthFactor value={healthAfter} />

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

            <button
              className="btn btn--gold panel__execute"
              disabled={needsSwitch ? false : !ready}
              data-disabled={needsSwitch ? false : !ready}
              onClick={() => {
                if (needsSwitch) {
                  void wallet.switchChain();
                  return;
                }
                void openPosition();
              }}
            >
              {!connected
                ? "Connect wallet to continue"
                : needsSwitch
                  ? "Switch to Robinhood Chain"
                  : STEP_LABEL[step]}
            </button>

            {step === "done" && txHash ? (
              <p className="t-note" role="status">
                Position open.{" "}
                <a href={`${NETWORK.explorer}/tx/${txHash}`} target="_blank" rel="noreferrer">
                  View invest transaction →
                </a>{" "}
                Manage the credit side on the ZCREDIT page.
              </p>
            ) : null}
            {error ? (
              <p className="t-note t-note--error" role="alert">
                {error} — completed steps (collateral, borrow) remain in place; manage them on
                the ZCREDIT page.
              </p>
            ) : null}
            {!acknowledged && wallet.ready ? (
              <p className="t-note" role="note">
                Acknowledgment is required before any execution.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
