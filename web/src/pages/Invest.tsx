import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHead } from "../components/app/PageHead";
import { PreviewBanner } from "../components/app/PreviewBanner";
import { AssetAmountInput } from "../components/app/AssetAmountInput";
import { TransactionPreview } from "../components/app/TransactionPreview";
import { INDEX_STRATEGIES, PRODUCT_STATUS } from "../config/protocol";
import { useZInvestQuote } from "../hooks/useZInvestQuote";
import { useWallet } from "../hooks/useWallet";
import { WalletButton } from "../components/app/WalletButton";

type Mode = "index" | "custom";

type CustomRow = { symbol: string; weight: string };

/**
 * ZINVEST — the flagship investing interface. Connect → ZEC in → choose a prebuilt ZINDEX
 * strategy or build a custom allocation → review the full quote → execute.
 *
 * Execution is enabled exclusively by the quote's `executable` flag, which is false until the
 * router exists. The interface is complete and functional in preview mode; the button says
 * exactly why it is disabled. No transaction is ever faked.
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
  const [custom, setCustom] = useState<CustomRow[]>([
    { symbol: "SPY", weight: "50" },
    { symbol: "ZEC", weight: "50" },
  ]);

  const strategy = INDEX_STRATEGIES[strategyIdx];

  const allocation = useMemo(() => {
    if (mode === "index") return strategy.targets;
    return custom
      .filter((r) => r.symbol.trim() !== "" && Number(r.weight) > 0)
      .map((r) => ({ symbol: r.symbol.toUpperCase().trim(), weight: Number(r.weight) }));
  }, [mode, strategy, custom]);

  const customTotal = custom.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
  const amountNum = Number(amount.replace(/[,\s]/g, "")) || null;
  const quote = useZInvestQuote(amountNum, allocation);

  return (
    <main className="page">
      <div className="container">
        <PageHead
          kicker="ZINVEST"
          status={PRODUCT_STATUS.zinvest}
          title="Turn Zcash into a portfolio."
          lede="Use ZEC to access supported Robinhood Chain Stock Token portfolios — custom allocations or prebuilt ZINDEX strategies, in one flow."
          aside={<WalletButton />}
        />
        <PreviewBanner product="zinvest" />

        <div className="workbench">
          {/* ---- Left: input, mode, allocation. ---- */}
          <div className="panel">
            <AssetAmountInput
              label="You invest"
              symbol="ZEC"
              value={amount}
              onChange={setAmount}
              balance={null}
              disabled={false}
            />

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
                <ul className="alloc">
                  {strategy.targets.map((t) => (
                    <li className="alloc__row" key={t.symbol}>
                      <span className="alloc__symbol">{t.symbol}</span>
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

          {/* ---- Right: the quote. ---- */}
          <div className="panel">
            <TransactionPreview
              rows={[
                { label: "Route", value: quote.route.join(" → ") },
                { label: "Price impact", value: quote.priceImpact == null ? "—" : `${(quote.priceImpact * 100).toFixed(2)}%` },
                { label: "Network fee", value: quote.networkFeeEth == null ? "—" : `${quote.networkFeeEth} ETH` },
                {
                  label: "Protocol fee",
                  value: quote.protocolFeeBps == null ? "— (not set)" : `${(quote.protocolFeeBps / 100).toFixed(2)}%`,
                },
                { label: "Slippage tolerance", value: `${(slippageBps / 100).toFixed(2)}%` },
              ]}
            />

            <div className="txpreview">
              <span className="metric__label">Estimated received</span>
              <div className="txpreview__rows">
                {quote.estimatedReceived.map((r) => (
                  <div className="txpreview__row" key={r.symbol}>
                    <span className="txpreview__label">{r.symbol}</span>
                    <span className="txpreview__value">{r.amount == null ? "—" : r.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            <button className="btn btn--gold panel__execute" disabled data-disabled="true">
              {wallet.ready ? "Execute" : "Connect wallet to continue"}
            </button>
            {quote.blockedBy ? (
              <p className="t-note" role="note">
                Execution disabled: {quote.blockedBy}. Estimates populate when routing and
                pricing are live. Transaction status and the explorer link appear here after
                execution.
              </p>
            ) : null}
          </div>
        </div>

        <p className="t-note container__note">
          Stock Tokens are Robinhood Chain tokenized equity products. Holding a Stock Token is
          not ownership of the underlying share. Nothing on this page is investment advice.
        </p>
      </div>
    </main>
  );
}
