import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { HEALTH_BANDS, REVENUE_ALLOCATION, ZCREDIT_RISK, INDEX_STRATEGIES } from "../config/protocol";
import { MODEL_DISCLAIMER } from "../data/site";
import {
  DiagramCreditMarket,
  DiagramEngine,
  DiagramInvestRoute,
  DiagramLoop,
  DiagramRateCurve,
  DiagramTreasurySplit,
} from "../components/docs/Diagrams";

/**
 * /docs — full protocol documentation: a sticky section index with scrollspy on the left,
 * long-form explanation on the right. Every number that is not a config constant is labelled
 * as an example; every mechanism is explained end to end, not summarized.
 */

const SECTIONS = [
  { id: "overview", label: "What is ZBANK" },
  { id: "concepts", label: "Core concepts" },
  { id: "zinvest", label: "ZINVEST — Investing" },
  { id: "zindex", label: "ZINDEX — Strategies" },
  { id: "zcredit", label: "ZCREDIT — Borrowing" },
  { id: "zearn", label: "ZEARN — Earning" },
  { id: "zloop", label: "ZLOOP — Leverage" },
  { id: "economics", label: "ZBNK economics" },
  { id: "treasury", label: "Treasury accounting" },
  { id: "revenue", label: "Revenue model" },
  { id: "status", label: "Launch status & security" },
  { id: "agents", label: "APIs for agents" },
  { id: "faq", label: "FAQ" },
] as const;

/** A labelled formula, set like the equation motif. */
function Formula({ parts, note }: { parts: string[]; note?: string }) {
  return (
    <div className="docformula">
      <div className="docformula__row">
        {parts.map((p, i) => (
          <span className="docformula__part" data-op={/^[÷×=+−/]$/.test(p)} key={`${p}-${i}`}>
            {p}
          </span>
        ))}
      </div>
      {note ? <span className="t-demo">{note}</span> : null}
    </div>
  );
}

/** Label/value parameter rows. */
function Params({ rows }: { rows: [string, string][] }) {
  return (
    <div className="txpreview__rows docparams">
      {rows.map(([label, value]) => (
        <div className="txpreview__row" key={label}>
          <span className="txpreview__label">{label}</span>
          <span className="txpreview__value">{value}</span>
        </div>
      ))}
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="docsteps">
      {items.map((s, i) => (
        <li key={s}>
          <span className="docsteps__n">{String(i + 1).padStart(2, "0")}</span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

export default function Docs() {
  const [active, setActive] = useState<string>("overview");
  const articleRef = useRef<HTMLDivElement | null>(null);

  // Scrollspy: highlight the section currently in the reading band.
  useEffect(() => {
    const headings = Array.from(
      articleRef.current?.querySelectorAll<HTMLElement>("section[id]") ?? [],
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="page">
      <div className="container docs">
        {/* ---- Sticky index. ---- */}
        <aside className="docs__side">
          <span className="docs__side-label">Documentation</span>
          <nav className="docs__toc" aria-label="Sections">
            {SECTIONS.map((s, i) => (
              <a href={`#${s.id}`} data-active={active === s.id} key={s.id}>
                <span className="docs__toc-n">{String(i + 1).padStart(2, "0")}</span>
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* ---- The reference. ---- */}
        <div className="docs__article" ref={articleRef}>
          <header className="page-head">
            <span className="page-head__kicker">Docs</span>
            <h1 className="page-head__title">How ZBANK works.</h1>
            <p className="page-head__lede">
              Start with a user journey, inspect the machinery, or connect an agent directly
              to canonical protocol data. Every status and number has a source.
            </p>
          </header>
          <div className="docs-portal" aria-label="Documentation entry points">
            <Link className="docs-entry docs-entry--gold" to="/start">
              <span className="docs-entry__eyebrow">New to ZBANK</span>
              <strong>Take the visual tour</strong>
              <span>Five chapters · products, risks, and the ZEC thesis</span>
              <span className="docs-entry__arrow">Start →</span>
            </Link>
            <a className="docs-entry" href="/api/v1/protocol">
              <span className="docs-entry__eyebrow">Building an agent</span>
              <strong>Read the protocol manifest</strong>
              <span>Contracts, assets, strategies, status, and risk parameters</span>
              <span className="docs-entry__arrow">JSON →</span>
            </a>
            <Link className="docs-entry" to="/treasury">
              <span className="docs-entry__eyebrow">Verifying claims</span>
              <strong>Open live telemetry</strong>
              <span>Oracle, credit liquidity, utilization, and onchain addresses</span>
              <span className="docs-entry__arrow">Verify →</span>
            </Link>
          </div>

          {/* ============================== 01 Overview ============================== */}
          <section className="doc" id="overview">
            <h2>
              <span>01</span>What is ZBANK
            </h2>
            <p>
              ZBANK is a financial platform built around Zcash on Robinhood Chain, an
              EVM-compatible L2. The premise: ZEC holders shouldn't have to sell their ZEC to
              participate in markets. The platform lets a user do three fundamental things, and
              everything else is composed from them:
            </p>
            <Steps
              items={[
                "INVEST — deploy USDG into Stock Token portfolios today. The direct zZEC route is built and activates after its onchain market is funded (ZINVEST, with ZINDEX as its strategy layer).",
                "BORROW — post ZEC as collateral and borrow USDG against it (ZCREDIT, with ZLOOP composing borrow + invest).",
                "EARN — supply the USDG that borrowers draw, and earn the interest they pay (ZEARN).",
              ]}
            />
            <div className="docs-primitives" aria-label="ZBANK's three primitives">
              <article>
                <span>01 · INVEST</span>
                <strong>USDG / zZEC → markets</strong>
                <p>Build Stock Token portfolios through ZINVEST and ZINDEX.</p>
              </article>
              <article>
                <span>02 · BORROW</span>
                <strong>ZEC → liquidity</strong>
                <p>Keep ZEC exposure while drawing USDG through ZCREDIT.</p>
              </article>
              <article>
                <span>03 · EARN</span>
                <strong>USDG → interest</strong>
                <p>Supply the liquidity ZEC-backed borrowers use through ZEARN.</p>
              </article>
            </div>
            <p>
              Every product feeds one economic engine: protocol revenue acquires ZEC for the
              treasury and buys ZBNK for permanent retirement. More ZEC held against fewer ZBNK — that
              ratio is the number the whole system moves, and{" "}
              <Link to="/treasury">ZTREASURY</Link> exists to let anyone watch it.
            </p>
          </section>

          {/* ============================== 02 Concepts ============================== */}
          <section className="doc" id="concepts">
            <h2>
              <span>02</span>Core concepts
            </h2>
            <dl className="docgloss">
              <dt>ZEC</dt>
              <dd>
                Zcash's native coin. On Robinhood Chain, ZBANK products use a supported bridged
                representation of ZEC; the treasury's long-term target is native ZEC.
              </dd>
              <dt>USDG</dt>
              <dd>
                The dollar stablecoin of the ZBANK credit market. Borrowers receive it; lenders
                supply it and earn interest denominated in it.
              </dd>
              <dt>Stock Tokens</dt>
              <dd>
                Robinhood Chain's tokenized equity products. Holding a Stock Token is exposure
                to the instrument, not ownership of the underlying share.
              </dd>
              <dt>LTV (loan-to-value)</dt>
              <dd>
                Debt divided by collateral value. Borrow $1,500 against $5,000 of collateral
                and your LTV is 30%. New borrowing is capped at the max LTV; positions become
                liquidatable at the liquidation threshold.
              </dd>
              <dt>Health factor</dt>
              <dd>
                (Collateral value × liquidation threshold) ÷ debt. Above 1.0 the position is
                safe from liquidation; at or below 1.0 it can be liquidated. ZBANK shows this as
                a four-band meter — Safe, Caution, High risk, Liquidatable — never a tooltip.
              </dd>
              <dt>Utilization</dt>
              <dd>
                Borrowed ÷ supplied in the credit market. Drives both interest rates: high
                utilization raises the borrow rate, which raises the supply rate.
              </dd>
              <dt>Oracle</dt>
              <dd>
                The onchain price feed (ZEC/USD) that values collateral. ZBANK never values
                collateral from a frontend price; if the oracle is stale or invalid, borrowing
                halts.
              </dd>
              <dt>Eligible ZBNK supply</dt>
              <dd>
                The ZBNK that counts toward redemption math — total supply minus burned or
                permanently retired tokens and any excluded balances.
              </dd>
            </dl>
          </section>

          {/* ============================== 03 ZINVEST ============================== */}
          <section className="doc" id="zinvest">
            <h2>
              <span>03</span>ZINVEST — Investing
            </h2>
            <p>
              ZINVEST turns USDG—or, after liquidity activation, zZEC—into a portfolio of Stock
              Tokens. It splits the input across target weights and swaps each leg through
              Uniswap v3. ZLOOP remains the keep-your-ZEC path: it borrows USDG against ZEC
              collateral, then passes the borrowed USDG into the same execution engine.
            </p>
            <Steps
              items={[
                "Connect a wallet on Robinhood Chain.",
                "Choose USDG (live) or zZEC (coming soon until its pool is funded), then enter the amount.",
                "Choose a mode: a prebuilt ZINDEX strategy, or a custom allocation you define asset-by-asset (weights must total 100%).",
                "Review the quote: route, price impact, network fee, protocol fee, slippage tolerance, and the estimated amount of each token received.",
                "Execute. The transaction status and explorer link appear in the same panel.",
              ]}
            />
            <DiagramInvestRoute />
            <p>
              The quote is the contract between you and the interface: nothing executes that
              wasn't shown. If the market moves beyond your slippage tolerance between quote and
              execution, the transaction reverts rather than filling at a worse price.
            </p>
            <p className="t-note">
              Current status: USDG input is live through Uniswap v3's SwapRouter02. Direct zZEC
              routing code and pool-seeding tooling are complete, but that input remains Coming
              soon until the zZEC/USDG market is funded, the router is deployed, and the new
              path passes external review and mainnet dry runs.
            </p>
          </section>

          {/* ============================== 04 ZINDEX ============================== */}
          <section className="doc" id="zindex">
            <h2>
              <span>04</span>ZINDEX — Strategies
            </h2>
            <p>
              ZINDEX is not a separate protocol — it is a set of named target allocations that
              execute through ZINVEST. Selecting ZTECH and investing 1,000 USDG is exactly
              equivalent to entering that allocation by hand; the strategy layer just saves you
              the typing and gives the allocation a name.
            </p>
            <Params
              rows={INDEX_STRATEGIES.filter((s) => s.targets.length > 0).map((s) => [
                `${s.ticker} — ${s.name}`,
                s.targets.map((t) => `${t.symbol} ${t.weight}%`).join(" · "),
              ])}
            />
            <p>
              These are <strong>target allocation strategies</strong>: the weights are applied
              at the moment you execute. There is no automated rebalancing engine, so
              allocations drift with prices after purchase, and no strategy claims active
              management. No performance data is shown because nothing has traded.
            </p>
          </section>

          {/* ============================== 05 ZCREDIT ============================== */}
          <section className="doc" id="zcredit">
            <h2>
              <span>05</span>ZCREDIT — Borrowing
            </h2>
            <p>
              ZCREDIT is a collateralized lending market with two sides. Borrowers deposit ZEC
              and draw USDG against it. Lenders supply the USDG that borrowers draw. Interest
              flows from borrowers to lenders, with the protocol keeping a reserve factor.
            </p>
            <DiagramCreditMarket />
            <Steps
              items={[
                "Deposit ZEC into the ZCREDIT collateral vault.",
                "The oracle values the collateral in USD.",
                "Borrowing capacity = collateral value × max LTV.",
                "Borrow USDG from lender liquidity, up to that capacity.",
                "Interest accrues on the debt continuously at the variable borrow rate.",
                "Repay USDG to unlock collateral; withdraw collateral any time your position stays within limits.",
              ]}
            />

            <h3>A worked example — example only, not a quote</h3>
            <p>
              Suppose you deposit 100 ZEC and the oracle prices ZEC at $50 (an illustrative
              price). Collateral value is $5,000. With the placeholder max LTV of{" "}
              {ZCREDIT_RISK.maxLtvBps / 100}%, you could borrow up to $2,500 — but say you
              borrow $1,500 (30% LTV):
            </p>
            <Formula
              parts={["$5,000 × 70%", "÷", "$1,500", "=", "2.33 health factor"]}
              note="Example only — placeholder parameters, illustrative price"
            />
            <p>
              Your position is liquidatable when the health factor reaches 1.0 — here, when
              collateral value falls to about $2,143, i.e. ZEC at roughly $21.43. The interface
              shows this liquidation price and the health band at all times.
            </p>

            <h3>Liquidations</h3>
            <p>
              If the health factor reaches 1.0, a liquidator can repay part of the debt and
              seize collateral at a{" "}
              {ZCREDIT_RISK.liquidationBonusBps / 100}% discount (the liquidation bonus, which
              is what pays liquidators to keep the market solvent). Liquidation is not a
              penalty edge case to hide — it is the mechanism that protects lenders, and the UI
              treats it as primary information.
            </p>

            <h3>The interest rate model</h3>
            <p>
              Rates are variable and driven by utilization. When most of the supplied USDG is
              borrowed, the borrow rate climbs steeply (above the {ZCREDIT_RISK.interestModel.kinkBps / 100}%
              "kink") to attract new supply and encourage repayment; when utilization is low,
              rates fall. The supply rate is the borrow rate scaled by utilization, minus the
              protocol's {ZCREDIT_RISK.reserveFactorBps / 100}% reserve factor. No rate on this
              site is typed into copy — everything is read from the market.
            </p>
            <DiagramRateCurve />
            <Params
              rows={[
                ["Max LTV", `${ZCREDIT_RISK.maxLtvBps / 100}%`],
                ["Liquidation threshold", `${ZCREDIT_RISK.liquidationThresholdBps / 100}%`],
                ["Liquidation bonus", `${ZCREDIT_RISK.liquidationBonusBps / 100}%`],
                ["Reserve factor", `${ZCREDIT_RISK.reserveFactorBps / 100}%`],
                ["Minimum borrow", `${ZCREDIT_RISK.minBorrow} USDG`],
                ["Minimum collateral", `${ZCREDIT_RISK.minCollateral} ZEC`],
                ["Health bands", HEALTH_BANDS.map((b) => b.label).join(" / ")],
              ]}
            />
            <p className="t-note">
              These displayed beta parameters mirror the deployed market configuration; the
              contract is authoritative and the interface must be synchronized with any onchain
              change. Collateral is valued exclusively by the onchain ZEC/USD oracle; stale,
              zero, or invalid prices halt borrowing.
            </p>
          </section>

          {/* ============================== 06 ZEARN ============================== */}
          <section className="doc" id="zearn">
            <h2>
              <span>06</span>ZEARN — Earning
            </h2>
            <p>
              ZEARN is the lender side of ZCREDIT with everything else removed. You deposit
              USDG; that USDG becomes the liquidity ZCREDIT borrowers draw on; the interest
              they pay flows back to you, minus the protocol reserve. Same market, same
              contracts — ZEARN is presentation, not a second protocol.
            </p>
            <p>
              <strong>Where the yield comes from:</strong> borrower interest, and only borrower
              interest. If ZBNK incentive emissions ever exist, they are displayed as a
              separate line — never folded into the lending APY.
            </p>
            <p>
              <strong>Withdrawals are not guaranteed instant.</strong> Your USDG may be in use
              by borrowers. You can always withdraw up to the pool's available liquidity; a
              larger withdrawal waits until borrowers repay or new lenders supply. The panel
              shows available liquidity at all times, and the rising rates at high utilization
              are the mechanism that replenishes it.
            </p>
          </section>

          {/* ============================== 07 ZLOOP ============================== */}
          <section className="doc" id="zloop">
            <h2>
              <span>07</span>ZLOOP — Leverage
            </h2>
            <p>
              ZLOOP chains the two engines: deposit ZEC as ZCREDIT collateral, borrow USDG, and
              invest that USDG through ZINVEST — one guided flow instead of three manual
              transactions. You keep your ZEC exposure and add a portfolio on top of it. That
              is leverage, and the documentation owes you the uncomfortable version:
            </p>
            <DiagramLoop />
            <ul className="notes">
              <li>Borrowed USDG is debt. It must be repaid regardless of how the portfolio performs.</li>
              <li>Interest accrues on the debt for as long as the position is open.</li>
              <li>Your ZEC collateral can be liquidated if its value falls.</li>
              <li>Investment losses do not reduce the debt owed.</li>
              <li>A ZEC price decline hits you twice: your collateral is worth less and your health factor drops.</li>
            </ul>
            <h3>The same worked example, levered — example only</h3>
            <p>
              Take the ZCREDIT example: 100 ZEC at an illustrative $50, $1,500 borrowed, health
              factor 2.33. You invest the $1,500 in ZTECH. If the portfolio falls 20%, you hold
              $1,200 of Stock Tokens and still owe $1,500 plus accrued interest. If ZEC also
              halves to $25, collateral value is $2,500 and the health factor is:
            </p>
            <Formula
              parts={["$2,500 × 70%", "÷", "$1,500", "=", "1.17 — High risk"]}
              note="Example only — one repay or price move from liquidatable"
            />
            <p>
              This is why ZLOOP shows the entire position — collateral value, LTV after borrow,
              health factor, estimated liquidation price, borrow APY, estimated annual
              interest, fees — before confirmation, and requires an explicit written risk
              acknowledgment before execution is ever enabled.
            </p>
          </section>

          {/* ============================== 08 Economics ============================== */}
          <section className="doc" id="economics">
            <h2>
              <span>08</span>ZBNK economics
            </h2>
            <p>
              ZBNK is designed around two forces. <strong>Accumulate:</strong> a portion of
              protocol revenue buys ZEC for the treasury. <strong>Reduce:</strong> a portion
              buys ZBNK on the market and permanently retires it. The treasury grows while the
              eligible supply shrinks, so the ZEC standing behind each remaining ZBNK rises:
            </p>
            <DiagramEngine />
            <Formula parts={["Redeemable ZEC", "÷", "Eligible ZBNK supply", "=", "ZEC per ZBNK"]} />
            <p>
              Worked through with the standing example (example only): a treasury of 168,500
              ZEC against 100,000,000 eligible ZBNK is 0.001685 ZEC per ZBNK. Retire 10,000,000
              ZBNK and the same treasury divides across 90,000,000 tokens — 0.001872, an 11.1%
              increase with no new ZEC. Grow the treasury to 200,000 ZEC and it reaches
              0.002222. The <Link to="/token">token page</Link> has this as an interactive
              model you can drive yourself.
            </p>
            <p>
              <strong>The pre-audit alpha redemption model</strong> lets eligible ZBNK be
              permanently retired in exchange for its proportional share of the redeemable
              treasury. The implementation exists, but the canonical token wiring, funded
              treasury, and legal structure are not deployed. Nothing on this site implies
              redemption rights currently exist.
            </p>
            <p>
              A second comparison metric follows from the same math:{" "}
              <strong>treasury asset value per ZBNK</strong> (redeemable ZEC × ZEC price ÷
              eligible supply) set against the ZBNK market price, displayed as a premium or
              discount — the way closed-end funds are read.
            </p>
          </section>

          {/* ============================== 09 Treasury ============================== */}
          <section className="doc" id="treasury">
            <h2>
              <span>09</span>Treasury accounting
            </h2>
            <p>
              The treasury is not one number. ZBANK accounts for it in three parts, and the
              distinction is load-bearing:
            </p>
            <Params
              rows={[
                ["Total ZEC treasury", "Everything the protocol holds"],
                ["Redeemable ZEC", "The portion backing the proposed redemption claim"],
                ["Strategic / reserved ZEC", "Held for operations, liquidity, or mission purposes"],
              ]}
            />
            <DiagramTreasurySplit />
            <p>
              Only <strong>redeemable ZEC</strong> enters the backing math. Assuming total =
              redeemable would overstate what each ZBNK can claim, so the frontend types them
              separately and every calculator uses the redeemable figure. The public mission —
              acquiring 1% of Zcash's eventual 21M supply, about 210,000 ZEC (tracked against a
              ~168,500 working target) — is reported on <Link to="/treasury">ZTREASURY</Link>{" "}
              with progress computed from the same state.
            </p>
          </section>

          {/* ============================== 10 Revenue ============================== */}
          <section className="doc" id="revenue">
            <h2>
              <span>10</span>Revenue model
            </h2>
            <p>
              Potential revenue sources: the ZINVEST execution fee, the ZCREDIT reserve factor
              (the spread between borrow and supply interest), the ZLOOP execution fee, and
              routing fees if ZSWAP charges them. All of it converges on one allocation:
            </p>
            <Params
              rows={[
                ["ZEC treasury acquisition", `${REVENUE_ALLOCATION.treasuryBps / 100}%`],
                ["ZBNK buyback + retirement", `${REVENUE_ALLOCATION.burnBps / 100}%`],
                ["Protocol reserve / operations", `${REVENUE_ALLOCATION.reserveBps / 100}%`],
              ]}
            />
            <p className="t-note">
              Placeholder split, validated in config to sum to exactly 100%. Final percentages
              are not confirmed and will be published with the treasury contracts.
            </p>
          </section>

          {/* ============================== 11 Status ============================== */}
          <section className="doc" id="status">
            <h2>
              <span>11</span>Launch status &amp; security
            </h2>
            <p>
              ZINVEST and ZINDEX are <strong>live</strong>: execution runs entirely through
              Uniswap v3's audited public contracts on Robinhood Chain. ZCREDIT, ZEARN, and
              ZLOOP run in <strong>open beta</strong>: the lending market and ZEC/USD oracle
              are deployed on mainnet, but the market contract is ZBANK-authored and unaudited,
              administration uses a disclosed temporary 1-of-1 Safe, and collateral is capped
              onchain. Independent Safe signers and an external audit remain production-readiness
              gates; public use before then is explicitly opt-in pre-audit beta. A
              status changes only when the wiring underneath changes — it is a deliberate
              config change, not a copy edit.
            </p>
            <Params
              rows={[
                ["ZINVEST / ZINDEX execution", "Live — Uniswap v3 SwapRouter02 + QuoterV2 (audited public infra)"],
                ["ZCREDIT lending market", "Deployed on mainnet — open beta, unaudited, collateral capped"],
                ["ZEC/USD oracle", "Deployed — Chainlink Data Streams, verified onchain, keeper-relayed"],
                ["Treasury + redemption", "Pre-audit alpha built — deploys after canonical Pons ZBNK launch"],
                ["ZBNK token", "Not launched"],
                ["Audits", "None yet — and none claimed; beta products say so where deposits happen"],
              ]}
            />
            <p>
              The full launch-readiness register — unresolved contract risks, oracle handling
              requirements, liquidation assumptions, admin-permission policy, and the parameter
              decisions required before mainnet — lives in <code>SECURITY.md</code> at the
              repository root, with the economic model detailed in <code>docs/tokenomics.md</code>.
            </p>
          </section>

          {/* ============================== 12 Agents ============================== */}
          <section className="doc" id="agents">
            <h2>
              <span>12</span>APIs for agents
            </h2>
            <p>
              Agents should never scrape display copy or guess a missing value. ZBANK exposes
              a versioned, read-only interface with permissive CORS and explicit units.
              Transaction execution remains wallet-controlled and requires user confirmation.
            </p>
            <div className="docs-api-grid">
              <a href="/api/v1/protocol">
                <span>GET</span>
                <code>/api/v1/protocol</code>
                <p>Canonical contracts, assets, product status, risk parameters, and strategies.</p>
              </a>
              <a href="/api/v1/market">
                <span>GET</span>
                <code>/api/v1/market</code>
                <p>Cached live oracle and lending-market telemetry from Robinhood Chain.</p>
              </a>
              <a href="/.well-known/agent.json">
                <span>DISCOVER</span>
                <code>/.well-known/agent.json</code>
                <p>Capability and endpoint discovery for automated clients.</p>
              </a>
              <a href="/llms.txt">
                <span>CONTEXT</span>
                <code>/llms.txt</code>
                <p>Concise protocol context and safety rules for language models.</p>
              </a>
            </div>
            <ul className="notes">
              <li>API version 1 is additive: existing fields will not silently change meaning.</li>
              <li>Amounts are returned as decimal strings to avoid floating-point loss.</li>
              <li>Null means unavailable. It never means zero.</li>
              <li>Beta, proposed, and pending-launch states must remain visible in agent output.</li>
            </ul>
          </section>

          {/* ============================== 13 FAQ ============================== */}
          <section className="doc" id="faq">
            <h2>
              <span>13</span>FAQ
            </h2>
            <dl className="docfaq">
              <dt>Why would I use ZCREDIT instead of just selling ZEC?</dt>
              <dd>
                Selling ends your ZEC exposure and can be a taxable event. Borrowing keeps the
                ZEC (and its upside and downside) while giving you dollars to deploy — at the
                cost of interest and liquidation risk. Neither is universally better; ZCREDIT
                exists so it's your choice.
              </dd>
              <dt>Where does the ZEARN yield actually come from?</dt>
              <dd>
                From borrowers. There is no other source. If nobody borrows, the supply rate is
                near zero — which is exactly what the utilization-based model will show.
              </dd>
              <dt>Can I lose money in ZEARN?</dt>
              <dd>
                Lending is not risk-free: smart-contract failure, bad debt from failed
                liquidations during extreme moves, and oracle failure are real risks. What
                ZEARN does not have is ZEC price exposure — your position is denominated in
                USDG.
              </dd>
              <dt>Is ZBNK backed by the treasury?</dt>
              <dd>
                Precisely: under the proposed redemption model, eligible ZBNK would carry a
                proportional redemption claim on the redeemable ZEC treasury. That model is
                proposed, not deployed — so today the honest answer is "designed to be, not
                yet."
              </dd>
              <dt>What is live today?</dt>
              <dd>
                ZINVEST and ZINDEX execute through Uniswap v3. The ZEC/USD oracle is live and
                ZCREDIT, ZEARN, and ZLOOP are open beta because the ZBANK-authored lending
                contract remains unaudited. ZBNK and treasury redemption are not launched.
              </dd>
              <dt>Is ZSWAP a privacy product?</dt>
              <dd>
                No. ZSWAP is internal routing infrastructure (ZEC ↔ USDG ↔ Stock Tokens). It is
                not marketed as private or shielded swapping, and ZBANK makes no privacy claims
                about routed transactions.
              </dd>
            </dl>
          </section>

          <section className="doc" id="disclaimer">
            <p className="t-note">
              {MODEL_DISCLAIMER} Digital assets are volatile and positions can be liquidated.
              Nothing on this site is an offer, a solicitation, or investment, legal, or tax
              advice.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
