import { useCallback, useState } from "react";
import { ASSETS } from "../config/protocol";
import { ensureAllowance, fromUsdg, fromZec, marketAddress, marketWrite } from "../lib/zcredit";

/**
 * The six ZCREDIT transactions, as one hook: supply / withdraw (lender side) and
 * deposit collateral / withdraw collateral / borrow / repay (borrower side).
 *
 * Each action approves exactly the amount needed (no unlimited allowances), sends the
 * transaction, waits for the receipt, and reports status for the button UI. Errors surface
 * as short human text — wallet rejections and revert reasons, not stack traces.
 */

export type TxStatus = "idle" | "approving" | "confirming" | "success" | "error";

export function useZCreditActions(account: string | null, onSettled?: () => void) {
  const [status, setStatus] = useState<TxStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setError(null);
      try {
        await fn();
        setStatus("success");
      } catch (e) {
        setStatus("error");
        const message = e instanceof Error ? e.message : String(e);
        // First meaningful line only — viem errors are verbose.
        setError(message.split("\n")[0].slice(0, 160));
      } finally {
        onSettled?.();
      }
    },
    [onSettled],
  );

  const ready = account != null && marketAddress() != null;
  const user = account as `0x${string}`;
  const market = marketAddress() as `0x${string}`;

  const supply = useCallback(
    (amountUsdg: number) =>
      run(async () => {
        const amount = fromUsdg(amountUsdg);
        setStatus("approving");
        await ensureAllowance(user, ASSETS.USDG.address as `0x${string}`, market, amount);
        setStatus("confirming");
        await marketWrite(user, "supply", [amount]);
      }),
    [run, user, market],
  );

  const withdraw = useCallback(
    (amountUsdg: number) =>
      run(async () => {
        setStatus("confirming");
        await marketWrite(user, "withdraw", [fromUsdg(amountUsdg)]);
      }),
    [run, user],
  );

  const depositCollateral = useCallback(
    (amountZec: number) =>
      run(async () => {
        const amount = fromZec(amountZec);
        setStatus("approving");
        await ensureAllowance(user, ASSETS.ZEC.address as `0x${string}`, market, amount);
        setStatus("confirming");
        await marketWrite(user, "depositCollateral", [amount]);
      }),
    [run, user, market],
  );

  const withdrawCollateral = useCallback(
    (amountZec: number) =>
      run(async () => {
        setStatus("confirming");
        await marketWrite(user, "withdrawCollateral", [fromZec(amountZec)]);
      }),
    [run, user],
  );

  const borrow = useCallback(
    (amountUsdg: number) =>
      run(async () => {
        setStatus("confirming");
        await marketWrite(user, "borrow", [fromUsdg(amountUsdg)]);
      }),
    [run, user],
  );

  /** Repays own debt; pass Infinity for a full repayment (uint256 max + buffer allowance). */
  const repay = useCallback(
    (amountUsdg: number, fullDebtUsdg?: number) =>
      run(async () => {
        const full = amountUsdg === Infinity;
        // Full repayment approves current debt + 0.1% for interest accrued in-flight.
        const approveAmount = full
          ? fromUsdg((fullDebtUsdg ?? 0) * 1.001)
          : fromUsdg(amountUsdg);
        const sendAmount = full ? 2n ** 256n - 1n : fromUsdg(amountUsdg);
        setStatus("approving");
        await ensureAllowance(user, ASSETS.USDG.address as `0x${string}`, market, approveAmount);
        setStatus("confirming");
        await marketWrite(user, "repay", [user, sendAmount]);
      }),
    [run, user, market],
  );

  return {
    ready,
    status,
    error,
    busy: status === "approving" || status === "confirming",
    reset: () => {
      setStatus("idle");
      setError(null);
    },
    supply,
    withdraw,
    depositCollateral,
    withdrawCollateral,
    borrow,
    repay,
  };
}
