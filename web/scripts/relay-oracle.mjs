#!/usr/bin/env node
/**
 * ZEC/USD oracle relayer for ZBANK.
 *
 * Loop: fetch the latest signed ZEC/USD report from the Chainlink Data Streams API →
 * submit it to ZecUsdDataStreamFeed.updatePrice() on Robinhood Chain → sleep → repeat.
 * The contract verifies the DON signatures onchain, so this relayer is untrusted plumbing:
 * a compromised relayer can at worst stop relaying (the market then halts safely on
 * staleness), never inject a false price.
 *
 * Required environment:
 *   DATASTREAMS_API_KEY     Chainlink Data Streams client id
 *   DATASTREAMS_API_SECRET  Chainlink Data Streams client secret
 *   RELAYER_PRIVATE_KEY     funded key on Robinhood Chain (gas only; no other permissions)
 *   ORACLE_FEED_ADDRESS     deployed ZecUsdDataStreamFeed contract
 * Optional:
 *   RELAY_INTERVAL_SECONDS  default 600 (well inside the 30-minute staleness bound)
 *
 * Run:  node scripts/relay-oracle.mjs
 */

import crypto from "node:crypto";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const FEED_ID = "0x00039f8a144f4a62715ca60aec1cf848c4821375c57e2259c6c90b7fa49db693"; // ZEC/USD
const API_HOST = "https://api.dataengine.chain.link";
const RPC = "https://rpc.mainnet.chain.robinhood.com";

const chain = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

const FEED_ABI = [
  {
    type: "function",
    name: "updatePrice",
    stateMutability: "payable",
    inputs: [{ name: "signedReport", type: "bytes" }],
    outputs: [],
  },
  {
    type: "function",
    name: "quoteFee",
    stateMutability: "view",
    inputs: [{ name: "signedReport", type: "bytes" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "lastObservedAt",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint32" }],
  },
];

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. See the header of this file.`);
    process.exit(1);
  }
  return v;
}

const apiKey = requireEnv("DATASTREAMS_API_KEY");
const apiSecret = requireEnv("DATASTREAMS_API_SECRET");
const account = privateKeyToAccount(requireEnv("RELAYER_PRIVATE_KEY"));
const feedAddress = requireEnv("ORACLE_FEED_ADDRESS");
const intervalMs = Number(process.env.RELAY_INTERVAL_SECONDS ?? 600) * 1000;

const publicClient = createPublicClient({ chain, transport: http() });
const walletClient = createWalletClient({ chain, transport: http(), account });

/** Chainlink Data Streams HMAC auth (method, path+query, body hash, client id, timestamp). */
function authHeaders(method, pathWithQuery) {
  const timestamp = Date.now();
  const bodyHash = crypto.createHash("sha256").update("").digest("hex");
  const preimage = `${method} ${pathWithQuery} ${bodyHash} ${apiKey} ${timestamp}`;
  const signature = crypto.createHmac("sha256", apiSecret).update(preimage).digest("hex");
  return {
    Authorization: apiKey,
    "X-Authorization-Timestamp": String(timestamp),
    "X-Authorization-Signature-SHA256": signature,
  };
}

async function fetchLatestReport() {
  const path = `/api/v1/reports/latest?feedID=${FEED_ID}`;
  const res = await fetch(`${API_HOST}${path}`, { headers: authHeaders("GET", path) });
  if (!res.ok) throw new Error(`Data Streams API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const fullReport = json?.report?.fullReport;
  if (!fullReport) throw new Error(`No fullReport in response: ${JSON.stringify(json).slice(0, 200)}`);
  return fullReport.startsWith("0x") ? fullReport : `0x${fullReport}`;
}

async function relayOnce() {
  const report = await fetchLatestReport();
  const fee = await publicClient.readContract({
    address: feedAddress,
    abi: FEED_ABI,
    functionName: "quoteFee",
    args: [report],
  });
  const hash = await walletClient.writeContract({
    address: feedAddress,
    abi: FEED_ABI,
    functionName: "updatePrice",
    args: [report],
    value: fee,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const observedAt = await publicClient.readContract({
    address: feedAddress,
    abi: FEED_ABI,
    functionName: "lastObservedAt",
  });
  console.log(
    `[${new Date().toISOString()}] relayed: tx=${hash} status=${receipt.status} observedAt=${observedAt} fee=${fee}`,
  );
}

console.log(`ZEC/USD relayer starting: feed=${feedAddress} relayer=${account.address} every ${intervalMs / 1000}s`);
for (;;) {
  try {
    await relayOnce();
  } catch (e) {
    // Errors are loud but non-fatal: a missed cycle only ages the price; the market
    // halts safely at 30 minutes. NotNewer reverts (report already relayed) are normal.
    console.error(`[${new Date().toISOString()}] relay failed:`, e.message ?? e);
  }
  await new Promise((r) => setTimeout(r, intervalMs));
}
