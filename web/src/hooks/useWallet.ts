import { useCallback, useEffect, useState } from "react";
import { NETWORK } from "../config/protocol";

/**
 * Injected-wallet connection (EIP-1193). Real connection, real address, real chain check —
 * this is the one execution-adjacent thing that can be honestly live pre-launch.
 */

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, cb: (...args: never[]) => void) => void;
  removeListener?: (event: string, cb: (...args: never[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193;
  }
}

export type WalletState = {
  address: string | null;
  chainId: number | null;
  /** True when connected AND on Robinhood Chain. */
  ready: boolean;
  hasProvider: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  switchChain: () => Promise<void>;
};

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);

  const hasProvider = typeof window !== "undefined" && Boolean(window.ethereum);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.on) return;

    const onAccounts = (accounts: string[]) => setAddress(accounts[0] ?? null);
    const onChain = (hex: string) => setChainId(Number.parseInt(hex, 16));
    eth.on("accountsChanged", onAccounts as never);
    eth.on("chainChanged", onChain as never);

    // Restore an already-authorized session without prompting.
    void eth.request({ method: "eth_accounts" }).then((accts) => {
      const list = accts as string[];
      if (list.length > 0) {
        setAddress(list[0]);
        void eth.request({ method: "eth_chainId" }).then((hex) => {
          setChainId(Number.parseInt(hex as string, 16));
        });
      }
    });

    return () => {
      eth.removeListener?.("accountsChanged", onAccounts as never);
      eth.removeListener?.("chainChanged", onChain as never);
    };
  }, []);

  const connect = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) return;
    setConnecting(true);
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      setAddress(accounts[0] ?? null);
      const hex = (await eth.request({ method: "eth_chainId" })) as string;
      setChainId(Number.parseInt(hex, 16));
    } catch {
      // User rejected — nothing to do.
    } finally {
      setConnecting(false);
    }
  }, []);

  const switchChain = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) return;
    const hexId = `0x${NETWORK.chainId.toString(16)}`;
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
    } catch {
      // Chain unknown to the wallet: offer to add it.
      await eth
        .request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hexId,
              chainName: NETWORK.name,
              rpcUrls: [NETWORK.rpcUrl],
              blockExplorerUrls: [NETWORK.explorer],
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            },
          ],
        })
        .catch(() => undefined);
    }
  }, []);

  return {
    address,
    chainId,
    ready: address != null && chainId === NETWORK.chainId,
    hasProvider,
    connecting,
    connect,
    switchChain,
  };
}

/** 0x1234…abcd, for headers and summaries. */
export function shortAddress(addr: string | null): string {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";
}
