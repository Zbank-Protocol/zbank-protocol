import crypto from "node:crypto";
import { decodeAbiParameters } from "viem";

export function generateAuthHeaders(apiKey, apiSecret, method, url, body = "", timestamp = Date.now()) {
  if (!apiKey || !apiSecret) throw new Error("Data Streams credentials are required");
  const parsed = new URL(url);
  const pathWithQuery = parsed.pathname + parsed.search;
  const bodyHash = crypto.createHash("sha256").update(body).digest("hex");
  const preimage = `${method.toUpperCase()} ${pathWithQuery} ${bodyHash} ${apiKey} ${timestamp}`;
  const signature = crypto.createHmac("sha256", apiSecret).update(preimage).digest("hex");
  return {
    Authorization: apiKey,
    "X-Authorization-Timestamp": String(timestamp),
    "X-Authorization-Signature-SHA256": signature,
  };
}

export function shouldRefresh({ ageSec, deviationBps, refreshSeconds, maxDeviationBps }) {
  return ageSec > refreshSeconds || deviationBps > maxDeviationBps;
}

/** Decode observationsTimestamp + price out of a Chainlink V3 full report blob. */
export function decodeReport(fullReport) {
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
