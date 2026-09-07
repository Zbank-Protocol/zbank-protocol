import { useState } from "react";
import { AssetAmountInput } from "./AssetAmountInput";
import { TransactionPreview } from "./TransactionPreview";
import { HealthFactor } from "./HealthFactor";
import type { ZCreditMarket } from "../../hooks/useZCreditMarket";
import type { ZCreditPosition } from "../../hooks/useZCreditPosition";
import { useZCreditActions } from "../../hooks/useZCreditActions";
import { useWallet } from "../../hooks/useWallet";
import { NETWORK } from "../../config/protocol";
import { fmtRate, fmtUsd, fmtZec } from "../../lib/economics";

/**
 * The borrower workflow: collateral in, USDG out, risk always on screen.
 *
 * With the market deployed and a wallet connected, all four actions execute real
 * transactions. Valuations come only from the oracle — this panel never prices ZEC itself,
 * and when the oracle is halted, values render "—" and borrowing reverts onchain.
 */
export function BorrowPanel({
  market,
  position,
  account,
}: {
  market: ZCreditMarket;
  position: ZCreditPosition;
  account: string | null;
}) {
  const [collateral, setCollateral] = useState("");
  const [borrow, setBorrow] = useState("");
  const actions = useZCreditActions(account, position.refresh);

  const wallet = useWallet();
  const needsSwitch = account != null && wallet.chainId !== NETWORK.chainId;
  const collateralNum = Number(collateral);
  const borrowNum = Number(borrow);
  const collateralValid = Number.isFinite(collateralNum) && collateralNum > 0;
  const borrowValid = Number.isFinite(borrowNum) && borrowNum > 0;
  const canAct = market.live && actions.ready && !actions.busy && !needsSwitch;
  const hasDebt = (position.borrowedUsdg ?? 0) > 0;

  return (
    <div className="panel-duo">
      <div className="panel">
        <span className="metric__label">Manage position</span>

        <AssetAmountInput
          label="Deposit collateral"
          symbol="ZEC"
          value={collateral}
          onChange={setCollateral}
          balance={null}
          disabled={!market.live}
        />
        <AssetAmountInput
          label="Borrow"
          symbol="USDG"
          value={borrow}
          onChange={setBorrow}
          balance={null}
          disabled={!market.live}
        />

        <div className="panel__actions">
          {needsSwitch ? (
            <button className="btn btn--gold" onClick={() => void wallet.switchChain()}>
              Switch to {NETWORK.name}
            </button>
          ) : null}
          <button
            className="btn btn--gold"
            hidden={needsSwitch}
            disabled={!canAct || !collateralValid}
            data-disabled={!canAct || !collateralValid}
            onClick={() => void actions.depositCollateral(collateralNum)}
          >
            {actions.status === "approving" ? "Approving…" : "Deposit collateral"}
          </button>
          <button
            className="btn btn--line"
            hidden={needsSwitch}
            disabled={!canAct || !borrowValid}
            data-disabled={!canAct || !borrowValid}
            onClick={() => void actions.borrow(borrowNum)}
          >
            {actions.status === "confirming" ? "Confirming…" : "Borrow USDG"}
          </button>
          <button
            className="btn btn--line"
            hidden={needsSwitch}
            disabled={!canAct || !hasDebt}
            data-disabled={!canAct || !hasDebt}
            onClick={() =>
              void actions.repay(
                borrowValid ? borrowNum : Infinity,
                position.borrowedUsdg ?? 0,
              )
            }
          >
            {borrowValid ? "Repay" : "Repay all"}
          </button>
          <button
            className="btn btn--line"
            hidden={needsSwitch}
            disabled={!canAct || !collateralValid}
            data-disabled={!canAct || !collateralValid}
            onClick={() => void actions.withdrawCollateral(collateralNum)}
          >
            Withdraw collateral
          </button>
        </div>

        {actions.error && <p className="t-note t-note--error">{actions.error}</p>}
        {actions.status === "success" && (
          <p className="t-note">Transaction confirmed. Position updates within a few seconds.</p>
        )}
        {market.live && !account && (
          <p className="t-note">Connect a wallet above to manage a position.</p>
        )}
        {!market.live && (
          <p className="t-note" role="note">
            Actions enable when the ZCREDIT market and the {market.oracle.label} oracle are
            deployed. Nothing here is an offer of credit.
          </p>
        )}
      </div>

      <div className="panel">
        <TransactionPreview
          title="Position"
          rows={[
            { label: "Collateral", value: `${fmtZec(position.collateralZec)} ZEC` },
            { label: "Collateral value", value: fmtUsd(position.collateralValueUsd) },
            { label: "Borrowed", value: fmtUsd(position.borrowedUsdg) },
            { label: "Available to borrow", value: fmtUsd(position.availableToBorrowUsdg) },
            { label: "Current LTV", value: fmtRate(position.ltv, 1) },
            {
              label: "Max LTV",
              value: `${(market.risk.maxLtvBps / 100).toFixed(0)}%`,
            },
            {
              label: "Liquidation threshold",
              value: `${(market.risk.liquidationThresholdBps / 100).toFixed(0)}%`,
            },
            { label: "Borrow APY", value: fmtRate(market.borrowApy, 2) },
            { label: "Accrued interest", value: fmtUsd(position.accruedInterestUsdg) },
          ]}
          note="Risk parameters are read live from the deployed market contract."
        />
        <HealthFactor value={position.healthFactor} />
      </div>
    </div>
  );
}
