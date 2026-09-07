import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHead } from "../components/app/PageHead";
import { PreviewBanner } from "../components/app/PreviewBanner";
import { BorrowPanel } from "../components/app/BorrowPanel";
import { SupplyPanel } from "../components/app/SupplyPanel";
import { WalletButton } from "../components/app/WalletButton";
import { PRODUCT_STATUS } from "../config/protocol";
import { useZCreditMarket } from "../hooks/useZCreditMarket";
import { useZCreditPosition } from "../hooks/useZCreditPosition";
import { useWallet } from "../hooks/useWallet";
import { fmtUsd, fmtRate } from "../lib/economics";

const FLOW = [
  "Deposit ZEC",
  "ZCREDIT collateral vault",
  "Oracle values collateral",
  "Borrowing capacity",
  "Borrow USDG from lender liquidity",
] as const;

/**
 * ZCREDIT — the lending market, both sides. Borrowers post ZEC and draw USDG; lenders supply
 * the USDG that borrowers draw and earn the interest they pay. One market underneath, two tabs
 * on top, liquidation risk on the surface at all times.
 */
export default function Credit() {
  const [side, setSide] = useState<"borrow" | "supply">("borrow");
  const wallet = useWallet();
  const market = useZCreditMarket();
  const position = useZCreditPosition(wallet.address);

  return (
    <main className="page">
      <div className="container">
        <PageHead
          kicker="ZCREDIT"
          status={PRODUCT_STATUS.zcredit}
          title="Keep your ZEC. Access USDG."
          lede="Deposit ZEC as collateral to borrow USDG — or supply USDG to borrowers and earn the variable interest they pay."
          aside={<WalletButton />}
        />
        <PreviewBanner product="zcredit" />

        <div className="mode__tabs mode__tabs--page" role="tablist">
          <button
            role="tab"
            aria-selected={side === "borrow"}
            data-active={side === "borrow"}
            className="mode__tab"
            onClick={() => setSide("borrow")}
          >
            Borrow
          </button>
          <button
            role="tab"
            aria-selected={side === "supply"}
            data-active={side === "supply"}
            className="mode__tab"
            onClick={() => setSide("supply")}
          >
            Supply
          </button>
          <Link className="mode__tab mode__tab--link" to="/credit/loop">
            ZLOOP →
          </Link>
        </div>

        {side === "borrow" ? (
          <>
            <BorrowPanel market={market} position={position} account={wallet.address} />

            {/* The mechanism, stated as structure. */}
            <div className="flow-rail" role="img" aria-label="Borrowing flow">
              {FLOW.map((step, i) => (
                <span className="flow-rail__part" key={step}>
                  {i > 0 ? <span className="flywheel__chain-arrow">→</span> : null}
                  <span className="flywheel__chain-node">{step}</span>
                </span>
              ))}
            </div>
          </>
        ) : (
          <SupplyPanel market={market} position={position} account={wallet.address} />
        )}

        {/* Market + oracle details — always visible regardless of tab. */}
        <div className="panel panel--wide">
          <span className="metric__label">Market details</span>
          <div className="board__grid board__grid--details">
            <div className="metric">
              <span className="metric__label">Utilization</span>
              <span className="metric__value metric__value--sm">{fmtRate(market.utilization, 1)}</span>
            </div>
            <div className="metric">
              <span className="metric__label">Available liquidity</span>
              <span className="metric__value metric__value--sm">{fmtUsd(market.availableLiquidity)}</span>
            </div>
            <div className="metric">
              <span className="metric__label">Reserve factor</span>
              <span className="metric__value metric__value--sm">
                {(market.reserveFactorBps / 100).toFixed(1)}%
              </span>
            </div>
            <div className="metric">
              <span className="metric__label">Oracle · {market.oracle.label}</span>
              <span className="metric__value metric__value--sm" data-pending={market.oracle.status !== "live"}>
                {market.oracle.status === "live" && market.oracle.price != null
                  ? fmtUsd(market.oracle.price)
                  : "Pending launch"}
              </span>
            </div>
            <div className="metric">
              <span className="metric__label">Interest model</span>
              <span className="metric__value metric__value--sm">Variable, utilization-based</span>
            </div>
            <div className="metric">
              <span className="metric__label">Liquidation bonus</span>
              <span className="metric__value metric__value--sm">
                {(market.risk.liquidationBonusBps / 100).toFixed(1)}%
              </span>
            </div>
          </div>
          <p className="t-note">
            Collateral is valued exclusively by the onchain {market.oracle.label} oracle — never
            by a frontend price. Stale, invalid, or zero prices halt borrowing. Risk parameters
            shown are development placeholders; final risk parameters are required before
            mainnet.
          </p>
        </div>
      </div>
    </main>
  );
}
