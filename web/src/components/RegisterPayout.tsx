import { useEffect, useState } from "react";
import { createWalletClient, custom, type Address } from "viem";
import { CHAIN, CONTRACTS } from "../config";
import { registryAbi, robinhoodChain } from "../lib/chain";
import { checkZcashAddress, type AddressCheck } from "../lib/zcashAddress";

type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent"; hash: string }
  | { kind: "error"; message: string };

export function RegisterPayout() {
  const [value, setValue] = useState("");
  const [check, setCheck] = useState<AddressCheck>({ ok: false, reason: "" });
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // Validate on every keystroke. Async, so guard against out-of-order resolution.
  useEffect(() => {
    let stale = false;
    void checkZcashAddress(value).then((result) => {
      if (!stale) setCheck(result);
    });
    return () => {
      stale = true;
    };
  }, [value]);

  const touched = value.trim().length > 0;
  const state = !touched ? "idle" : check.ok ? "valid" : "invalid";

  const hint = !touched
    ? "Starts with t1 or t3 · 35 characters"
    : check.ok
      ? `Valid ${check.kind} address`
      : check.reason;

  async function submit() {
    if (!check.ok) return;

    const provider = (window as unknown as { ethereum?: Eip1193 }).ethereum;
    if (!provider) {
      setStatus({ kind: "error", message: "No EVM wallet detected in this browser." });
      return;
    }
    if (!CONTRACTS.payoutRegistry) {
      setStatus({ kind: "error", message: "The registry is not deployed yet." });
      return;
    }

    setStatus({ kind: "submitting" });
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as Address[];
      const wallet = createWalletClient({
        account: accounts[0],
        chain: robinhoodChain,
        transport: custom(provider),
      });

      // The wallet may be pointed at another network; ask before writing.
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${CHAIN.id.toString(16)}` }],
      });

      const hash = await wallet.writeContract({
        address: CONTRACTS.payoutRegistry,
        abi: registryAbi,
        functionName: "setPayoutAddress",
        args: [value.trim()],
      });

      setStatus({ kind: "sent", hash });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Transaction failed.",
      });
    }
  }

  return (
    <div className="register">
      <label className="register__field">
        <span className="t-label">Your Zcash payout address</span>
        <input
          className="register__input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="t1..."
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          data-state={state}
          aria-invalid={state === "invalid"}
          aria-describedby="payout-hint"
        />
      </label>

      <p className="register__hint t-mono" id="payout-hint" data-state={state} role="status">
        {hint}
      </p>

      <div className="register__actions">
        <button
          className="btn btn--primary"
          onClick={submit}
          disabled={!check.ok || status.kind === "submitting"}
        >
          {status.kind === "submitting" ? "Confirm in wallet" : "Register address"}
        </button>

        {status.kind === "sent" ? (
          <a
            className="btn btn--quiet"
            href={`${CHAIN.explorer}/tx/${status.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction
          </a>
        ) : null}
      </div>

      {status.kind === "error" ? (
        <p className="register__hint t-mono" data-state="invalid">
          {status.message}
        </p>
      ) : null}

      <p className="t-body sec__p sec__p--quiet" style={{ marginTop: "1.4rem" }}>
        Shielded and unified addresses are rejected on purpose. Payout routes settle to transparent
        addresses only — shield the ZEC yourself once it arrives.
      </p>
    </div>
  );
}
