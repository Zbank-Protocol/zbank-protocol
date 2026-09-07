// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IPriceOracle — the protocol's internal price interface
/// @notice Returns the USD price of one whole unit of the asset, normalized to 1e18,
///         and reverts rather than returning anything stale, zero, or negative.
///         Consumers (ZCredit) never see a bad price — they see a revert and stay paused.
interface IPriceOracle {
    /// @return price USD per whole asset unit, 1e18 fixed point. Always > 0.
    function priceUsd() external view returns (uint256 price);
}
