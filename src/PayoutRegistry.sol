// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ZcashAddress} from "./ZcashAddress.sol";

/**
 * @title PayoutRegistry
 * @notice Maps a Robinhood Chain address to the Zcash transparent address its ZEC should go to.
 *
 * Zcash is a separate chain, so a holder's Robinhood Chain address tells us nothing about where
 * to send their ZEC. They have to tell us, and that registration is the one step that cannot be
 * derived on-chain.
 *
 * Only the versioned payload (2-byte version + 20-byte hash160) is stored, which packs into a
 * single storage slot. The payout job re-encodes it to Base58Check off-chain, so keeping the
 * original 35-character string in storage would be redundant. The full string is emitted in
 * {PayoutAddressSet} for auditability and for indexers.
 */
contract PayoutRegistry {
    using ZcashAddress for string;

    /// @dev No payout address is registered for this holder.
    error NotRegistered(address holder);

    /**
     * @notice Emitted when a holder sets or changes their payout address.
     * @param holder The Robinhood Chain address that registered.
     * @param versionedPayload The 22-byte version + hash160, as stored.
     * @param encoded The full Base58Check address, for indexers and audit trails.
     */
    event PayoutAddressSet(address indexed holder, bytes22 versionedPayload, string encoded);

    /// @notice Emitted when a holder removes their payout address.
    event PayoutAddressCleared(address indexed holder);

    /// @dev Holder to 22-byte versioned payload. Zero means unregistered.
    mapping(address holder => bytes22 versionedPayload) private _payouts;

    /// @notice Number of distinct holders currently registered, for dashboard display.
    uint256 public registeredCount;

    /**
     * @notice Registers or updates the caller's Zcash payout address.
     * @dev Reverts with a specific {ZcashAddress} error if the address is malformed, so the UI can
     * explain exactly what is wrong rather than showing a generic failure.
     * @param encoded A Zcash mainnet transparent address, e.g. `t1...` or `t3...`.
     */
    function setPayoutAddress(string calldata encoded) external {
        (bytes2 version, bytes20 hash160) = encoded.validate();
        // Pack as version (high 2 bytes) || hash160 (low 20 bytes) into one slot.
        bytes22 versionedPayload = bytes22(uint176(uint16(version)) << 160 | uint176(uint160(hash160)));

        if (_payouts[msg.sender] == bytes22(0)) ++registeredCount;
        _payouts[msg.sender] = versionedPayload;

        emit PayoutAddressSet(msg.sender, versionedPayload, encoded);
    }

    /// @notice Removes the caller's payout address, opting them out of future distributions.
    function clearPayoutAddress() external {
        if (_payouts[msg.sender] == bytes22(0)) revert NotRegistered(msg.sender);

        delete _payouts[msg.sender];
        --registeredCount;

        emit PayoutAddressCleared(msg.sender);
    }

    /// @notice Returns the stored versioned payload for `holder`, reverting if unregistered.
    function payoutOf(address holder) external view returns (bytes2 version, bytes20 hash160) {
        bytes22 versionedPayload = _payouts[holder];
        if (versionedPayload == bytes22(0)) revert NotRegistered(holder);

        return (bytes2(versionedPayload), bytes20(uint160(uint176(versionedPayload))));
    }

    /// @notice Returns the raw stored payload, or zero if `holder` is not registered.
    function rawPayoutOf(address holder) external view returns (bytes22) {
        return _payouts[holder];
    }

    /// @notice Whether `holder` has a payout address registered.
    function isRegistered(address holder) external view returns (bool) {
        return _payouts[holder] != bytes22(0);
    }

    /**
     * @notice Checks an address without registering it, so the UI can validate as the user types.
     * @dev Pure view; costs the caller nothing when called off-chain.
     */
    function isValidPayoutAddress(string calldata encoded) external pure returns (bool) {
        return encoded.isValid();
    }
}
