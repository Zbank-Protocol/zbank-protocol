import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Equation } from "../components/Equation";
import {
  DiagramCreditMarket,
  DiagramEngine,
  DiagramInvestRoute,
  DiagramLoop,
  DiagramRateCurve,
  DiagramTreasurySplit,
} from "../components/docs/Diagrams";

/**
 * /start — the guided tour. Seven chapters that take a newcomer from "what is this" to
 * opening the app: the goal first, then each mechanism with the same diagram the docs use,
 * three takeaways per chapter, honest status last. Arrow keys work; progress is visible;
 * every chapter links to the product it explains.
 */

type Chapter = {
  kicker: string;
  title: string[];
  copy: string;
  visual: ReactNode;
  facts: [string, string][];
  link?: { label: string; to: string };
};

const CHAPTERS: Chapter[] = [
  {
    kicker: "The goal",
    title: ["Zcash was built to be money.", "We\u2019re building its bank."],
    copy:
      "Zcash holders have money with nowhere to work. ZBANK is the missing bank: invest ZEC into market portfolios, borrow dollars against it, earn interest by lending — while the protocol itself pursues one public mission: accumulate 1% of all Zcash into a transparent treasury, and shrink the ZBNK supply against it.",
    visual: (
      <div className="tour__equation">
        <Equation />
      </div>
    ),
    facts: [
      ["The mission", "Buy 1% of Zcash"],
      ["The mechanism", "Revenue → ZEC treasury + ZBNK burns"],
      ["The result", "More ZEC standing behind each ZBNK"],
    ],
    link: { label: "See the treasury", to: "/treasury" },
  },
  {
    kicker: "Invest · ZINVEST",
    title: ["One balance.", "An entire market."],
    copy:
      "Fund with USDG and pick a set of Stock Tokens — your own weights, or a prebuilt ZINDEX strategy like ZTECH or Z500. Every leg is quoted live through Uniswap v3 — estimated received, slippage guard per leg — then the whole basket executes in one atomic multicall. Holding ZEC instead of dollars? ZLOOP lets you invest without selling it.",
    visual: <DiagramInvestRoute />,
    facts: [
      ["Input", "USDG"],
      ["Output", "A weighted Stock Token basket"],
      ["Promise", "Full live quote before execution — no surprises"],
    ],
    link: { label: "Open ZINVEST", to: "/invest" },
  },
  {
    kicker: "Borrow · ZCREDIT",
    title: ["Keep your ZEC.", "Access USDG."],
    copy:
      "Deposit ZEC as collateral and borrow USDG against it — the oracle values your collateral, your borrowing power is a fraction of that value, and a four-band health meter keeps liquidation risk in front of you at all times. Selling ends your ZEC exposure; borrowing keeps it, at the price of interest and risk.",
    visual: <DiagramCreditMarket />,
    facts: [
      ["Collateral", "ZEC, valued only by the onchain oracle"],
      ["You receive", "USDG from lender liquidity"],
      ["The risk", "Fall below the threshold and you can be liquidated"],
    ],
    link: { label: "Open ZCREDIT", to: "/credit" },
  },
  {
    kicker: "Earn · ZEARN",
    title: ["Put USDG to work.", "Choose the borrower."],
    copy:
      "Choose the ZEC Credit Market to fund ZEC-backed borrowers inside ZBANK, or Diversified USDG to deposit directly into Steakhouse's live Morpho V2 vault. Both rates are variable; the interface keeps their sources, contracts, liquidity, and risks separate.",
    visual: <DiagramRateCurve />,
    facts: [
      ["ZEC lane", "Interest from ZEC-backed ZCREDIT borrowers"],
      ["Diversified lane", "Independent Steakhouse USDG vault on Morpho"],
      ["Custody", "Your lending claim or vault shares stay in your wallet"],
    ],
    link: { label: "Open ZEARN", to: "/earn" },
  },
  {
    kicker: "Loop · ZLOOP",
    title: ["Keep your ZEC.", "Invest anyway."],
    copy:
      "The composition: deposit ZEC, borrow USDG, invest the USDG through ZINVEST — one guided flow. Your ZEC keeps its upside while borrowed dollars buy the portfolio. It is leverage, and the interface says so plainly: the debt is real, interest accrues, and your collateral can be liquidated.",
    visual: <DiagramLoop />,
    facts: [
      ["What you keep", "Your ZEC exposure"],
      ["What you add", "A portfolio bought with borrowed USDG"],
      ["What it costs", "Interest, fees, and liquidation risk"],
    ],
    link: { label: "Open ZLOOP", to: "/credit/loop" },
  },
  {
    kicker: "The engine",
    title: ["Every product feeds", "the same machine."],
    copy:
      "Borrower interest reserves and future ZBNK trading fees form protocol revenue; current ZINVEST and ZLOOP routes do not charge ZBANK fees. Revenue is intended to buy ZEC and permanently retire ZBNK. Pons USDG creator fees add another loop: a replaceable manager funds the shared zZEC/USDG market and treasury allocation. Only the redeemable treasury slice backs redemption, and ZTREASURY reports it in public.",
    visual: (
      <div className="tour__stack">
        <DiagramEngine />
        <DiagramTreasurySplit />
      </div>
    ),
    facts: [
      ["Accumulate", "Revenue buys ZEC for the treasury"],
      ["Reduce", "Revenue buys ZBNK and retires it"],
      ["Deepen", "ZBNK fees fund zZEC / USDG liquidity"],
      ["Verify", "Watch it live on ZTREASURY"],
    ],
    link: { label: "Watch the machine", to: "/treasury" },
  },
  {
    kicker: "Where things stand",
    title: ["The public beta is live.", "The token stack is built."],
    copy:
      "Investing executes today through Uniswap v3 against verified Stock Token liquidity — no ZBANK contract custodies funds on that path. Lending is deployed as an explicitly pre-audit mainnet beta: borrowing halts whenever signed oracle reports are not fresh. Treasury and dual-path redemption are implemented as pre-audit alpha contracts and deploy after the canonical Pons ZBNK address exists. Nothing here fakes a transaction or invents a number.",
    visual: (
      <div className="tour__status">
        {[
          ["ZINVEST · ZINDEX", "Live — Uniswap v3 execution"],
          ["ZCREDIT · ZEC ZEARN", "Beta — market + oracle deployed"],
          ["ZEARN · MORPHO", "Live — direct third-party vault shares"],
          ["ZLOOP", "Beta — composed execution path"],
          ["ZTREASURY", "Live dashboard — token metrics pending"],
          ["ZLIQUIDITY", "Bootstrap UI built — LP NFTs stay user-owned"],
          ["TREASURY · REDEMPTION", "Alpha built — awaiting Pons ZBNK"],
          ["ZBNK", "Token launch pending"],
        ].map(([k, v]) => (
          <div className="txpreview__row" key={k}>
            <span className="txpreview__label">{k}</span>
            <span className="txpreview__value">{v}</span>
          </div>
        ))}
      </div>
    ),
    facts: [
      ["Honesty rule", "No fake transactions, no invented numbers"],
      ["Read more", "The docs cover every mechanism in depth"],
      ["Next", "Open the app and look around"],
    ],
    link: { label: "Open ZBANK", to: "/app" },
  },
];

export default function Start() {
  const [step, setStep] = useState(0);
  const chapter = CHAPTERS[step];
  const last = CHAPTERS.length - 1;

  // One visit satisfies the first-visit gate — nobody is ever redirected here twice.
  useEffect(() => {
    try {
      localStorage.setItem("zbank.toured.v1", "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  const go = useCallback(
    (dir: 1 | -1) => setStep((s) => Math.min(last, Math.max(0, s + dir))),
    [last],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  return (
    <main className="page tour">
      <div className="container">
        {/* Progress rail, with the exit always visible. */}
        <div className="tour__railrow">
          <div className="tour__rail" role="tablist" aria-label="Tutorial chapters">
            {CHAPTERS.map((c, i) => (
              <button
                key={c.kicker}
                role="tab"
                aria-selected={i === step}
                className="tour__dot"
                data-state={i === step ? "active" : i < step ? "done" : "todo"}
                onClick={() => setStep(i)}
              >
                <span className="tour__dot-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="tour__dot-label">{c.kicker}</span>
              </button>
            ))}
          </div>
          <Link className="tour__skip" to="/">
            Skip tour →
          </Link>
        </div>

        {/* The chapter. `key` remounts so the entrance plays per step. */}
        <section className="tour__chapter" key={step} aria-live="polite">
          <div className="tour__copy">
            <span className="page-head__kicker">{chapter.kicker}</span>
            <h1 className="tour__title">
              {chapter.title.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </h1>
            <p className="tour__lede">{chapter.copy}</p>

            <div className="tour__facts">
              {chapter.facts.map(([label, value]) => (
                <div className="tour__fact" key={label}>
                  <span className="metric__label">{label}</span>
                  <span className="tour__fact-v">{value}</span>
                </div>
              ))}
            </div>

            {chapter.link ? (
              <Link className="btn btn--line" to={chapter.link.to}>
                {chapter.link.label}
              </Link>
            ) : null}
          </div>

          <div className="tour__visual">{chapter.visual}</div>
        </section>

        {/* Navigation. */}
        <div className="tour__nav">
          <button className="btn btn--line" onClick={() => go(-1)} disabled={step === 0}>
            ← Back
          </button>
          <span className="tour__count">
            {String(step + 1).padStart(2, "0")} / {String(CHAPTERS.length).padStart(2, "0")}
          </span>
          {step === last ? (
            <Link className="btn btn--gold" to="/app">
              Open ZBANK
            </Link>
          ) : (
            <button className="btn btn--gold" onClick={() => go(1)}>
              Next →
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
