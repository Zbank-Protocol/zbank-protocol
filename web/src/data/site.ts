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
    "Invest ZEC into market portfolios. Borrow USDG against ZEC. Supply USDG and earn " +
    "borrower interest.",
  primaryCta: { label: "Open ZBANK", href: "/app" },
  secondaryCta: { label: "View Treasury", href: "/treasury" },
} as const;

/** The three fundamental actions, directly under the hero. Everything else composes these. */
export const ACTIONS = [
  {
    name: "Invest",
    copy: "Turn ZEC into a portfolio.",
    detail: "Custom allocations or prebuilt ZINDEX strategies, funded with ZEC.",
    to: "/invest",
  },
  {
    name: "Borrow",
    copy: "Keep your ZEC and access USDG.",
    detail: "ZEC-collateralized credit with liquidation risk always on screen.",
    to: "/credit",
  },
  {
    name: "Earn",
    copy: "Supply USDG to borrowers.",
    detail: "Variable interest paid by ZCREDIT borrowers, minus the protocol reserve.",
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

/** The institutional strip under the hero. "—" until each figure is real and onchain. */
export const HERO_METRICS = [
  { label: "ZEC Treasury", value: "—", unit: "" },
  { label: "ZBNK Supply", value: "—", unit: "" },
  { label: "ZEC / ZBNK", value: "—", unit: "" },
  { label: "ZBNK Burned", value: "—", unit: "" },
  { label: "1% Mission", value: "—", unit: "" },
] as const;

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
    "ZBNK from the market for permanent burn.",
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
  /** Dashboard cells. "—" everywhere until the treasury address holds real ZEC. */
  stats: [
    { label: "Total ZEC treasury", value: "—", unit: "" },
    { label: "Redeemable ZEC", value: "—", unit: "" },
    { label: "Strategic / reserved ZEC", value: "—", unit: "" },
    { label: "Estimated value", value: "$—", unit: "" },
    { label: "Acquired all-time", value: "—", unit: "" },
    { label: "1% mission completed", value: "—", unit: "" },
  ],
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
    copy: "Invest USDG into Stock Token portfolios, executed atomically through Uniswap v3.",
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
    tagline: "Put your dollars to work.",
    copy: "The simple face of ZCREDIT lending: deposit USDG, earn the variable borrower rate.",
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
    copy: "The live protocol dashboard: treasury, burns, supply, and the ZEC-per-ZBNK ratio.",
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
      steps: ["Permanent burn", "Supply \u2193"],
      /* Not implemented in contracts — labelled as proposed, never as a promise. */
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
    "Protocol revenue can acquire ZEC for the treasury and buy ZBNK for permanent burn. Under " +
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
        "Purchased ZBNK is permanently burned.",
        "Burned ZBNK leaves eligible supply forever.",
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
export type TokenFactStatus = "Live" | "Proposed" | "Pending launch";

export const TOKEN_FACTS: { label: string; status: TokenFactStatus }[] = [
  { label: "ZBNK token contract", status: "Pending launch" },
  { label: "Protocol-funded ZEC acquisition", status: "Proposed" },
  { label: "Protocol-funded ZBNK buyback and burn", status: "Proposed" },
  { label: "Pro-rata redemption against redeemable treasury ZEC", status: "Proposed" },
  { label: "Redeemable vs. strategic treasury accounting", status: "Proposed" },
  { label: "Governance", status: "Proposed" },
];

/**
 * EXAMPLE ONLY — the redemption interface concept. Values are the worked example from the
 * model spec (168,500 redeemable ZEC / 100M eligible ZBNK), never live data. No redemption
 * contract exists; no redemption rights currently exist.
 */
export const REDEMPTION = {
  badge: "Proposed redemption model",
  burnLabel: "You burn",
  burn: "100,000 ZBNK",
  rateLabel: "Current treasury rate",
  rate: "0.001685 ZEC / ZBNK",
  receiveLabel: "You receive",
  receive: "168.50 ZEC",
  burnedLabel: "ZBNK burned",
  burned: "100,000",
  tooltip:
    "Redemption would permanently remove redeemed ZBNK from eligible supply and transfer the " +
    "corresponding amount of redeemable treasury ZEC according to the protocol\u2019s " +
    "redemption rules.",
  note: "Example values only. Redemption is not deployed and no redemption rights currently exist.",
} as const;

/* ------------------------------ 11 · Roadmap ------------------------------ */

export type RoadmapPhase = {
  phase: string;
  name: string;
  copy: string;
  mission?: boolean;
};

export const ROADMAP: RoadmapPhase[] = [
  {
    phase: "Phase 01",
    name: "Accumulate",
    copy: "Launch ZBANK and establish transparent ZEC treasury infrastructure.",
  },
  {
    phase: "Phase 02",
    name: "Invest",
    copy: "Launch ZINVEST for ZEC-funded Stock Token portfolios.",
  },
  {
    phase: "Phase 03",
    name: "Index",
    copy: "Launch ZEC-denominated portfolio baskets.",
  },
  {
    phase: "Phase 04",
    name: "Credit",
    copy: "Introduce collateral and liquidity products.",
  },
  {
    phase: "Phase 05",
    name: "Capital Markets",
    copy: "Launch ZLAUNCH and broader ZEC-native financial products.",
  },
  {
    phase: "Mission",
    name: "1% of Zcash",
    copy: "Build toward ownership of 1% of circulating ZEC.",
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
const PENDING_TOKEN = "Pending token launch";

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
    value: "50% ZEC treasury · 30% ZBNK burn · 20% reserve — proposed",
  },
  {
    label: "Audit Status",
    value: "Unaudited — external audit pending",
    href: "https://github.com/Zbank-Protocol/contracts/blob/main/SECURITY.md",
  },
  { label: "ZBNK Contract", value: null, pendingLabel: PENDING_TOKEN },
  { label: "ZEC Treasury Address", value: null, pendingLabel: PENDING_TOKEN },
  { label: "Redeemable Treasury", value: null, pendingLabel: PENDING_TOKEN },
  { label: "Strategic Treasury", value: null, pendingLabel: PENDING_TOKEN },
  { label: "Eligible Supply", value: null, pendingLabel: PENDING_TOKEN },
  { label: "Cumulative Burns", value: null, pendingLabel: PENDING_TOKEN },
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
