import { useEffect, useState } from "react";
import { ORACLES, PROTOCOL_CONTRACTS, ZCREDIT_RISK } from "../config/protocol";
import {
  ZCREDIT_ABI,
  ORACLE_ABI,
  getPublicClient,
  marketAddress,
  oracleAddress,
  toUsdg,
  toWadFraction,
} from "../lib/zcredit";

/**
 * The ZCREDIT market state — utilization, both rates, liquidity, oracle health.
 *
 * ZEARN and ZLOOP consume this same hook: there is exactly one lending market and every
 * surface reads it from here. When `PROTOCOL_CONTRACTS.creditMarket` is set, everything
 * below is a live contract read (polled every 15s); when it is null, everything is null —
 * a rate is never fabricated.
 */

export type ZCreditMarket = {
  live: boolean;
  utilization: number | null; // 0..1
  supplyApy: number | null; // fraction, derived from borrower interest
  borrowApy: number | null; // fraction
  /** Incentive APY is shown ONLY if an emission system is configured. None is. */
  incentiveApy: number | null;
  totalSupplied: number | null; // USDG
  totalBorrowed: number | null; // USDG
  availableLiquidity: number | null; // USDG
  reserveFactorBps: number;
  risk: typeof ZCREDIT_RISK;
  oracle: {
    label: string;
    status: (typeof ORACLES)["zecUsd"]["status"];
    price: number | null; // ZEC/USD
  };
};

type ChainState = Pick<
  ZCreditMarket,
  "utilization" | "supplyApy" | "borrowApy" | "totalSupplied" | "totalBorrowed" | "availableLiquidity"
> & { oraclePrice: number | null; oracleStatus: ZCreditMarket["oracle"]["status"] };

const EMPTY: ChainState = {
  utilization: null,
  supplyApy: null,
  borrowApy: null,
  totalSupplied: null,
  totalBorrowed: null,
  availableLiquidity: null,
  oraclePrice: null,
  oracleStatus: ORACLES.zecUsd.status,
};

export function useZCreditMarket(): ZCreditMarket {
  const address = marketAddress();
  const live = address != null;
  const [chain, setChain] = useState<ChainState>(EMPTY);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    const load = async () => {
      try {
        const client = await getPublicClient();
        const read = (functionName: string) =>
          client.readContract({ address, abi: ZCREDIT_ABI, functionName: functionName as never }) as Promise<bigint>;

        const [utilization, borrowRate, supplyRate, cash, borrows, reserves] = await Promise.all([
          read("utilizationBps"),
          read("borrowRatePerYear"),
          read("supplyRatePerYear"),
          read("availableLiquidity"),
          read("totalBorrows"),
          read("totalReserves"),
        ]);

        // The oracle read is allowed to fail — a reverting oracle means "halted", not "0".
        let oraclePrice: number | null = null;
        let oracleStatus: ChainState["oracleStatus"] = "stale";
        const oracle = oracleAddress();
        if (oracle) {
          try {
            const price = (await client.readContract({
              address: oracle,
              abi: ORACLE_ABI,
              functionName: "priceUsd",
            })) as bigint;
            oraclePrice = toWadFraction(price);
            oracleStatus = "live";
          } catch {
            oracleStatus = "stale";
          }
        }

        if (cancelled) return;
        setChain({
          utilization: Number(utilization) / 10_000,
          borrowApy: toWadFraction(borrowRate),
          supplyApy: toWadFraction(supplyRate),
          availableLiquidity: toUsdg(cash),
          totalBorrowed: toUsdg(borrows),
          totalSupplied: toUsdg(cash + borrows - reserves),
          oraclePrice,
          oracleStatus,
        });
      } catch {
        if (!cancelled) setChain((prev) => ({ ...prev, oracleStatus: "error" }));
      }
    };

    void load();
    const id = window.setInterval(load, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [address]);

  return {
    live,
    utilization: chain.utilization,
    supplyApy: chain.supplyApy,
    borrowApy: chain.borrowApy,
    incentiveApy: null, // no emission system configured
    totalSupplied: chain.totalSupplied,
    totalBorrowed: chain.totalBorrowed,
    availableLiquidity: chain.availableLiquidity,
    reserveFactorBps: ZCREDIT_RISK.reserveFactorBps,
    risk: ZCREDIT_RISK,
    oracle: {
      label: ORACLES.zecUsd.label,
      status: live ? chain.oracleStatus : PROTOCOL_CONTRACTS.creditMarket ? "stale" : ORACLES.zecUsd.status,
      price: chain.oraclePrice,
    },
  };
}
