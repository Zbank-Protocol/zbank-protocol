/**
 * The ZBNK economic model, as data.
 *
 * Two forces: protocol revenue acquires ZEC for the treasury (more ZEC) and buys ZBNK from the
 * market for permanent burn (fewer ZBNK). Under the proposed redemption model, eligible ZBNK
 * represents a proportional redemption claim against the *redeemable* ZEC treasury.
 *
 * Accounting discipline that the whole frontend must respect:
 *
 *   - The treasury is split into redeemable and strategic ZEC. They are separate on purpose:
 *     not every treasury asset necessarily backs redemption.
 *   - Every backing calculation uses REDEEMABLE ZEC ONLY. Total treasury is a mission number,
 *     never a backing number. Do not sum the two back together for per-token math.
 *   - `null` means "no honest figure exists yet" and must render as "—" or "Pending launch",
 *     never as zero.
 */

export type TreasuryState = {
  /** All ZEC the protocol holds. The 1% mission counts this. */
  totalZec: number | null;
  /** The portion of the treasury that backs the proposed redemption model. */
  redeemableZec: number | null;
  /** Treasury ZEC reserved for strategy/operations — explicitly NOT redemption backing. */
  strategicZec: number | null;
  /** ZEC market price in USD. null until an oracle or feed exists. */
  currentZecPrice: number | null;
};

export type TokenState = {
  totalSupply: number | null;
  circulatingSupply: number | null;
  /** Supply eligible for the proposed redemption claim. The denominator of all backing math. */
  eligibleSupply: number | null;
  /** Cumulative ZBNK permanently burned. */
  burnedSupply: number | null;
  /** ZBNK market price in USD. null until the token trades. */
  currentPrice: number | null;
};

export type DerivedMetrics = {
  /** redeemableZec / eligibleSupply. The core ratio of the whole model. */
  zecPerEligibleZbnk: number | null;
  /** (redeemableZec × zecPrice) / eligibleSupply. Not called NAV, deliberately. */
  treasuryAssetValuePerZbnk: number | null;
  /** (marketPrice − treasuryAssetValue) / treasuryAssetValue, as a fraction. */
  premiumDiscount: number | null;
  /** totalZec / missionTargetZec, as a fraction. */
  missionProgress: number | null;
};

/**
 * Derive every headline metric from raw state. Any input that is missing propagates as null —
 * a metric either computes honestly or does not exist.
 */
export function deriveMetrics(
  treasury: TreasuryState,
  token: TokenState,
  missionTargetZec: number | null,
): DerivedMetrics {
  const zecPerEligibleZbnk =
    treasury.redeemableZec != null && token.eligibleSupply != null && token.eligibleSupply > 0
      ? treasury.redeemableZec / token.eligibleSupply
      : null;

  const treasuryAssetValuePerZbnk =
    zecPerEligibleZbnk != null && treasury.currentZecPrice != null
      ? zecPerEligibleZbnk * treasury.currentZecPrice
      : null;

  const premiumDiscount =
    treasuryAssetValuePerZbnk != null &&
    treasuryAssetValuePerZbnk > 0 &&
    token.currentPrice != null
      ? (token.currentPrice - treasuryAssetValuePerZbnk) / treasuryAssetValuePerZbnk
      : null;

  const missionProgress =
    treasury.totalZec != null && missionTargetZec != null && missionTargetZec > 0
      ? treasury.totalZec / missionTargetZec
      : null;

  return { zecPerEligibleZbnk, treasuryAssetValuePerZbnk, premiumDiscount, missionProgress };
}

/* ------------------------------- Formatting ------------------------------- */

const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const two = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Whole-number grouping: 100,000,000. Null-safe: "—". */
export function fmtAmount(n: number | null): string {
  return n == null ? "—" : int.format(n);
}

/** ZEC quantities: two decimals, grouped. */
export function fmtZec(n: number | null): string {
  return n == null ? "—" : two.format(n);
}

/** The core ratio, at six decimals — 0.001685 must never round away. */
export function fmtRatio(n: number | null): string {
  return n == null ? "—" : n.toFixed(6);
}

/** USD, or the honest "$—" when no price exists. */
export function fmtUsd(n: number | null): string {
  return n == null ? "$—" : `$${two.format(n)}`;
}

/** Signed percentage from a fraction: 0.111 → "+11.1%". For deltas and premium/discount. */
export function fmtPct(fraction: number | null, digits = 1): string {
  if (fraction == null) return "—";
  const pct = fraction * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(digits)}%`;
}

/** Unsigned percentage from a fraction: 0.058 → "5.80%". For rates and utilization. */
export function fmtRate(fraction: number | null, digits = 2): string {
  return fraction == null ? "—" : `${(fraction * 100).toFixed(digits)}%`;
}
