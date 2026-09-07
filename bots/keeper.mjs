#!/usr/bin/env node
/**
 * ZBANK keeper — one pass, then exit. Designed for a 5-minute cron (GitHub Actions).
 *
 * Pass 1 — oracle: if the onchain ZEC/USD price is older than REFRESH_SECONDS or has
 *   deviated more than DEVIATION_BPS from the latest Data Streams report, verify a fresh
 *   signed report onchain via ZecUsdDataStreamFeed.updatePrice().
 * Pass 2 — liquidations: rebuild the borrower set from Borrowed events, check every
 *   health factor, and liquidate underwater positions with whatever USDG the keeper holds.
 *
 * Required env:
 *   KEEPER_PRIVATE_KEY      funded EOA (gas; USDG balance enables liquidations)
 *   DATASTREAMS_API_KEY     Chainlink Data Streams credentials
 *   DATASTREAMS_API_SECRET
 * Optional env:
 *   RPC_URL (default Robinhood Chain mainnet), REFRESH_SECONDS (900),
 *   DEVIATION_BPS (50), MAX_LIQUIDATIONS (3)
 */
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  parseAbi,
  parseAbiItem,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { decodeReport, generateAuthHeaders, shouldRefresh } from "./lib.mjs";

/* ------------------------------- fixed wiring ------------------------------- */

const CHAIN = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com"] } },
};

const MARKET = "0x77ccb77d1fd337b7027b3482ca365db57d92151e";
const FEED = "0x931F6295bf6aB9Dc02997a03b4ba85Aca9373AF5";
const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const DEPLOY_BLOCK = 56922998n;
const STREAM_FEED_ID = "0x00039f8a144f4a62715ca60aec1cf848c4821375c57e2259c6c90b7fa49db693";
const DATASTREAMS_HOST = "https://api.dataengine.chain.link";

const REFRESH_SECONDS = Number(process.env.REFRESH_SECONDS ?? 900);
const DEVIATION_BPS = Number(process.env.DEVIATION_BPS ?? 50);
const MAX_LIQUIDATIONS = Number(process.env.MAX_LIQUIDATIONS ?? 3);
const WAD = 10n ** 18n;

const FEED_ABI = parseAbi([
  "function lastPrice() view returns (int192)",
  "function lastObservedAt() view returns (uint32)",
  "function quoteFee(bytes signedReport) view returns (uint256)",
  "function updatePrice(bytes signedReport) payable",
]);

const MARKET_ABI = parseAbi([
  "function healthFactor(address borrower) view returns (uint256)",
  "function debtOf(address borrower) view returns (uint256)",
  "function collateralOf(address borrower) view returns (uint256)",
  "function liquidate(address borrower, uint256 repayAmount)",
]);

const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address, address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
]);

const BORROWED_EVENT = parseAbiItem("event Borrowed(address indexed borrower, uint256 amount)");

/* --------------------------------- clients --------------------------------- */

const pk = process.env.KEEPER_PRIVATE_KEY;
if (!pk) {
  console.error("KEEPER_PRIVATE_KEY is required");
  process.exit(1);
}
const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
const pub = createPublicClient({ chain: CHAIN, transport: http() });
const wallet = createWalletClient({ chain: CHAIN, transport: http(), account });

const log = (...a) => console.log(new Date().toISOString(), ...a);

/* ------------------------------ oracle relay ------------------------------ */

async function fetchLatestReport() {
  const key = process.env.DATASTREAMS_API_KEY;
  const secret = process.env.DATASTREAMS_API_SECRET;
  if (!key || !secret) throw new Error("no Data Streams credentials in env");

  const path = `/api/v1/reports/latest?feedID=${STREAM_FEED_ID}`;
  const url = `${DATASTREAMS_HOST}${path}`;

  const res = await fetch(url, { headers: generateAuthHeaders(key, secret, "GET", url) });
  const body = await res.text();
  if (!res.ok) throw new Error(`Data Streams HTTP ${res.status}: ${body.slice(0, 200)}`);
  return { fullReport: JSON.parse(body).report.fullReport };
}

async function oraclePass() {
  const [lastPrice, lastObservedAt] = await Promise.all([
    pub.readContract({ address: FEED, abi: FEED_ABI, functionName: "lastPrice" }),
    pub.readContract({ address: FEED, abi: FEED_ABI, functionName: "lastObservedAt" }),
  ]);
  const ageSec = lastObservedAt === 0 ? Infinity : Math.floor(Date.now() / 1000) - lastObservedAt;
  log(
    `oracle: onchain price=${lastObservedAt === 0 ? "none" : formatUnits(lastPrice, 18)} age=${ageSec === Infinity ? "∞" : ageSec + "s"}`,
  );

  const report = await fetchLatestReport();
  const fresh = decodeReport(report.fullReport);
  if (fresh.feedId !== STREAM_FEED_ID) {
    throw new Error(`feed ID mismatch ${fresh.feedId}`);
  }

  let deviationBps = Infinity;
  if (lastObservedAt !== 0 && lastPrice > 0n) {
    const diff = fresh.price > lastPrice ? fresh.price - lastPrice : lastPrice - fresh.price;
    deviationBps = Number((diff * 10000n) / lastPrice);
  }
  if (!shouldRefresh({ ageSec, deviationBps, refreshSeconds: REFRESH_SECONDS, maxDeviationBps: DEVIATION_BPS })) {
    log(`oracle: fresh enough (deviation ${deviationBps}bps) — no update`);
    return;
  }

  const fee = await pub.readContract({
    address: FEED,
    abi: FEED_ABI,
    functionName: "quoteFee",
    args: [report.fullReport],
  });
  const hash = await wallet.writeContract({
    address: FEED,
    abi: FEED_ABI,
    functionName: "updatePrice",
    args: [report.fullReport],
    value: fee,
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  log(
    `oracle: UPDATED to ${formatUnits(fresh.price, 18)} (fee ${formatUnits(fee, 18)} ETH, tx ${hash}, ${receipt.status})`,
  );
}

/* ---------------------------- liquidation watch ---------------------------- */

async function liquidationPass() {
  const logs = await pub.getLogs({
    address: MARKET,
    event: BORROWED_EVENT,
    fromBlock: DEPLOY_BLOCK,
    toBlock: "latest",
  });
  const borrowers = [...new Set(logs.map((l) => l.args.borrower))];
  log(`liquidations: ${borrowers.length} borrower(s) on record`);
  if (borrowers.length === 0) return;

  let usdgBalance = await pub.readContract({
    address: USDG,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });

  let done = 0;
  for (const borrower of borrowers) {
    if (done >= MAX_LIQUIDATIONS) break;
    const [hf, debt] = await Promise.all([
      pub.readContract({ address: MARKET, abi: MARKET_ABI, functionName: "healthFactor", args: [borrower] }),
      pub.readContract({ address: MARKET, abi: MARKET_ABI, functionName: "debtOf", args: [borrower] }),
    ]);
    if (debt === 0n) continue;
    const hfStr = hf === 2n ** 256n - 1n ? "∞" : formatUnits(hf, 18);
    if (hf >= WAD) {
      log(`  ${borrower} hf=${hfStr} — healthy`);
      continue;
    }

    // Underwater. liquidate() lets us repay up to half the debt.
    const maxRepay = debt / 2n > 0n ? debt / 2n : debt;
    const repay = usdgBalance < maxRepay ? usdgBalance : maxRepay;
    log(`  ${borrower} hf=${hfStr} UNDERWATER debt=${formatUnits(debt, 6)} USDG, repaying ${formatUnits(repay, 6)}`);
    if (repay === 0n) {
      throw new Error("keeper holds no USDG while an underwater borrower requires liquidation");
    }

    const allowance = await pub.readContract({
      address: USDG,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [account.address, MARKET],
    });
    if (allowance < repay) {
      const approveHash = await wallet.writeContract({
        address: USDG,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [MARKET, 2n ** 256n - 1n],
      });
      await pub.waitForTransactionReceipt({ hash: approveHash });
    }
    try {
      const hash = await wallet.writeContract({
        address: MARKET,
        abi: MARKET_ABI,
        functionName: "liquidate",
        args: [borrower, repay],
      });
      const receipt = await pub.waitForTransactionReceipt({ hash });
      log(`  LIQUIDATED ${borrower}: repaid ${formatUnits(repay, 6)} USDG (tx ${hash}, ${receipt.status})`);
      usdgBalance -= repay;
      done++;
    } catch (err) {
      log(`  liquidate(${borrower}) reverted: ${err.shortMessage ?? err.message}`);
    }
  }
}

/* ---------------------------------- main ---------------------------------- */

const gas = await pub.getBalance({ address: account.address });
log(`keeper ${account.address} gas=${formatUnits(gas, 18)} ETH`);
if (gas < 10n ** 15n) {
  log("FATAL: keeper gas below 0.001 ETH");
  process.exit(1);
}

let failed = false;
try {
  await oraclePass();
} catch (err) {
  failed = true;
  log(`oracle pass FAILED: ${err.shortMessage ?? err.message}`);
}
try {
  await liquidationPass();
} catch (err) {
  failed = true;
  log(`liquidation pass FAILED: ${err.shortMessage ?? err.message}`);
}
process.exit(failed ? 1 : 0);
