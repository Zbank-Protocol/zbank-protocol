import { useCallback, useEffect, useState } from "react";
import { PageHead } from "../components/app/PageHead";
import { WalletButton } from "../components/app/WalletButton";
import { AssetAmountInput } from "../components/app/AssetAmountInput";
import { TickerIcon } from "../components/app/TickerIcon";
import { ASSETS, NETWORK, PROTOCOL_CONTRACTS } from "../config/protocol";
import { useWallet } from "../hooks/useWallet";
import { useTokenBalance } from "../hooks/useTokenBalance";
import {
  addFullRangeLiquidity,
  initializeLiquidityPool,
  readLiquiditySnapshot,
  type LiquiditySnapshot,
} from "../lib/liquidity";
import { fmtUsd, fmtZec } from "../lib/economics";

type ActionState = "idle" | "initializing" | "adding" | "done" | "error";

const EMPTY: LiquiditySnapshot = {
  pool: null,
  initialized: false,
  oraclePrice: null,
  poolPrice: null,
  deviationPct: null,
  poolZzec: null,
  poolUsdg: null,
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Transaction failed";
}

export default function Liquidity() {
  const wallet = useWallet();
  const zecBalance = useTokenBalance(
    wallet.address,
    ASSETS.ZEC.address as `0x${string}`,
    ASSETS.ZEC.decimals,
  );
  const usdgBalance = useTokenBalance(
    wallet.address,
    ASSETS.USDG.address as `0x${string}`,
    ASSETS.USDG.decimals,
  );
  const [snapshot, setSnapshot] = useState<LiquiditySnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [zzec, setZzec] = useState("");
  const [usdg, setUsdg] = useState("");
  const [action, setAction] = useState<ActionState>("idle");
  const [detail, setDetail] = useState("");

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await readLiquiditySnapshot());
    } catch {
      setSnapshot(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const changeZzec = (value: string) => {
    setZzec(value);
    const parsed = Number(value);
    if (snapshot.oraclePrice != null && Number.isFinite(parsed)) {
      setUsdg(String(Number((parsed * snapshot.oraclePrice).toFixed(6))));
    }
  };

  const changeUsdg = (value: string) => {
    setUsdg(value);
    const parsed = Number(value);
    if (snapshot.oraclePrice != null && snapshot.oraclePrice > 0 && Number.isFinite(parsed)) {
      setZzec(String(Number((parsed / snapshot.oraclePrice).toFixed(8))));
    }
  };

  const initialize = async () => {
    if (!wallet.address || !wallet.ready) return;
    setAction("initializing");
    setDetail("");
    try {
      const hash = await initializeLiquidityPool(wallet.address as `0x${string}`);
      setDetail(`Pool initialized at the live oracle price · ${hash.slice(0, 10)}…`);
      setAction("done");
      await refresh();
    } catch (error) {
      setDetail(message(error));
      setAction("error");
    }
  };

  const add = async () => {
    if (!wallet.address || !wallet.ready) return;
    setAction("adding");
    setDetail("");
    try {
      const hash = await addFullRangeLiquidity(
        wallet.address as `0x${string}`,
        Number(zzec),
        Number(usdg),
      );
      setDetail(`Liquidity position minted to your wallet · ${hash.slice(0, 10)}…`);
      setAction("done");
      setZzec("");
      setUsdg("");
      zecBalance.refresh();
      usdgBalance.refresh();
      await refresh();
    } catch (error) {
      setDetail(message(error));
      setAction("error");
    }
  };

  const validAmounts = Number(zzec) > 0 && Number(usdg) > 0;
  const priceSafe = snapshot.deviationPct != null && snapshot.deviationPct <= 2;

  return (
    <main className="page">
      <div className="container">
        <PageHead
          kicker="ZLIQUIDITY"
          title="Fund the ZEC market."
          lede="Add zZEC and USDG directly to the shared Uniswap v3 market. Your wallet receives the LP NFT and earns its position fees—ZBANK never takes custody of it."
          aside={<WalletButton />}
        />

        <div className="liquidity-status">
          <div className="liquidity-status__asset">
            <TickerIcon symbol="ZEC" size={30} />
            <div>
              <span className="metric__label">zZEC in pool</span>
              <strong>{snapshot.poolZzec == null ? "—" : fmtZec(snapshot.poolZzec)}</strong>
            </div>
          </div>
          <div className="liquidity-status__asset">
            <TickerIcon symbol="USDG" size={30} />
            <div>
              <span className="metric__label">USDG in pool</span>
              <strong>{snapshot.poolUsdg == null ? "—" : fmtUsd(snapshot.poolUsdg)}</strong>
            </div>
          </div>
          <div>
            <span className="metric__label">Pool state</span>
            <strong>
              {loading
                ? "Reading chain…"
                : snapshot.oraclePrice == null
                  ? "Oracle unavailable"
                  : snapshot.initialized
                    ? "Open"
                    : "Ready to initialize"}
            </strong>
          </div>
          <div>
            <span className="metric__label">Oracle deviation</span>
            <strong>
              {snapshot.deviationPct == null ? "—" : `${snapshot.deviationPct.toFixed(2)}%`}
            </strong>
          </div>
        </div>

        <div className="workbench liquidity-workbench">
          <section className="panel">
            <span className="metric__label">Your position</span>
            <h2 className="panel__title">Deposit both sides.</h2>
            <p className="t-note">
              Amounts stay paired to the live ZEC/USD oracle. The transaction refuses to mint
              when the pool price is more than 2% away from that reference.
            </p>

            <AssetAmountInput
              label="ZEC liquidity"
              symbol="zZEC"
              value={zzec}
              onChange={changeZzec}
              balance={zecBalance.balance}
              disabled={!snapshot.initialized}
            />
            <AssetAmountInput
              label="Dollar liquidity"
              symbol="USDG"
              value={usdg}
              onChange={changeUsdg}
              balance={usdgBalance.balance}
              disabled={!snapshot.initialized}
            />

            {!snapshot.initialized ? (
              <button
                className="btn btn--gold btn--wide"
                type="button"
                disabled={
                  !wallet.ready || snapshot.oraclePrice == null || action === "initializing"
                }
                onClick={() => void initialize()}
              >
                {action === "initializing" ? "Initializing…" : "Initialize at oracle price"}
              </button>
            ) : (
              <button
                className="btn btn--gold btn--wide"
                type="button"
                disabled={!wallet.ready || !validAmounts || !priceSafe || action === "adding"}
                onClick={() => void add()}
              >
                {action === "adding" ? "Creating position…" : "Add liquidity"}
              </button>
            )}
            {detail ? (
              <p className={`form-message ${action === "error" ? "form-message--error" : ""}`}>
                {detail}
              </p>
            ) : null}
          </section>

          <aside className="panel liquidity-fees">
            <span className="metric__label">Automatic funding</span>
            <h2 className="panel__title">ZBNK trading feeds this pool.</h2>
            <div className="liquidity-flow" aria-label="Token trading fee liquidity flow">
              <span>ZBNK / USDG trades</span>
              <b>→</b>
              <span>Pons creator fees</span>
              <b>→</b>
              <span>50% zZEC / USDG liquidity</span>
              <b>→</b>
              <span>50% protocol treasury</span>
            </div>
            <p className="t-note">
              ZBNK launches against USDG on Pons with a permanent Safe-controlled fee router.
              The router forwards USDG into a replaceable pre-audit liquidity manager after a
              one-day upgrade notice. Its liquidity share becomes a single-sided USDG position
              below spot, supplying dollars to zZEC sellers and accumulating zZEC as trades cross
              the range.
            </p>
            <span className="chip chip--proposed">Pre-audit alpha · activates with ZBNK</span>
            {PROTOCOL_CONTRACTS.ponsFeeLiquidityManager ? (
              <a
                className="liquidity-manager-link"
                href={`${NETWORK.explorer}/address/${PROTOCOL_CONTRACTS.ponsFeeLiquidityManager}`}
                target="_blank"
                rel="noreferrer"
              >
                Fee manager · {PROTOCOL_CONTRACTS.ponsFeeLiquidityManager.slice(0, 10)}… ↗
              </a>
            ) : null}
          </aside>
        </div>

        <div className="liquidity-risks" role="note">
          <span className="metric__label">Before funding</span>
          <p>
            LP positions can lose value relative to holding the assets, earn variable fees, and
            depend on Uniswap and zZEC contracts. Full-range liquidity is deliberately simple
            but less capital-efficient. Your LP NFT belongs to your wallet; ZBANK cannot
            withdraw it.
          </p>
          {snapshot.pool ? (
            <a
              href={`${NETWORK.explorer}/address/${snapshot.pool}`}
              target="_blank"
              rel="noreferrer"
            >
              Verify pool onchain ↗
            </a>
          ) : null}
        </div>
      </div>
    </main>
  );
}
