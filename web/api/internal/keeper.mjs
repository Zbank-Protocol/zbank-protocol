import crypto from "node:crypto";
import {
  createPublicClient,
  createWalletClient,
  decodeAbiParameters,
  formatUnits,
  http,
  parseAbi,
  parseAbiItem,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = process.env.ROBINHOOD_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com";
const MARKET = "0x77ccb77d1fd337b7027b3482ca365db57d92151e";
const FEED = "0x931F6295bf6aB9Dc02997a03b4ba85Aca9373AF5";
const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const DEPLOY_BLOCK = 56_922_998n;
const STREAM_FEED_ID = "0x00039f8a144f4a62715ca60aec1cf848c4821375c57e2259c6c90b7fa49db693";
const DATASTREAMS_HOST = "https://api.dataengine.chain.link";
const REFRESH_SECONDS = 600;
const DEVIATION_BPS = 50;
const MAX_LIQUIDATIONS = 3;
const WAD = 10n ** 18n;

const CHAIN = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

const FEED_ABI = parseAbi([
  "function lastPrice() view returns (int192)",
  "function lastObservedAt() view returns (uint32)",
  "function quoteFee(bytes signedReport) view returns (uint256)",
  "function updatePrice(bytes signedReport) payable",
]);
const MARKET_ABI = parseAbi([
  "function healthFactor(address borrower) view returns (uint256)",
  "function debtOf(address borrower) view returns (uint256)",
  "function liquidate(address borrower, uint256 repayAmount)",
]);
const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);
const BORROWED_EVENT = parseAbiItem("event Borrowed(address indexed borrower, uint256 amount)");

function authHeaders(apiKey, apiSecret, method, url, timestamp = Date.now()) {
  const parsed = new URL(url);
  const bodyHash = crypto.createHash("sha256").update("").digest("hex");
  const preimage = `${method} ${parsed.pathname}${parsed.search} ${bodyHash} ${apiKey} ${timestamp}`;
  return {
    Authorization: apiKey,
    "X-Authorization-Timestamp": String(timestamp),
    "X-Authorization-Signature-SHA256": crypto
      .createHmac("sha256", apiSecret)
      .update(preimage)
      .digest("hex"),
  };
}

function decodeReport(fullReport) {
  const [, reportData] = decodeAbiParameters(
    [{ type: "bytes32[3]" }, { type: "bytes" }],
    fullReport,
  );
  const [feedId, , observationsTimestamp, , , , price] = decodeAbiParameters(
    [
      { type: "bytes32" },
      { type: "uint32" },
      { type: "uint32" },
      { type: "uint192" },
      { type: "uint192" },
      { type: "uint32" },
      { type: "int192" },
      { type: "int192" },
      { type: "int192" },
    ],
    reportData,
  );
  return { feedId, observationsTimestamp, price };
}

async function latestReport() {
  const key = process.env.DATASTREAMS_API_KEY;
  const secret = process.env.DATASTREAMS_API_SECRET;
  if (!key || !secret) throw new Error("Data Streams credentials are missing");
  const path = `/api/v1/reports/latest?feedID=${STREAM_FEED_ID}`;
  const url = `${DATASTREAMS_HOST}${path}`;
  const response = await fetch(url, { headers: authHeaders(key, secret, "GET", url) });
  const body = await response.text();
  if (!response.ok) throw new Error(`Data Streams request failed with ${response.status}`);
  return JSON.parse(body).report.fullReport;
}

async function oraclePass(publicClient, walletClient) {
  const [lastPrice, lastObservedAt, fullReport] = await Promise.all([
    publicClient.readContract({ address: FEED, abi: FEED_ABI, functionName: "lastPrice" }),
    publicClient.readContract({ address: FEED, abi: FEED_ABI, functionName: "lastObservedAt" }),
    latestReport(),
  ]);
  const report = decodeReport(fullReport);
  if (report.feedId !== STREAM_FEED_ID) throw new Error("Data Streams feed ID mismatch");

  const ageSeconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(lastObservedAt));
  const difference = report.price > lastPrice ? report.price - lastPrice : lastPrice - report.price;
  const deviationBps = lastPrice > 0n ? Number((difference * 10_000n) / lastPrice) : Infinity;
  if (ageSeconds <= REFRESH_SECONDS && deviationBps <= DEVIATION_BPS) {
    return { action: "fresh", ageSeconds, deviationBps };
  }

  const fee = await publicClient.readContract({
    address: FEED,
    abi: FEED_ABI,
    functionName: "quoteFee",
    args: [fullReport],
  });

  try {
    const hash = await walletClient.writeContract({
      address: FEED,
      abi: FEED_ABI,
      functionName: "updatePrice",
      args: [fullReport],
      value: fee,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Oracle update transaction reverted");
    return {
      action: "updated",
      priceUsd: formatUnits(report.price, 18),
      observedAt: Number(report.observationsTimestamp),
      tx: hash,
    };
  } catch (error) {
    const observedAfterRace = await publicClient.readContract({
      address: FEED,
      abi: FEED_ABI,
      functionName: "lastObservedAt",
    });
    if (observedAfterRace >= report.observationsTimestamp) {
      return { action: "updated_by_concurrent_keeper", observedAt: Number(observedAfterRace) };
    }
    throw error;
  }
}

async function liquidationPass(publicClient, walletClient, account) {
  const logs = await publicClient.getLogs({
    address: MARKET,
    event: BORROWED_EVENT,
    fromBlock: DEPLOY_BLOCK,
    toBlock: "latest",
  });
  const borrowers = [...new Set(logs.map((entry) => entry.args.borrower))];
  let usdgBalance = await publicClient.readContract({
    address: USDG,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });
  let liquidated = 0;

  for (const borrower of borrowers) {
    if (liquidated >= MAX_LIQUIDATIONS) break;
    const [healthFactor, debt] = await Promise.all([
      publicClient.readContract({
        address: MARKET,
        abi: MARKET_ABI,
        functionName: "healthFactor",
        args: [borrower],
      }),
      publicClient.readContract({
        address: MARKET,
        abi: MARKET_ABI,
        functionName: "debtOf",
        args: [borrower],
      }),
    ]);
    if (debt === 0n || healthFactor >= WAD) continue;

    const maximumRepay = debt / 2n > 0n ? debt / 2n : debt;
    const repayAmount = usdgBalance < maximumRepay ? usdgBalance : maximumRepay;
    if (repayAmount === 0n) throw new Error("Underwater debt exists but keeper has no USDG");

    const allowance = await publicClient.readContract({
      address: USDG,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [account.address, MARKET],
    });
    if (allowance < repayAmount) {
      const approval = await walletClient.writeContract({
        address: USDG,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [MARKET, 2n ** 256n - 1n],
      });
      await publicClient.waitForTransactionReceipt({ hash: approval });
    }

    const hash = await walletClient.writeContract({
      address: MARKET,
      abi: MARKET_ABI,
      functionName: "liquidate",
      args: [borrower, repayAmount],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`Liquidation reverted for ${borrower}`);
    usdgBalance -= repayAmount;
    liquidated += 1;
  }

  return { borrowersChecked: borrowers.length, liquidated };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  const cronSecret = process.env.CRON_SECRET;
  const authorization = req.headers?.authorization;
  if (!cronSecret) return res.status(503).json({ error: "keeper_not_configured" });
  if (authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const privateKey = process.env.KEEPER_PRIVATE_KEY;
    if (!privateKey) throw new Error("Keeper key is missing");
    const account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
    const publicClient = createPublicClient({
      chain: CHAIN,
      transport: http(RPC, { timeout: 10_000 }),
    });
    const walletClient = createWalletClient({
      chain: CHAIN,
      transport: http(RPC, { timeout: 10_000 }),
      account,
    });
    const gasBalance = await publicClient.getBalance({ address: account.address });
    if (gasBalance < 10n ** 15n) throw new Error("Keeper gas is below 0.001 ETH");

    const oracle = await oraclePass(publicClient, walletClient);
    const liquidations = await liquidationPass(publicClient, walletClient, account);
    console.log(
      "keeper_success",
      JSON.stringify({ oracle, liquidations, ranAt: new Date().toISOString() }),
    );
    return res.status(200).json({
      ok: true,
      ranAt: new Date().toISOString(),
      oracle,
      liquidations,
    });
  } catch (error) {
    console.error("keeper_failed", error);
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Keeper failed",
    });
  }
}
