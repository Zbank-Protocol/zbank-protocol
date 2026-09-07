import { PageHead } from "../components/app/PageHead";
import { BetaNote } from "../components/app/PreviewBanner";
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
          title="Put your dollars to work."
          lede="Deposit USDG. Earn the variable interest ZCREDIT borrowers pay. Withdraw whenever liquidity is available."
          aside={<WalletButton />}
        />
        <SupplyPanel market={market} position={position} account={wallet.address} />

        <p className="t-note container__note">
          ZEARN is the lender side of the ZCREDIT market — not a separate protocol. Rates are
          variable and depend on borrower demand. Withdrawal availability depends on pool
          liquidity: when funds are utilized by borrowers, withdrawals wait for liquidity to
          return. There is no instant-redemption guarantee.
        </p>
        <BetaNote />
      </div>
    </main>
  );
}
