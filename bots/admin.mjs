#!/usr/bin/env node
/**
 * Narrow mainnet administration tool. It intentionally supports only the ZCredit safety
 * actions needed by the launch runbook; it is not an arbitrary transaction executor.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC_URL = process.env.RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com";
const MARKET = "0x77ccb77d1fd337b7027b3482ca365db57d92151e";
const action = process.env.ADMIN_ACTION;
const confirmation = process.env.ADMIN_CONFIRMATION;
const pk = process.env.KEEPER_PRIVATE_KEY;

if (!pk) throw new Error("KEEPER_PRIVATE_KEY is required");
if (confirmation !== `ZBANK_${action?.toUpperCase()}`) {
  throw new Error(`ADMIN_CONFIRMATION must equal ZBANK_${action?.toUpperCase()}`);
}

const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
const chain = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
};
const abi = parseAbi([
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function collateralCap() view returns (uint256)",
  "function pause()",
  "function unpause()",
  "function setCollateralCap(uint256 cap)",
  "function transferOwnership(address newOwner)",
]);
const pub = createPublicClient({ chain, transport: http(RPC_URL) });
const wallet = createWalletClient({ chain, transport: http(RPC_URL), account });

const owner = await pub.readContract({ address: MARKET, abi, functionName: "owner" });
if (owner.toLowerCase() !== account.address.toLowerCase()) {
  throw new Error(`signer ${account.address} is not market owner ${owner}`);
}

let functionName;
let args = [];
if (action === "pause" || action === "unpause") {
  functionName = action;
} else if (action === "set-collateral-cap") {
  functionName = "setCollateralCap";
  const value = process.env.COLLATERAL_CAP_ZEC;
  if (!value || Number(value) <= 0) throw new Error("COLLATERAL_CAP_ZEC must be positive");
  args = [parseUnits(value, 8)];
} else if (action === "transfer-ownership") {
  functionName = "transferOwnership";
  const next = process.env.NEW_OWNER;
  if (!/^0x[a-fA-F0-9]{40}$/.test(next ?? "")) throw new Error("NEW_OWNER is invalid");
  args = [next];
} else {
  throw new Error("ADMIN_ACTION must be pause, unpause, set-collateral-cap, or transfer-ownership");
}

const { request } = await pub.simulateContract({
  account,
  address: MARKET,
  abi,
  functionName,
  args,
});
const hash = await wallet.writeContract(request);
const receipt = await pub.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") throw new Error(`admin transaction reverted: ${hash}`);

console.log(JSON.stringify({ action, market: MARKET, signer: account.address, hash }, null, 2));
