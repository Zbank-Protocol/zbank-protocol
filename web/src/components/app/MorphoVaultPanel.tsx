import { useState } from "react";
import { AssetAmountInput } from "./AssetAmountInput";
import { TickerIcon } from "./TickerIcon";
import { useMorphoVault } from "../../hooks/useMorphoVault";
import { useTokenBalance } from "../../hooks/useTokenBalance";
import { useWallet } from "../../hooks/useWallet";
import { ASSETS, EXTERNAL_RAILS, MORPHO, NETWORK } from "../../config/protocol";
import {
  depositMorpho,
  previewMorphoDeposit,
  readMorphoShares,
  withdrawMorpho,
} from "../../lib/morpho";
import { fmtAmount, fmtRate, fmtUsd } from "../../lib/economics";

type Mode = "deposit" | "withdraw";
type Status = "idle" | "approving" | "confirming" | "success" | "error";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Morpho transaction failed";
}

function compactUsd(value: number | null): string {
  if (value == null) return "$—";
  return `$${new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value)}`;
}

export function MorphoVaultPanel({ account }: { account: string | null }) {
  const wallet = useWallet();
  const vault = useMorphoVault(account);
  const usdgBalance = useTokenBalance(
    account,
    ASSETS.USDG.address as `0x${string}`,
    ASSETS.USDG.decimals,
  );
  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState("");
  const [previewShares, setPreviewShares] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const changeAmount = (value: string) => {
    setAmount(value);
    setPreviewShares(null);
    const parsed = Number(value);
    if (mode === "deposit" && Number.isFinite(parsed) && parsed > 0) {
      void previewMorphoDeposit(parsed)
        .then((shares) => setPreviewShares(shares))
        .catch(() => setPreviewShares(null));
    }
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    setAmount("");
    setPreviewShares(null);
    setStatus("idle");
    setError("");
  };

  const submit = async () => {
    if (!account || !wallet.ready) return;
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setError("");
    try {
      if (mode === "deposit") {
        setStatus("approving");
        await depositMorpho(account as `0x${string}`, parsed);
      } else {
        setStatus("confirming");
        const withdrawAll =
          vault.userAssets != null && parsed >= Math.max(0, vault.userAssets - 0.000001);
        const shares = withdrawAll
          ? await readMorphoShares(account as `0x${string}`)
          : null;
        await withdrawMorpho(account as `0x${string}`, parsed, shares);
      }
      setStatus("success");
      setAmount("");
      setPreviewShares(null);
      vault.refresh();
      usdgBalance.refresh();
    } catch (cause) {
      setStatus("error");
      setError(errorMessage(cause));
    }
  };

  const parsed = Number(amount);
  const sourceBalance = mode === "deposit" ? usdgBalance.balance : vault.userAssets;
  const valid =
    Number.isFinite(parsed) &&
    parsed > 0 &&
    sourceBalance != null &&
    parsed <= sourceBalance + 0.000001;
  const needsSwitch = account != null && wallet.chainId !== NETWORK.chainId;

  return (
    <div className="morpho-vault">
      <div className="morpho-vault__head">
        <div className="morpho-vault__identity">
          <TickerIcon symbol="USDG" size={34} />
          <div>
            <span className="metric__label">Third-party diversified vault</span>
            <h2>Steakhouse USDG</h2>
          </div>
        </div>
        <div className="morpho-vault__badges">
          <span className="chip chip--gold">Morpho V2</span>
          <span className="chip chip--proposed">Variable rate</span>
        </div>
      </div>

      <div className="morpho-vault__metrics">
        <div>
          <span className="metric__label">Current net APY</span>
          <strong>{fmtRate(vault.netApy, 2)}</strong>
        </div>
        <div>
          <span className="metric__label">Recent average</span>
          <strong>{fmtRate(vault.averageNetApy, 2)}</strong>
        </div>
        <div>
          <span className="metric__label">Total deposits</span>
          <strong>{compactUsd(vault.totalAssetsUsd)}</strong>
        </div>
        <div>
          <span className="metric__label">Available liquidity</span>
          <strong>{compactUsd(vault.availableLiquidityUsd)}</strong>
        </div>
        <div>
          <span className="metric__label">Share value</span>
          <strong>{fmtUsd(vault.sharePriceUsd ?? vault.sharePrice)}</strong>
        </div>
        <div>
          <span className="metric__label">Your vault position</span>
          <strong>{account ? fmtUsd(vault.userAssets) : "$—"}</strong>
        </div>
      </div>

      <div className="morpho-vault__body">
        <section className="morpho-vault__action">
          <div className="mode__tabs" role="tablist">
            <button
              className="mode__tab"
              data-active={mode === "deposit"}
              aria-selected={mode === "deposit"}
              role="tab"
              onClick={() => changeMode("deposit")}
            >
              Deposit
            </button>
            <button
              className="mode__tab"
              data-active={mode === "withdraw"}
              aria-selected={mode === "withdraw"}
              role="tab"
              onClick={() => changeMode("withdraw")}
            >
              Withdraw
            </button>
          </div>

          <AssetAmountInput
            label={mode === "deposit" ? "USDG to deposit" : "USDG to withdraw"}
            symbol="USDG"
            value={amount}
            onChange={changeAmount}
            balance={sourceBalance}
          />

          {mode === "deposit" && previewShares != null ? (
            <div className="txpreview__row">
              <span className="txpreview__label">Estimated shares</span>
              <span className="txpreview__value">
                {fmtAmount(previewShares)} {MORPHO.shareSymbol}
              </span>
            </div>
          ) : null}

          {needsSwitch ? (
            <button className="btn btn--gold btn--wide" onClick={() => void wallet.switchChain()}>
              Switch to {NETWORK.name}
            </button>
          ) : (
            <button
              className="btn btn--gold btn--wide"
              disabled={!wallet.ready || !valid || status === "approving" || status === "confirming"}
              onClick={() => void submit()}
            >
              {status === "approving"
                ? "Approving and depositing…"
                : status === "confirming"
                  ? "Confirming withdrawal…"
                  : mode === "deposit"
                    ? "Deposit into Morpho"
                    : "Withdraw USDG"}
            </button>
          )}

          {!account ? <p className="t-note">Connect a wallet to use this vault.</p> : null}
          {status === "success" ? (
            <p className="t-note">Transaction confirmed. The position updates onchain.</p>
          ) : null}
          {error ? <p className="t-note t-note--error">{error}</p> : null}
        </section>

        <aside className="morpho-vault__explain">
          <span className="metric__label">What happens</span>
          <p>
            Your USDG enters a Steakhouse-curated Morpho vault allocated across multiple
            USDG lending markets. You receive transferable steakUSDG shares directly in your
            wallet. ZBANK does not custody or wrap the position.
          </p>
          <ul className="notes">
            <li>Yield comes from third-party borrowers, not specifically ZEC borrowers.</li>
            <li>APY changes with market utilization and allocations.</li>
            <li>Withdrawals depend on vault and underlying-market liquidity.</li>
            <li>Vault, curator, collateral, oracle, and USDG risks remain.</li>
          </ul>
          <div className="morpho-vault__links">
            <a href={MORPHO.appUrl} target="_blank" rel="noreferrer">
              Inspect on Morpho ↗
            </a>
            <a href={EXTERNAL_RAILS.acrossBridge} target="_blank" rel="noreferrer">
              Bridge USDG with Across ↗
            </a>
            <a
              href={`${NETWORK.explorer}/address/${MORPHO.steakhouseUsdgVault}`}
              target="_blank"
              rel="noreferrer"
            >
              Verify contract ↗
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
