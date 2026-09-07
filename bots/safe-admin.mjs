#!/usr/bin/env node
/**
 * Local-only emergency administration through the protocol Safe.
 *
 * The Safe owner must run this from a trusted machine. Never place
 * SAFE_OWNER_PRIVATE_KEY in GitHub Actions or paste it into chat.
 */
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  parseAbi,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { makeApprovedHashSignature } from "./lib.mjs";

const RPC_URL = process.env.RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com";
const SAFE = "0x31837999D9E463B2EB4327CEb4BD7CCa2a500480";
const MARKET = "0x77ccb77d1fd337b7027b3482ca365db57d92151e";
const action = process.env.SAFE_ACTION;
const pk = process.env.SAFE_OWNER_PRIVATE_KEY;

if (!pk) throw new Error("SAFE_OWNER_PRIVATE_KEY is required locally");
if (process.env.SAFE_CONFIRMATION !== `ZBANK_${action?.toUpperCase()}`) {
  throw new Error(`SAFE_CONFIRMATION must equal ZBANK_${action?.toUpperCase()}`);
}

const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
const chain = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
};
const safeAbi = parseAbi([
  "function getOwners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
  "function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address payable refundReceiver,bytes signatures) returns (bool success)",
  "function addOwnerWithThreshold(address owner,uint256 threshold)",
]);
const marketAbi = parseAbi([
  "function pause()",
  "function unpause()",
  "function setCollateralCap(uint256 cap)",
]);
const pub = createPublicClient({ chain, transport: http(RPC_URL) });
const wallet = createWalletClient({ chain, transport: http(RPC_URL), account });

const owners = await pub.readContract({ address: SAFE, abi: safeAbi, functionName: "getOwners" });
if (!owners.some((owner) => owner.toLowerCase() === account.address.toLowerCase())) {
  throw new Error(`signer ${account.address} is not a Safe owner`);
}

let target = MARKET;
let data;
if (action === "pause" || action === "unpause") {
  data = encodeFunctionData({ abi: marketAbi, functionName: action });
} else if (action === "set-collateral-cap") {
  const value = process.env.COLLATERAL_CAP_ZEC;
  if (!value || Number(value) <= 0) throw new Error("COLLATERAL_CAP_ZEC must be positive");
  data = encodeFunctionData({
    abi: marketAbi,
    functionName: "setCollateralCap",
    args: [parseUnits(value, 8)],
  });
} else if (action === "add-owner") {
  const next = process.env.NEW_SAFE_OWNER;
  const threshold = BigInt(process.env.NEW_SAFE_THRESHOLD ?? "2");
  if (!/^0x[a-fA-F0-9]{40}$/.test(next ?? "")) throw new Error("NEW_SAFE_OWNER is invalid");
  target = SAFE;
  data = encodeFunctionData({
    abi: safeAbi,
    functionName: "addOwnerWithThreshold",
    args: [next, threshold],
  });
} else {
  throw new Error("SAFE_ACTION must be pause, unpause, set-collateral-cap, or add-owner");
}

// Safe's approved-hash signature: valid without a prior approval transaction when the
// owner submitting execTransaction is encoded in r, with s=0 and v=1.
const signatures = makeApprovedHashSignature(account.address);
const args = [
  target,
  0n,
  data,
  0,
  0n,
  0n,
  0n,
  "0x0000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000",
  signatures,
];
const { request } = await pub.simulateContract({
  account,
  address: SAFE,
  abi: safeAbi,
  functionName: "execTransaction",
  args,
});
const hash = await wallet.writeContract(request);
const receipt = await pub.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") throw new Error(`Safe transaction reverted: ${hash}`);

console.log(JSON.stringify({ safe: SAFE, action, target, signer: account.address, hash }, null, 2));
