// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title ZcashAddress
 * @notice Base58Check validation for Zcash *transparent* payout addresses.
 *
 * Payouts are one-way and irreversible: ZEC sent to a mistyped address is gone.
 * Validating the Base58Check checksum on-chain means a holder cannot register a
 * destination that the payout job would later fail on or, worse, burn funds to.
 *
 * Only transparent addresses are accepted. Robinhood's brokerage withdraws ZEC to
 * transparent addresses only, and the cross-chain swap routes (NEAR Intents, Maya)
 * likewise settle to transparent addresses, so shielded and unified addresses are
 * out of scope and are rejected rather than silently mishandled.
 *
 * A Zcash mainnet transparent address decodes to exactly 26 bytes:
 *   [0:2]   two-byte version prefix (0x1CB8 = P2PKH "t1", 0x1CBD = P2SH "t3")
 *   [2:22]  20-byte hash160 payload
 *   [22:26] first 4 bytes of sha256(sha256(version || payload))
 *
 * Because 26 bytes is 208 bits, the decoded address fits in a single word and the
 * Base58 conversion is a plain Horner evaluation rather than a big-integer loop.
 */
library ZcashAddress {
    /// @dev Encoded address was not the 35 characters a 26-byte Base58Check payload always produces.
    error InvalidLength(uint256 length);
    /// @dev Character is outside the Base58 alphabet (`0`, `O`, `I` and `l` are excluded by design).
    error InvalidCharacter();
    /// @dev Version prefix was neither P2PKH (`t1`) nor P2SH (`t3`).
    error UnsupportedVersion(bytes2 version);
    /// @dev Base58Check checksum did not match, i.e. the address contains a typo.
    error BadChecksum();

    /// @dev Version prefix for a transparent P2PKH address, rendered as `t1...`.
    bytes2 internal constant VERSION_P2PKH = 0x1cb8;
    /// @dev Version prefix for a transparent P2SH address, rendered as `t3...`.
    bytes2 internal constant VERSION_P2SH = 0x1cbd;

    /// @dev Every Zcash transparent address encodes to exactly this many Base58 characters.
    uint256 private constant ENCODED_LENGTH = 35;

    /// @dev Outcome of {_parse}, so {validate} and {isValid} share one implementation.
    enum Status {
        Valid,
        WrongLength,
        BadCharacter,
        WrongVersion,
        ChecksumMismatch
    }

    /**
     * @notice Validates a Zcash transparent address, reverting with a specific reason if malformed.
     * @param encoded The Base58Check address, e.g. `t1PZ...`.
     * @return version The two-byte version prefix.
     * @return payload The 20-byte hash160.
     */
    function validate(string memory encoded) internal pure returns (bytes2 version, bytes20 payload) {
        Status status;
        (status, version, payload) = _parse(encoded);

        if (status == Status.Valid) return (version, payload);
        if (status == Status.WrongLength) revert InvalidLength(bytes(encoded).length);
        if (status == Status.BadCharacter) revert InvalidCharacter();
        if (status == Status.WrongVersion) revert UnsupportedVersion(version);
        revert BadChecksum();
    }

    /// @notice Non-reverting form of {validate}, for read paths and UI pre-checks.
    function isValid(string memory encoded) internal pure returns (bool) {
        (Status status,,) = _parse(encoded);
        return status == Status.Valid;
    }

    /**
     * @dev Decodes and checks the address.
     *
     * The accumulator cannot overflow: the largest 35-character Base58 value is 58**35 - 1, which is
     * below 2**206, so it always fits both in a word and in the 26 bytes a transparent address holds.
     *
     * Leading-zero handling is deliberately omitted. Base58Check would encode a leading zero byte as
     * the character `1`, but a transparent address's version prefix starts at 0x1C, so any such input
     * simply fails the version or checksum check instead.
     */
    function _parse(string memory encoded) private pure returns (Status, bytes2 version, bytes20 payload) {
        bytes memory input = bytes(encoded);
        if (input.length != ENCODED_LENGTH) return (Status.WrongLength, 0, 0);

        uint256 value;
        for (uint256 i = 0; i < ENCODED_LENGTH; ++i) {
            uint256 digit = _base58Digit(input[i]);
            if (digit == type(uint256).max) return (Status.BadCharacter, 0, 0);
            value = value * 58 + digit;
        }

        // Byte j of the 26-byte big-endian value sits at bit offset 8 * (25 - j).
        version = bytes2(uint16(value >> 192));
        if (version != VERSION_P2PKH && version != VERSION_P2SH) return (Status.WrongVersion, version, 0);

        // Bytes [0:22] are the version and payload; bytes [22:26] are the checksum.
        // Base58Check uses a double SHA-256 over the versioned payload.
        bytes22 versionedPayload = bytes22(uint176(value >> 32));
        bytes4 expected = bytes4(sha256(abi.encodePacked(sha256(abi.encodePacked(versionedPayload)))));
        if (expected != bytes4(uint32(value))) return (Status.ChecksumMismatch, version, 0);

        return (Status.Valid, version, bytes20(uint160(value >> 32)));
    }

    /**
     * @dev Maps a Base58 character to its value, or `type(uint256).max` if not in the alphabet
     * `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`.
     */
    function _base58Digit(bytes1 character) private pure returns (uint256) {
        uint8 c = uint8(character);
        if (c >= 0x31 && c <= 0x39) return c - 0x31; // '1'-'9' -> 0..8
        if (c >= 0x41 && c <= 0x48) return c - 0x41 + 9; // 'A'-'H' -> 9..16
        if (c >= 0x4a && c <= 0x4e) return c - 0x4a + 17; // 'J'-'N' -> 17..21 ('I' excluded)
        if (c >= 0x50 && c <= 0x5a) return c - 0x50 + 22; // 'P'-'Z' -> 22..32 ('O' excluded)
        if (c >= 0x61 && c <= 0x6b) return c - 0x61 + 33; // 'a'-'k' -> 33..43
        if (c >= 0x6d && c <= 0x7a) return c - 0x6d + 44; // 'm'-'z' -> 44..57 ('l' excluded)
        return type(uint256).max;
    }
}
