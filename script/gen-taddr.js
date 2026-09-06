const crypto = require('crypto');
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function b58encode(buf) {
  let num = BigInt('0x' + buf.toString('hex'));
  let out = '';
  while (num > 0n) { out = ALPHABET[Number(num % 58n)] + out; num /= 58n; }
  for (const b of buf) { if (b === 0) out = ALPHABET[0] + out; else break; }
  return out;
}
function sha256(b) { return crypto.createHash('sha256').update(b).digest(); }

function makeTAddr(versionHex, hash160) {
  const version = Buffer.from(versionHex, 'hex');
  const payload = Buffer.concat([version, hash160]);
  const checksum = sha256(sha256(payload)).subarray(0, 4);
  const full = Buffer.concat([payload, checksum]);
  return {
    addr: b58encode(full),
    hash160: '0x' + hash160.toString('hex'),
    version: '0x' + versionHex,
    decodedLen: full.length,
  };
}

const vectors = [];
// Deterministic hash160s so the test vectors are stable and reproducible.
for (const seed of ['zec-payout-1', 'zec-payout-2', 'zec-payout-3']) {
  const h = crypto.createHash('sha256').update(seed).digest().subarray(0, 20);
  vectors.push({ kind: 'P2PKH (t1)', ...makeTAddr('1cb8', h), seed });
}
for (const seed of ['zec-script-1', 'zec-script-2']) {
  const h = crypto.createHash('sha256').update(seed).digest().subarray(0, 20);
  vectors.push({ kind: 'P2SH (t3)', ...makeTAddr('1cbd', h), seed });
}
// Edge case: all-zero hash160 (checks that interior zero bytes decode correctly)
vectors.push({ kind: 'P2PKH all-zero payload', ...makeTAddr('1cb8', Buffer.alloc(20, 0)), seed: 'zeros' });
// Edge case: all-0xff hash160
vectors.push({ kind: 'P2PKH all-ff payload', ...makeTAddr('1cb8', Buffer.alloc(20, 0xff)), seed: 'ffs' });

for (const v of vectors) {
  console.log(`${v.kind.padEnd(24)} len=${v.addr.length} decoded=${v.decodedLen} ${v.addr}  hash160=${v.hash160}`);
}

console.log('\n--- negative vectors ---');
// Valid Base58Check but an unrecognised Zcash version prefix (still 26 bytes / 35 chars).
const h = crypto.createHash('sha256').update('wrong-version').digest().subarray(0, 20);
const wrong = makeTAddr('1cff', h);
console.log(`bad version 0x1cff       len=${wrong.addr.length} ${wrong.addr}`);
// Valid checksum, testnet prefix (0x1D25 = "tm..."), which we intentionally reject.
const h2 = crypto.createHash('sha256').update('testnet').digest().subarray(0, 20);
const tm = makeTAddr('1d25', h2);
console.log(`testnet 0x1d25           len=${tm.addr.length} ${tm.addr}`);
