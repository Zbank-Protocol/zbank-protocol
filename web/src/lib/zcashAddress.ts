/**
 * Client-side mirror of `ZcashAddress.sol`, so the field can validate as the user types
 * instead of waiting on an RPC round-trip or, worse, on a reverted transaction.
 *
 * This must agree with the contract exactly. If they ever disagree, the contract wins —
 * it is the one that decides whether a payout address is stored.
 */

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ENCODED_LENGTH = 35;

/** Zcash mainnet transparent version prefixes. */
const VERSION_P2PKH = 0x1cb8; // "t1..."
const VERSION_P2SH = 0x1cbd; // "t3..."

export type AddressCheck =
  | { ok: true; kind: "P2PKH" | "P2SH" }
  | { ok: false; reason: string };

function base58Digit(char: string): number {
  const index = ALPHABET.indexOf(char);
  return index;
}

async function doubleSha256(bytes: Uint8Array): Promise<Uint8Array> {
  const first = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  const second = await crypto.subtle.digest("SHA-256", first);
  return new Uint8Array(second);
}

/**
 * Validates a Zcash transparent address.
 *
 * Async because it uses WebCrypto for SHA-256 rather than shipping a hash implementation.
 * A 26-byte value exceeds `Number.MAX_SAFE_INTEGER`, so the Base58 conversion uses BigInt,
 * matching the single-word Horner evaluation the contract does.
 */
export async function checkZcashAddress(input: string): Promise<AddressCheck> {
  const trimmed = input.trim();

  if (trimmed.length === 0) return { ok: false, reason: "" };
  if (trimmed.length !== ENCODED_LENGTH) {
    return {
      ok: false,
      reason: `Transparent addresses are ${ENCODED_LENGTH} characters; this is ${trimmed.length}`,
    };
  }

  let value = 0n;
  for (const char of trimmed) {
    const digit = base58Digit(char);
    if (digit < 0) {
      return { ok: false, reason: `"${char}" is not a Base58 character` };
    }
    value = value * 58n + BigInt(digit);
  }

  // Unpack the 26-byte big-endian value: 2 version, 20 payload, 4 checksum.
  const decoded = new Uint8Array(26);
  let remaining = value;
  for (let i = 25; i >= 0; i--) {
    decoded[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  if (remaining !== 0n) return { ok: false, reason: "Address decodes to more than 26 bytes" };

  const version = (decoded[0] << 8) | decoded[1];
  if (version !== VERSION_P2PKH && version !== VERSION_P2SH) {
    return {
      ok: false,
      reason: "Not a Zcash mainnet transparent address — it must start with t1 or t3",
    };
  }

  const checksum = await doubleSha256(decoded.subarray(0, 22));
  for (let i = 0; i < 4; i++) {
    if (checksum[i] !== decoded[22 + i]) {
      return { ok: false, reason: "Checksum failed — there is a typo in this address" };
    }
  }

  return { ok: true, kind: version === VERSION_P2PKH ? "P2PKH" : "P2SH" };
}

/**
 * Re-encodes the 22 bytes the registry stores back into a displayable address.
 *
 * `PayoutRegistry` keeps only the version and hash160 so the record fits one storage slot,
 * which means the original 35-character string exists nowhere on-chain. Anything that shows
 * a holder their own saved address has to rebuild it, checksum included.
 *
 * @param versionedPayload 22 bytes as `0x`-prefixed hex: 2 version + 20 hash160.
 */
export async function encodeTransparentAddress(versionedPayload: string): Promise<string | null> {
  const hex = versionedPayload.startsWith("0x") ? versionedPayload.slice(2) : versionedPayload;
  if (hex.length !== 44 || !/^[0-9a-fA-F]+$/.test(hex)) return null;

  const payload = new Uint8Array(22);
  for (let i = 0; i < 22; i++) {
    payload[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  // An all-zero slot means "unregistered", not "the zero address".
  if (payload.every((byte) => byte === 0)) return null;

  const checksum = await doubleSha256(payload);

  let value = 0n;
  for (const byte of payload) value = (value << 8n) | BigInt(byte);
  for (let i = 0; i < 4; i++) value = (value << 8n) | BigInt(checksum[i]);

  let encoded = "";
  while (value > 0n) {
    encoded = ALPHABET[Number(value % 58n)] + encoded;
    value /= 58n;
  }

  return encoded;
}

/** Shortens an address for display without hiding the checksum characters. */
export function abbreviate(address: string, lead = 10, tail = 6): string {
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}
