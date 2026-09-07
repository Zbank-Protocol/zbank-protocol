import { useState } from "react";
import { AssetAmountInput } from "./AssetAmountInput";
import { InterestRateBreakdown } from "./InterestRateBreakdown";
import type { ZCreditMarket } from "../../hooks/useZCreditMarket";
import type { ZCreditPosition } from "../../hooks/useZCreditPosition";
import { useZCreditActions } from "../../hooks/useZCreditActions";
import { useWallet } from "../../hooks/useWallet";
import { NETWORK } from "../../config/protocol";
import { fmtUsd } from "../../lib/economics";

/**
 * The lender workflow, shared by the ZCREDIT supply tab and ZEARN: deposit USDG, earn the
 * borrower-paid variable rate, withdraw against available liquidity. One market, one panel —
 * ZEARN is presentation, not a second protocol.
 *
 * When the market contract is deployed and a wallet is connected, both buttons execute real
 * transactions (exact-amount approvals, receipt-awaited). Otherwise they stay disabled.
 */
export function SupplyPanel({
  market,
  position,
  account,
}: {
  market: ZCreditMarket;
  position: ZCreditPosition;
  account: string | null;
}) {
  const [amount, setAmount] = useState("");
  const actions = useZCreditActions(account, position.refresh);
  const wallet = useWallet();
  const needsSwitch = account != null && wallet.chainId !== NETWORK.chainId;
  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed > 0;
  const canAct = market.live && actions.ready && !actions.busy && !needsSwitch;

  return (
    <div className="panel-duo">
      <div className="panel">
        <span className="metric__label">Supply USDG</span>

        <AssetAmountInput
          label="Amount"
          symbol="USDG"
          value={amount}
          onChange={setAmount}
          balance={null}
          disabled={!market.live}
        />

        <div className="panel__actions">
          {needsSwitch ? (
            <button className="btn btn--gold" onClick={() => void wallet.switchChain()}>
              Switch to {NETWORK.name}
            </button>
          ) : (
            <>
              <button
                className="btn btn--gold"
                disabled={!canAct || !valid}
                data-disabled={!canAct || !valid}
                onClick={() => void actions.supply(parsed)}
              >
                {actions.status === "approving"
                  ? "Approving…"
                  : actions.status === "confirming"
                    ? "Confirming…"
                    : "Supply"}
              </button>
              <button
                className="btn btn--line"
                disabled={!canAct || !valid}
                data-disabled={!canAct || !valid}
                onClick={() => void actions.withdraw(parsed)}
              >
                Withdraw
              </button>
            </>
          )}
        </div>

        {actions.error && <p className="t-note t-note--error">{actions.error}</p>}
        {actions.status === "success" && (
          <p className="t-note">Transaction confirmed. Balances update within a few seconds.</p>
        )}
        {market.live && !account && (
          <p className="t-note">Connect a wallet above to supply or withdraw.</p>
        )}

        <p className="t-note">
          Your USDG is supplied to ZCREDIT borrowers. Borrower interest flows back to lenders,
          minus any protocol reserve. Withdrawals depend on available pool liquidity — funds in
          use by borrowers cannot be withdrawn until liquidity returns.
        </p>

        <div className="txpreview__rows">
          <div className="txpreview__row">
            <span className="txpreview__label">Your supplied balance</span>
            <span className="txpreview__value">{fmtUsd(position.suppliedUsdg)}</span>
          </div>
          <div className="txpreview__row">
            <span className="txpreview__label">Interest earned</span>
            <span className="txpreview__value">{fmtUsd(position.interestEarnedUsdg)}</span>
          </div>
          <div className="txpreview__row">
            <span className="txpreview__label">Available liquidity</span>
            <span className="txpreview__value">{fmtUsd(market.availableLiquidity)}</span>
          </div>
        </div>
      </div>

      <div className="panel">
        <span className="metric__label">Rates</span>
        <InterestRateBreakdown market={market} />
        <div className="txpreview__rows">
          <div className="txpreview__row">
            <span className="txpreview__label">Total supplied</span>
            <span className="txpreview__value">{fmtUsd(market.totalSupplied)}</span>
          </div>
          <div className="txpreview__row">
            <span className="txpreview__label">Total borrowed</span>
            <span className="txpreview__value">{fmtUsd(market.totalBorrowed)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
