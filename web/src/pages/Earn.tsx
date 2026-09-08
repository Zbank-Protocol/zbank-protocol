import { useState } from "react";
import { MorphoVaultPanel } from "../components/app/MorphoVaultPanel";
import { PageHead } from "../components/app/PageHead";
import { BetaNote } from "../components/app/PreviewBanner";
import { RateCurve } from "../components/app/RateCurve";
import { SupplyPanel } from "../components/app/SupplyPanel";
import { WalletButton } from "../components/app/WalletButton";
import { PRODUCT_STATUS } from "../config/protocol";
import { useZCreditMarket } from "../hooks/useZCreditMarket";
import { useZCreditPosition } from "../hooks/useZCreditPosition";
import { useWallet } from "../hooks/useWallet";

/**
 * ZEARN — the simple consumer face of the ZCREDIT lender side. Same market, same hooks, same
 * SupplyPanel; the only difference is that nothing else is on the page. It is deliberately not
 * a second protocol.
 *
 * An empty pool means 0.00% everywhere, which is true but reads as dead — so the page leads
 * with the mechanism: the deployed rate curve, where you are on it, and why early suppliers
 * capture the move when borrowing starts.
 */
export default function Earn() {
  const wallet = useWallet();
  const market = useZCreditMarket();
  const position = useZCreditPosition(wallet.address);
  const [lane, setLane] = useState<"zec" | "diversified">("zec");

  return (
    <main className="page">
      <div className="container">
        <PageHead
          kicker="ZEARN"
          status={PRODUCT_STATUS.zearn}
          title="Put your USDG to work."
          lede="Fund ZEC-backed borrowing inside ZBANK, or use a live third-party Morpho vault for diversified USDG lending. You choose the source of the yield."
          aside={<WalletButton />}
        />

        <div className="earn-lanes" role="tablist" aria-label="Choose an earn market">
          <button
            className="earn-lane"
            data-active={lane === "zec"}
            role="tab"
            aria-selected={lane === "zec"}
            onClick={() => setLane("zec")}
          >
            <span className="earn-lane__index">01</span>
            <span>
              <strong>ZEC CREDIT MARKET</strong>
              <small>Yield paid by ZEC-backed borrowers</small>
            </span>
            <em>Native ZBANK</em>
          </button>
          <button
            className="earn-lane"
            data-active={lane === "diversified"}
            role="tab"
            aria-selected={lane === "diversified"}
            onClick={() => setLane("diversified")}
          >
            <span className="earn-lane__index">02</span>
            <span>
              <strong>DIVERSIFIED USDG</strong>
              <small>Steakhouse-curated lending via Morpho</small>
            </span>
            <em>Third party</em>
          </button>
        </div>

        {lane === "zec" ? (
          <>
            <BetaNote />
            <SupplyPanel market={market} position={position} account={wallet.address} />

            <div className="panel panel--wide">
              <span className="metric__label">How the ZEC credit rate is set</span>
              <RateCurve market={market} />
              <p className="t-note">
                The borrow rate follows pool utilization along this curve — read live from the
                deployed contract, not configured in the site. When ZEC holders borrow,
                utilization moves right, the rate climbs, and suppliers earn it (minus the{" "}
                {(market.reserveFactorBps / 100).toFixed(0)}% protocol reserve).
              </p>
            </div>

            <p className="t-note container__note">
              This lane is the lender side of ZCREDIT. Withdrawals depend on available liquidity:
              USDG in use by ZEC borrowers returns as loans are repaid or liquidated.
            </p>
          </>
        ) : (
          <>
            <MorphoVaultPanel account={wallet.address} />
            <p className="t-note container__note">
              This lane interacts directly with a third-party Morpho Vault V2. ZBANK does not
              control its allocations, rates, liquidity, contracts, or curator decisions.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
