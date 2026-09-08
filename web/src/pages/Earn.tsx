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

  return (
    <main className="page">
      <div className="container">
        <PageHead
          kicker="ZEARN"
          status={PRODUCT_STATUS.zearn}
          title="Fund the Zcash side of the market."
          lede="ZEC holders borrow USDG against their collateral. You supply the USDG they borrow — and earn the variable interest they pay."
          aside={<WalletButton />}
        />
        <BetaNote />
        <SupplyPanel market={market} position={position} account={wallet.address} />

        {/* The mechanism, drawn: rates are a function of utilization, read from the contract. */}
        <div className="panel panel--wide">
          <span className="metric__label">How the rate is set</span>
          <RateCurve market={market} />
          <p className="t-note">
            The borrow rate follows pool utilization along this curve — read live from the
            deployed contract, not configured in the site. When ZEC holders borrow, utilization
            moves right, the rate climbs, and suppliers earn it (minus the{" "}
            {(market.reserveFactorBps / 100).toFixed(0)}% protocol reserve). An empty pool is
            the left edge of the curve, not a broken product: early suppliers hold the whole
            move.
          </p>
        </div>

        <p className="t-note container__note">
          ZEARN is the lender side of the ZCREDIT market — not a separate protocol. Withdrawals
          depend on available liquidity: funds in use by borrowers return as loans are repaid or
          liquidated, so there is no instant-redemption guarantee.
        </p>
      </div>
    </main>
  );
}
