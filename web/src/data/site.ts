/**
 * All site content and every pre-launch placeholder, in one file.
 *
 * ================================== DATA POLICY ==================================
 * No fabricated figures. Anything not yet real and onchain renders "—" or "Pending launch".
 * The only numeric values allowed here are real deployed facts, stated targets (the 1%
 * mission), and clearly-labelled worked examples (EXAMPLE_MODEL / REDEMPTION) that teach the
 * proposed math. When token-launch data goes live, replace constants with reads from
 * `lib/chain.ts` — components consume this file only.
 * ==================================================================================
 */

import { PRODUCT_STATUS } from "../config/protocol";
import type { TokenState, TreasuryState } from "../lib/economics";

/** Status vocabulary for anything that is not yet a live product. */
export type ProductStatus = "Live" | "Coming soon" | "Planned" | "Research";

/* --------------------------- The economic model --------------------------- */

/**
 * Live protocol state. Pre-token-launch, everything is honestly null.
 *
 * The redeemable/strategic split is deliberately null until treasury accounting is defined
 * onchain: assuming total = redeemable would overstate the proposed backing.
 */
export const TREASURY_STATE: TreasuryState = {
  // The treasury funds at token launch. Until a real onchain balance exists, no number does.
  totalZec: null,
  redeemableZec: null,
  strategicZec: null,
  currentZecPrice: null,
};

export const TOKEN_STATE: TokenState = {
  totalSupply: null,
  circulatingSupply: null,
  eligibleSupply: null,
  burnedSupply: null,
  currentPrice: null,
};

/** DEMO — ~1% of circulating ZEC at pre-launch estimates. The mission denominator. */
export const MISSION_TARGET_ZEC = 168_500;

/**
 * EXAMPLE ONLY — the worked example used by the calculator, the redemption mock, and the docs.
 * These are teaching numbers from the tokenomics spec, never presented as live protocol data.
 */
export const EXAMPLE_MODEL = {
  redeemableZec: 168_500,
  eligibleSupply: 100_000_000,
  scenario: {
    burned: 10_000_000,
    grownTreasuryZec: 200_000,
  },
} as const;

/** The visual motif. Rendered by <Equation />; keep the wording identical everywhere. */
export const EQUATION = ["More ZEC", "÷", "Fewer ZBNK", "=", "More ZEC per ZBNK"] as const;

/** The one-line disclaimer that must appear wherever the proposed model is described. */
export const MODEL_DISCLAIMER =
  "The redemption model, revenue allocation, and token utility remain subject to final " +
  "technical, legal, and governance implementation.";

/* ------------------------------- 01 · Hero ------------------------------- */

export const HERO = {
  headline: ["Zcash was built to be money.", "We\u2019re building its bank."],
  support: "Capital markets for Zcash.",
  copy:
    "Put market exposure behind your ZEC without selling it. Borrow USDG against it. Or fund " +
    "the loans ZEC holders draw, and earn the interest they pay.",
  primaryCta: { label: "Open ZBANK", href: "/app" },
  secondaryCta: { label: "View Treasury", href: "/treasury" },
} as const;

/**
 * "What can your ZEC do" — the three moves, directly under the hero. Every action is framed
 * from the ZEC holder's seat: even Earn, whose supplier funds the loans ZEC holders draw.
 */
export const ACTIONS = [
  {
    name: "Invest",
    copy: "Market exposure. ZEC stays yours.",
    detail:
      "Borrow USDG against your ZEC through ZLOOP and route it into Stock Token portfolios — " +
      "or invest USDG directly through ZINVEST.",
    to: "/credit/loop",
  },
  {
    name: "Borrow",
    copy: "Your ZEC has borrowing power.",
    detail: "Draw USDG against ZEC collateral, liquidation risk always on screen.",
    to: "/credit",
  },
  {
    name: "Earn",
    copy: "Fund the loans ZEC holders draw.",
    detail: "Supply USDG and earn the variable interest ZEC borrowers pay, minus the reserve.",
    to: "/earn",
  },
] as const;

/** The ZLOOP feature block. */
export const ZLOOP_FEATURE = {
  headline: ["Keep your ZEC.", "Invest anyway."],
  copy:
    "ZLOOP composes ZCREDIT and ZINVEST: deposit ZEC as collateral, borrow USDG, and invest " +
    "the borrowed liquidity into a portfolio — one guided flow, the entire position visible " +
    "before you confirm.",
  risk:
    "A leveraged position: borrowed USDG is debt, interest accrues, and ZEC collateral can be " +
    "liquidated. Investment losses do not reduce the debt owed.",
  cta: { label: "Open ZLOOP", to: "/credit/loop" },
} as const;

/*
 * The institutional strip under the hero is now <LiveStrip /> — live reads from the deployed
 * credit market and oracle, not a row of pre-launch dashes. See components/LiveStrip.tsx.
 */

/** The thesis, stated under the strip. The two forces in four words. */
export const HERO_THESIS = {
  lines: ["More ZEC.", "Fewer ZBNK."],
  support: "Every ZBANK product is designed to strengthen the same economic system.",
} as const;

/** The hero visual panel — real, verifiable protocol facts. No invented balances. */
export const HERO_ACCOUNT = {
  title: "ZBANK Protocol",
  badge: "Onchain",
  rows: [
    { label: "Network", value: "Robinhood Chain" },
    { label: "Credit market", value: "Live" },
    { label: "Execution", value: "Uniswap v3" },
    { label: "ZEC/USD oracle", value: "Chainlink" },
  ],
} as const;

/* ------------------------------ 02 · Mission ------------------------------ */

/** Mission tracker. Owned/progress stay "—" until the treasury holds real onchain ZEC. */
export const MISSION = {
  headline: ["1% isn\u2019t a slogan.", "It\u2019s the target."],
  copy:
    "We\u2019re buying 1% of Zcash. ZBANK products generate protocol revenue; a defined portion " +
    "acquires ZEC for the treasury, and a defined portion — under the proposed model — buys " +
    "ZBNK from the market for permanent burn or retirement.",
  owned: "—",
  target: "~168,500 ZEC",
  progressPct: 0,
  remaining: "~168,500 ZEC",
  footnote: "Every product feeds the treasury.",
  why: {
    q: "Why does it matter?",
    copy:
      "As the treasury accumulates ZEC, treasury assets per eligible ZBNK increase, all else " +
      "equal. Buybacks can simultaneously reduce the number of ZBNK sharing the treasury.",
  },
} as const;

/* ------------------------------ 03 · Treasury ------------------------------ */

export const TREASURY = {
  headline: "A treasury that only has one direction.",
  copy:
    "Protocol revenue is used to accumulate ZEC. The treasury is transparent, measurable, " +
    "and designed around long-term Zcash ownership.",
  /* Never claim "never sells" — policy language only, until enforced in contract code. */
  policy: "ZBANK\u2019s treasury strategy prioritizes accumulation over distribution.",
  /** The accounting rule the whole site follows. */
  accountingNote:
    "Treasury accounting will separate redeemable from strategic ZEC at launch. All backing " +
    "and redemption math uses redeemable ZEC only — total treasury is a mission figure, not a " +
    "backing figure.",
  /** Real address lands here at launch; components render "Pending launch" while null. */
  address: null as string | null,
} as const;

/* ------------------------------ 04 · Products ------------------------------ */

export type Product = {
  name: string;
  tagline: string;
  copy: string;
  /** Launch status comes from config/protocol.ts PRODUCT_STATUS — one source of truth. */
  status: string;
  /** Route of the product's application page. */
  href?: string;
};

/**
 * The launch suite. Six products, three shared engines: ZINDEX is ZINVEST's strategy layer,
 * ZEARN is ZCREDIT's lender side, ZLOOP composes both. Statuses are read from
 * config/protocol.ts by the components that render these.
 */
export const PRODUCTS: Product[] = [
  {
    name: "ZINVEST",
    tagline: "One balance. An entire market.",
    copy:
      "The invest leg of the bank: USDG — yours, or borrowed against ZEC — into Stock Token " +
      "portfolios through Uniswap v3.",
    status: PRODUCT_STATUS.zinvest,
    href: "/invest",
  },
  {
    name: "ZINDEX",
    tagline: "One click. An entire market strategy.",
    copy: "Target-allocation strategies — ZTECH, ZAI, Z500, ZYLD, ZMAG — executed through ZINVEST.",
    status: PRODUCT_STATUS.zindex,
    href: "/invest/indexes",
  },
  {
    name: "ZCREDIT",
    tagline: "Keep your ZEC. Access USDG.",
    copy: "Borrow USDG against ZEC collateral, or supply USDG and earn borrower interest.",
    status: PRODUCT_STATUS.zcredit,
    href: "/credit",
  },
  {
    name: "ZEARN",
    tagline: "Fund the Zcash side of the market.",
    copy: "Supply the USDG that ZEC holders borrow; earn the variable interest they pay.",
    status: PRODUCT_STATUS.zearn,
    href: "/earn",
  },
  {
    name: "ZLOOP",
    tagline: "Keep your ZEC. Invest anyway.",
    copy: "Borrow against ZEC and invest the borrowed USDG through ZINVEST in one guided flow.",
    status: PRODUCT_STATUS.zloop,
    href: "/credit/loop",
  },
  {
    name: "ZTREASURY",
    tagline: "Watch the machine work.",
    copy: "The live protocol dashboard: treasury, retirements, supply, and the ZEC-per-ZBNK ratio.",
    status: PRODUCT_STATUS.ztreasury,
    href: "/treasury",
  },
];

/** Beyond launch — kept honest, kept off the main grid. */
export const LATER_PRODUCTS = ["ZVAULT", "ZLAUNCH", "ZPAY"] as const;

/* ------------------------------ 05 · Flywheel ------------------------------ */

export const FLYWHEEL = {
  headline: "Every product feeds the same machine.",
  products: ["ZINVEST", "ZINDEX", "ZCREDIT", "ZVAULT", "ZLAUNCH", "ZPAY"],
  hub: "ZBANK Revenue",
  branches: [
    {
      title: "Buy ZEC",
      steps: ["ZEC enters the treasury", "Treasury \u2191"],
      note: "Core treasury policy",
    },
    {
      title: "Buy ZBNK",
      steps: ["Permanent retirement", "Eligible supply \u2193"],
      note: "Proposed allocation",
    },
  ],
  /** Where the two branches converge, and the loop after it. */
  converge: ["ZEC per ZBNK \u2191", "Stronger ZBANK ecosystem", "More product usage"],
  convergeNote: "The loop repeats. No token price outcome is promised or guaranteed.",
} as const;

/* --------------------------- 11 · The Token --------------------------- */

export const TOKENOMICS = {
  headline: ["Two forces.", "One token."],
  lede: "ZBANK is designed around two forces: accumulating ZEC and reducing ZBNK supply.",
  detail:
    "Protocol revenue can acquire ZEC for the treasury and buy ZBNK for permanent retirement. Under " +
    "the proposed redemption model, eligible ZBNK can be redeemed against its proportional " +
    "share of the redeemable ZEC treasury.",
  forces: [
    {
      no: "01",
      name: "Accumulate",
      steps: [
        "ZBANK products generate revenue.",
        "A portion of protocol revenue acquires ZEC.",
        "ZEC enters the treasury.",
      ],
      result: "Treasury \u2191",
    },
    {
      no: "02",
      name: "Reduce",
      steps: [
        "A portion of protocol revenue buys ZBNK.",
        "Purchased ZBNK is permanently retired.",
        "Retired ZBNK leaves eligible supply forever.",
      ],
      result: "Supply \u2193",
    },
  ],
  result: { label: "Result", value: "ZEC per ZBNK \u2191" },
} as const;

/**
 * The live/proposed register. Nothing on this list is live pre-launch; the register exists so
 * the distinction is structural, not editorial, when things do go live.
 */
export type TokenFactStatus = "Live" | "Alpha built" | "Proposed" | "Pending launch";

export const TOKEN_FACTS: { label: string; status: TokenFactStatus }[] = [
  { label: "ZBNK token contract", status: "Pending launch" },
  { label: "Protocol-funded ZEC acquisition", status: "Proposed" },
  { label: "Protocol-funded ZBNK buyback and retirement", status: "Alpha built" },
  { label: "Direct zZEC + native ZEC redemption paths", status: "Alpha built" },
  { label: "Redeemable vs. strategic treasury accounting", status: "Alpha built" },
  { label: "Governance", status: "Proposed" },
];

/**
 * EXAMPLE ONLY — the redemption interface concept. Values are the worked example from the
 * model spec (168,500 redeemable ZEC / 100M eligible ZBNK), never live data. The alpha
 * redemption contract is implemented but not deployed; no redemption rights currently exist.
 */
export const REDEMPTION = {
  badge: "Pre-audit alpha · not deployed",
  burnLabel: "You permanently retire",
  burn: "100,000 ZBNK",
  rateLabel: "Current treasury rate",
  rate: "0.001685 ZEC / ZBNK",
  receiveLabel: "You receive",
  receive: "168.50 ZEC",
  burnedLabel: "ZBNK retired",
  burned: "100,000",
  tooltip:
    "The alpha contract permanently locks redeemed Pons ZBNK outside eligible supply. It can " +
    "transfer zZEC atomically or reserve zZEC for an operator-settled native ZEC claim to a " +
    "registered t-address.",
  note:
    "Example values only. The pre-audit alpha contract is implemented but not deployed; no redemption rights currently exist.",
} as const;

/* ------------------------------ 11 · Roadmap ------------------------------ */

export type RoadmapPhase = {
  phase: string;
  name: string;
  copy: string;
  status: "Shipped" | "Active" | "Next" | "Long-term";
  items: readonly string[];
  mission?: boolean;
};

export const ROADMAP: RoadmapPhase[] = [
  {
    phase: "Foundation",
    name: "The bank is onchain",
    copy: "The public product surface and core execution infrastructure are deployed.",
    status: "Shipped",
    items: ["ZINVEST + ZINDEX execution", "ZEC/USD oracle", "ZCREDIT beta", "Safe administration"],
  },
  {
    phase: "Interface",
    name: "Built for people and agents",
    copy: "One system, documented for humans and exposed as structured data for software.",
    status: "Shipped",
    items: ["Visual product guide", "Protocol manifest API", "Live market API", "Agent discovery"],
  },
  {
    phase: "Hardening",
    name: "Make beta resilient",
    copy: "Strengthen the live credit path before describing it as production infrastructure.",
    status: "Active",
    items: ["External audit", "Redundant keepers", "Oracle alerts", "Mainnet lifecycle verification"],
  },
  {
    phase: "Token",
    name: "Launch ZBNK + treasury",
    copy: "Publish the token, treasury contracts, addresses, and real onchain accounting together.",
    status: "Next",
    items: ["Pons launch", "Treasury deployment", "Revenue allocation", "Burn reporting"],
  },
  {
    phase: "Scale",
    name: "Open the operating envelope",
    copy: "Expand only after reliability, liquidity, and user-load evidence supports it.",
    status: "Next",
    items: ["RPC caching", "200–500 user tests", "Incident runbooks", "Measured cap reviews"],
  },
  {
    phase: "Mission",
    name: "1% of Zcash",
    copy: "Build toward transparent ownership of 1% of circulating ZEC through protocol revenue.",
    status: "Long-term",
    items: ["Acquire ZEC", "Publish reserves", "Track redeemable vs. strategic ZEC", "Report every retirement"],
    mission: true,
  },
];

/* ------------------------- 12 · Protocol / Transparency ------------------------- */

export type ProtocolItem = {
  label: string;
  /** null renders as pending — never a fake address. */
  value: string | null;
  href?: string;
  /** What a null value is actually waiting on. Defaults to "Pending launch". */
  pendingLabel?: string;
};

const EXPLORER = "https://robinhoodchain.blockscout.com/address/";
/**
 * Live rows carry real, verifiable values — the deployed addresses, the public source, the
 * accruing revenue. Rows gated on the ZBNK token launch (the treasury contract requires the
 * token at construction) say so precisely instead of a vague "pending".
 */
export const PROTOCOL_ITEMS: ProtocolItem[] = [
  {
    label: "ZCREDIT Market",
    value: "0x77cc…151e · Live",
    href: `${EXPLORER}0x77ccb77d1fd337b7027b3482ca365db57d92151e`,
  },
  {
    label: "ZEC/USD Oracle",
    value: "0x931F…3AF5 · Chainlink Data Streams",
    href: `${EXPLORER}0x931F6295bf6aB9Dc02997a03b4ba85Aca9373AF5`,
  },
  {
    label: "Contract Source",
    value: "GitHub · Sourcify exact match",
    href: "https://github.com/Zbank-Protocol/contracts",
  },
  {
    label: "Protocol Revenue",
    value: "Accruing — 10% reserve factor on borrower interest",
    href: `${EXPLORER}0x77ccb77d1fd337b7027b3482ca365db57d92151e`,
  },
  {
    label: "Revenue Allocation",
    value: "50% ZEC treasury · 30% ZBNK retirement · 20% reserve — proposed",
  },
  {
    label: "Token-Fee Liquidity",
    value:
      "50% of Pons USDG creator fees fund zZEC / USDG · 50% enters treasury allocation — alpha built",
  },
  {
    label: "Fee Liquidity Manager",
    value: "0x082B87D21A5F840De52F2c154aC4132E3C365295 — deployed pre-audit alpha",
  },
  {
    label: "Permanent Pons Fee Router",
    value: null,
    pendingLabel: "Built and tested — deploy before ZBNK launch",
  },
  {
    label: "Audit Status",
    value: "Unaudited — external audit pending",
    href: "https://github.com/Zbank-Protocol/contracts/blob/main/SECURITY.md",
  },
  {
    label: "Token-Launch Registry",
    value: null,
    pendingLabel:
      "ZBNK contract, treasury addresses, eligible supply, and retirement data publish here at " +
      "token launch",
  },
];

export const INDEPENDENCE_NOTICE =
  "Robinhood Chain is a permissionless network. ZBANK is an independent project and is not " +
  "issued, sponsored, endorsed, or operated by Robinhood.";

/* ------------------------------ 13 · Footer ------------------------------ */

export const RISKS = [
  "Crypto assets are volatile. Treasury value can decline.",
  "The redemption model, revenue allocation, and token utility remain subject to final technical, legal, and governance implementation.",
  "No redemption rights currently exist. Nothing on this page is a guarantee of backing or returns.",
  "Stock Tokens may be restricted by jurisdiction.",
  "Lending products carry liquidation and smart contract risk.",
  "Planned products may change or may not launch.",
  "This website is not investment advice.",
  "ZBANK is not affiliated with Robinhood or the Zcash Foundation unless explicitly stated.",
];
