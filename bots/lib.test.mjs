import assert from "node:assert/strict";
import test from "node:test";
import { encodeAbiParameters } from "viem";
import {
  decodeReport,
  generateAuthHeaders,
  makeApprovedHashSignature,
  shouldRefresh,
} from "./lib.mjs";

test("generateAuthHeaders matches the Chainlink HMAC contract", () => {
  const headers = generateAuthHeaders(
    "clientId",
    "userSecret",
    "GET",
    "https://api.example.com/api/v1/feeds?feedID=0x123",
    "",
    1718885772000,
  );

  assert.deepEqual(headers, {
    Authorization: "clientId",
    "X-Authorization-Timestamp": "1718885772000",
    "X-Authorization-Signature-SHA256":
      "8c13831311bec9c7b5206da8b42e0fcb442e93d8bcc8642bf6f0ab1997a05f6d",
  });
});

test("generateAuthHeaders rejects missing credentials", () => {
  assert.throws(
    () => generateAuthHeaders("", "secret", "GET", "https://api.example.com/test"),
    /credentials are required/,
  );
});

test("shouldRefresh requires age or deviation to cross its threshold", () => {
  assert.equal(
    shouldRefresh({ ageSec: 600, deviationBps: 10, refreshSeconds: 900, maxDeviationBps: 50 }),
    false,
  );
  assert.equal(
    shouldRefresh({ ageSec: 901, deviationBps: 10, refreshSeconds: 900, maxDeviationBps: 50 }),
    true,
  );
  assert.equal(
    shouldRefresh({ ageSec: 600, deviationBps: 51, refreshSeconds: 900, maxDeviationBps: 50 }),
    true,
  );
});

test("makeApprovedHashSignature encodes owner in r with v=1", () => {
  const owner = "0x367fC81A2205587DF2ae6F9BA0af28EF75A88b07";
  const signature = makeApprovedHashSignature(owner);
  assert.equal(signature.length, 132);
  assert.equal(signature.slice(2, 66), owner.slice(2).toLowerCase().padStart(64, "0"));
  assert.equal(signature.slice(66, 130), "0".repeat(64));
  assert.equal(signature.slice(130), "01");
});

test("decodeReport returns the canonical price, not bid or ask", () => {
  const feedId = `0x${"12".repeat(32)}`;
  const reportData = encodeAbiParameters(
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
    [feedId, 100, 110, 1n, 2n, 120, 50n, 49n, 51n],
  );
  const fullReport = encodeAbiParameters(
    [{ type: "bytes32[3]" }, { type: "bytes" }],
    [[`0x${"00".repeat(32)}`, `0x${"01".repeat(32)}`, `0x${"02".repeat(32)}`], reportData],
  );

  assert.deepEqual(decodeReport(fullReport), {
    feedId,
    observationsTimestamp: 110,
    price: 50n,
  });
});
