import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHead } from "../components/app/PageHead";
import { PreviewBanner } from "../components/app/PreviewBanner";
import { AssetAmountInput } from "../components/app/AssetAmountInput";
import { TransactionPreview } from "../components/app/TransactionPreview";
import { INDEX_STRATEGIES, NETWORK, PRODUCT_STATUS } from "../config/protocol";
import { useZInvestQuote } from "../hooks/useZInvestQuote";
import { useZInvestActions } from "../hooks/useZInvestActions";
import { useWallet } from "../hooks/useWallet";
import { WalletButton } from "../components/app/WalletButton";
import { supportedSymbols, usdgBalance } from "../lib/zinvest";
import { TickerIcon, tickerName } from "../components/app/TickerIcon";

type Mode = "index" | "custom";

type CustomRow = { symbol: string; weight: string };

/**
 * ZINVEST — the flagship investing interface, live on Robinhood Chain.
 *
 * USDG in → choose a prebuilt ZINDEX strategy or a custom allocation → live QuoterV2
 * pricing per leg → one atomic Uniswap v3 multicall, every leg slippage-guarded, tokens
 * settle straight to the connected wallet. No ZBANK contract custodies funds on this path.
 */
export default function Invest() {
  const wallet = useWallet();
  const [params] = useSearchParams();

  // Deep link from ZINDEX cards: /invest?index=ZTECH. CUSTOM maps to the custom builder.
  const requested = params.get("index");
  const initialIndex = Math.max(
    0,
    INDEX_STRATEGIES.filter((s) => s.targets.length > 0).findIndex((s) => s.ticker === requested),
  );

  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<Mode>(requested === "CUSTOM" ? "custom" : "index");
  const [strategyIdx, setStrategyIdx] = useState(initialIndex);
  const [slippageBps, setSlippageBps] = useState(50);
  const [balance, setBalance] = useState<number | null>(null);
  const [custom, setCustom] = useState<CustomRow[]>([
    { symbol: "SPY", weight: "50" },
    { symbol: "NVDA", weight: "50" },
  ]);

  const strategy = INDEX_STRATEGIES[strategyIdx];

  useEffect(() => {
    if (!wallet.address) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    usdgBalance(wallet.address as `0x${string}`)
      .then((b) => {
        if (!cancelled) setBalance(b);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [wallet.address]);

  const allocation = useMemo(() => {
    if (mode === "index") return strategy.targets;
    return custom
      .filter((r) => r.symbol.trim() !== "" && Number(r.weight) > 0)
      .map((r) => ({ symbol: r.symbol.toUpperCase().trim(), weight: Number(r.weight) }));
  }, [mode, strategy, custom]);

  const customTotal = custom.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
  const amountNum = Number(amount.replace(/[,\s]/g, "")) || null;
  const quote = useZInvestQuote(amountNum, allocation);
  const actions = useZInvestActions(wallet.address);

  const connected = wallet.address != null;
  const onChain = wallet.chainId === NETWORK.chainId;
  const needsSwitch = connected && !onChain;
  const customValid = mode === "index" || customTotal === 100;
  const overBalance = balance != null && amountNum != null && amountNum > balance;
  const canExecute =
    wallet.ready && quote.executable && customValid && !overBalance && !actions.busy;

  const executeLabel = !connected
    ? "Connect wallet to continue"
    : needsSwitch
      ? "Switch to Robinhood Chain"
      : actions.status === "approving"
        ? "Approving USDG…"
        : actions.status === "confirming"
          ? "Confirm in wallet…"
          : "Execute";

  return (
    <main className="page">
      <div className="container">
        <PageHead
          kicker="ZINVEST"
          status={PRODUCT_STATUS.zinvest}
          title="One balance. An entire market."
          lede="The invest leg of the Zcash bank. Put USDG — yours, or borrowed against your ZEC through ZLOOP — into Stock Token portfolios, executed atomically through Uniswap v3. Your ZEC stays yours; the dollars do the buying."
          aside={<WalletButton />}
        />
        <PreviewBanner product="zinvest" />

        <div className="workbench">
          {/* ---- Left: input, mode, allocation. ---- */}
          <div className="panel">
            <AssetAmountInput
              label="You invest"
              symbol="USDG"
              value={amount}
              onChange={setAmount}
              balance={balance}
            />

            {/* The obvious question, answered where it's asked. */}
            <p className="t-note">
              Holding ZEC instead? Don't sell it — <Link to="/credit/loop">use ZLOOP</Link>:
              borrow USDG against your ZEC and invest that, keeping your ZEC exposure. A direct
              ZEC input arrives when a liquid zZEC market exists on Robinhood Chain.
            </p>

            <div className="mode">
              <span className="metric__label">Investment mode</span>
              <div className="mode__tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={mode === "index"}
                  data-active={mode === "index"}
                  className="mode__tab"
                  onClick={() => setMode("index")}
                >
                  Prebuilt index
                </button>
                <button
                  role="tab"
                  aria-selected={mode === "custom"}
                  data-active={mode === "custom"}
                  className="mode__tab"
                  onClick={() => setMode("custom")}
                >
                  Custom portfolio
                </button>
              </div>
            </div>

            {mode === "index" ? (
              <div className="mode__body">
                <span className="metric__label">Strategy</span>
                <div className="builder__templates" role="tablist" aria-label="ZINDEX strategies">
                  {INDEX_STRATEGIES.filter((s) => s.targets.length > 0).map((s, i) => (
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
                <p className="strategy-brief">
                  <strong>{strategy.name}.</strong> {strategy.description} Weights are targets
                  you buy at execution — there is no automated rebalancing afterward.
                </p>
                <ul className="alloc">
                  {strategy.targets.map((t) => (
                    <li className="alloc__row alloc__row--rich" key={t.symbol}>
                      <TickerIcon symbol={t.symbol} />
                      <span className="alloc__id">
                        <span className="alloc__symbol">{t.symbol}</span>
                        <span className="alloc__name">{tickerName(t.symbol)}</span>
                      </span>
                      <span className="alloc__bar">
                        <span className="alloc__fill" style={{ width: `${t.weight}%` }} />
                      </span>
                      <span className="alloc__weight">{t.weight}%</span>
                    </li>
                  ))}
                </ul>
                <Link className="t-note" to="/invest/indexes">
                  View all ZINDEX strategies →
                </Link>
              </div>
            ) : (
              <div className="mode__body">
                <span className="metric__label">Allocation (must total 100%)</span>
                {custom.map((row, i) => (
                  <div className="custom-row" key={i}>
                    <input
                      className="calc__input"
                      placeholder="Symbol"
                      value={row.symbol}
                      aria-label={`Asset ${i + 1} symbol`}
                      list="zinvest-symbols"
                      onChange={(e) =>
                        setCustom(custom.map((r, j) => (j === i ? { ...r, symbol: e.target.value } : r)))
                      }
                    />
                    <input
                      className="calc__input"
                      placeholder="%"
                      inputMode="numeric"
                      value={row.weight}
                      aria-label={`Asset ${i + 1} weight`}
                      onChange={(e) =>
                        setCustom(custom.map((r, j) => (j === i ? { ...r, weight: e.target.value } : r)))
                      }
                    />
                    <button
                      className="btn btn--ghost"
                      aria-label={`Remove asset ${i + 1}`}
                      onClick={() => setCustom(custom.filter((_, j) => j !== i))}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <datalist id="zinvest-symbols">
                  {supportedSymbols().map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <div className="custom-foot">
                  <button
                    className="btn btn--line"
                    onClick={() => setCustom([...custom, { symbol: "", weight: "" }])}
                  >
                    + Add asset
                  </button>
                  <span className="t-note" data-invalid={customTotal !== 100}>
                    Total: {customTotal}%
                  </span>
                </div>
                <span className="t-note">Supported: {supportedSymbols().join(" · ")}</span>
              </div>
            )}

            <div className="mode__body">
              <span className="metric__label">Slippage tolerance</span>
              <div className="builder__templates">
                {[10, 50, 100].map((bps) => (
                  <button
                    key={bps}
                    className="builder__template"
                    data-active={slippageBps === bps}
                    onClick={() => setSlippageBps(bps)}
                  >
                    {(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ---- Right: the quote, live from QuoterV2. ---- */}
          <div className="panel">
            <TransactionPreview
              rows={[
                { label: "Route", value: quote.route.join(" → ") },
                { label: "Execution", value: "Uniswap v3 · atomic multicall" },
                { label: "Legs", value: String(quote.estimatedReceived.length) },
                { label: "Slippage guard", value: `${(slippageBps / 100).toFixed(2)}% per leg` },
              ]}
            />

            <div className="txpreview">
              <span className="metric__label">
                {quote.quoting ? "Quoting…" : "Estimated received (live quote)"}
              </span>
              <div className="txpreview__rows">
                {quote.estimatedReceived.map((r) => (
                  <div className="txpreview__row txpreview__row--asset" key={r.symbol}>
                    <span className="txpreview__label txpreview__label--asset">
                      <TickerIcon symbol={r.symbol} size={18} />
                      <span className="txpreview__ticker">{r.symbol}</span>
                      <span className="txpreview__name">{tickerName(r.symbol)}</span>
                    </span>
                    <span className="txpreview__value">
                      {r.amount == null
                        ? "—"
                        : r.amount.toLocaleString("en-US", { maximumFractionDigits: 6 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              className="btn btn--gold panel__execute"
              disabled={needsSwitch ? false : !canExecute}
              data-disabled={needsSwitch ? false : !canExecute}
              onClick={() => {
                if (needsSwitch) {
                  void wallet.switchChain();
                  return;
                }
                if (quote.basket) void actions.invest(quote.basket, slippageBps);
              }}
            >
              {executeLabel}
            </button>

            {actions.status === "success" && actions.txHash ? (
              <p className="t-note" role="status">
                Executed.{" "}
                <a
                  href={`${NETWORK.explorer}/tx/${actions.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction →
                </a>
              </p>
            ) : null}
            {actions.status === "error" ? (
              <p className="t-note t-note--error" role="alert">
                {actions.error}
              </p>
            ) : null}
            {overBalance ? (
              <p className="t-note t-note--error" role="alert">
                Amount exceeds your USDG balance.
              </p>
            ) : null}
            {quote.blockedBy ? (
              <p className="t-note" role="note">
                {quote.blockedBy}
              </p>
            ) : null}
          </div>
        </div>

        <p className="t-note container__note">
          Stock Tokens are Robinhood Chain tokenized equity products issued by Robinhood Assets
          (Jersey) Limited. Holding a Stock Token is not ownership of the underlying share.
          Swaps execute against public Uniswap v3 liquidity; quotes move with the market.
          Nothing on this page is investment advice.
        </p>
      </div>
    </main>
  );
}
