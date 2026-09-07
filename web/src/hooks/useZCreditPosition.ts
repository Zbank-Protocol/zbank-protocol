import { useCallback, useEffect, useState } from "react";
import { ZCREDIT_RISK } from "../config/protocol";
import {
  ZCREDIT_ABI,
  ORACLE_ABI,
  getPublicClient,
  marketAddress,
  oracleAddress,
  toUsdg,
  toZec,
  toWadFraction,
} from "../lib/zcredit";

/**
 * One user's ZCREDIT position: collateral, debt, capacity, and health. Null across the board
 * until the market is deployed and a wallet is connected — a position that doesn't exist is
 * "—", never zero. Live positions poll every 15s and expose `refresh` for post-transaction
 * updates.
 */

export type ZCreditPosition = {
  live: boolean;
  collateralZec: number | null;
  collateralValueUsd: number | null;
  borrowedUsdg: number | null;
  availableToBorrowUsdg: number | null;
  ltv: number | null; // fraction
  healthFactor: number | null;
  accruedInterestUsdg: number | null;
  /** Lender side. */
  suppliedUsdg: number | null;
  interestEarnedUsdg: number | null;
  refresh: () => void;
};

type ChainState = Omit<ZCreditPosition, "live" | "refresh">;

const EMPTY: ChainState = {
  collateralZec: null,
  collateralValueUsd: null,
  borrowedUsdg: null,
  availableToBorrowUsdg: null,
  ltv: null,
  healthFactor: null,
  accruedInterestUsdg: null,
  suppliedUsdg: null,
  interestEarnedUsdg: null,
};

export function useZCreditPosition(address: string | null): ZCreditPosition {
  const market = marketAddress();
  const live = market != null;
  const [chain, setChain] = useState<ChainState>(EMPTY);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!market || !address) {
      setChain(EMPTY);
      return;
    }
    const user = address as `0x${string}`;
    let cancelled = false;

    const load = async () => {
      try {
        const client = await getPublicClient();
        const read = (functionName: string, args: readonly unknown[] = []) =>
          client.readContract({
            address: market,
            abi: ZCREDIT_ABI,
            functionName: functionName as never,
            args: args as never,
          }) as Promise<bigint>;

        const [collateral, debt, hf, supplied, cash] = await Promise.all([
          read("collateralOf", [user]),
          read("debtOf", [user]),
          read("healthFactor", [user]),
          read("balanceOfSupplied", [user]),
          read("availableLiquidity"),
        ]);

        // Collateral value needs the oracle; if it's halted, value renders "—".
        let collateralValueUsd: number | null = null;
        let availableToBorrowUsdg: number | null = null;
        const oracle = oracleAddress();
        if (oracle) {
          try {
            const price = (await client.readContract({
              address: oracle,
              abi: ORACLE_ABI,
              functionName: "priceUsd",
            })) as bigint;
            const priceUsd = toWadFraction(price);
            collateralValueUsd = toZec(collateral) * priceUsd;
            const capacity =
              collateralValueUsd * (ZCREDIT_RISK.maxLtvBps / 10_000) - toUsdg(debt);
            availableToBorrowUsdg = Math.max(0, Math.min(capacity, toUsdg(cash)));
          } catch {
            /* oracle halted — values stay null */
          }
        }

        if (cancelled) return;
        const borrowed = toUsdg(debt);
        setChain({
          collateralZec: toZec(collateral),
          collateralValueUsd,
          borrowedUsdg: borrowed,
          availableToBorrowUsdg,
          ltv:
            collateralValueUsd && collateralValueUsd > 0 ? borrowed / collateralValueUsd : null,
          // uint256 max = no debt; render as null (no meter), not a number.
          healthFactor: debt === 0n ? null : toWadFraction(hf),
          accruedInterestUsdg: null, // needs an indexer (principal history); never invented
          suppliedUsdg: toUsdg(supplied),
          interestEarnedUsdg: null, // same — indexer territory
        });
      } catch {
        /* transient RPC failure: keep last state */
      }
    };

    void load();
    const id = window.setInterval(load, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [market, address, tick]);

  return { live, ...chain, refresh };
}
