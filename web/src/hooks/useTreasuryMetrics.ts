import { MISSION_TARGET_ZEC, TOKEN_STATE, TREASURY_STATE } from "../data/site";
import { deriveMetrics } from "../lib/economics";
import type { DerivedMetrics, TokenState, TreasuryState } from "../lib/economics";

/**
 * ZTREASURY's data source: raw treasury/token state plus every derived metric, and the
 * windowed acquisition/burn figures. All windows are null pre-launch — the treasury reporting
 * contracts don't exist, and "Pending launch" is the only honest render.
 */

export type TreasuryWindow = { window: "24h" | "7d" | "30d" | "All time"; value: number | null };

export type TreasuryMetrics = {
  live: boolean;
  treasury: TreasuryState;
  token: TokenState;
  metrics: DerivedMetrics;
  missionTargetZec: number;
  zecAcquired: TreasuryWindow[];
  zbnkBurned: TreasuryWindow[];
  protocolRevenueUsd: number | null;
  recentTreasuryTxs: { hash: string; note: string }[] | null;
  recentBurns: { hash: string; note: string }[] | null;
};

const EMPTY_WINDOWS: TreasuryWindow[] = [
  { window: "24h", value: null },
  { window: "7d", value: null },
  { window: "30d", value: null },
  { window: "All time", value: null },
];

export function useTreasuryMetrics(): TreasuryMetrics {
  return {
    live: false,
    treasury: TREASURY_STATE,
    token: TOKEN_STATE,
    metrics: deriveMetrics(TREASURY_STATE, TOKEN_STATE, MISSION_TARGET_ZEC),
    missionTargetZec: MISSION_TARGET_ZEC,
    zecAcquired: EMPTY_WINDOWS,
    zbnkBurned: EMPTY_WINDOWS,
    protocolRevenueUsd: null,
    recentTreasuryTxs: null,
    recentBurns: null,
  };
}
