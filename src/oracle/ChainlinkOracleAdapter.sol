// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPriceOracle} from "./IPriceOracle.sol";

/// @notice Minimal Chainlink AggregatorV3 surface (also matched by Redstone/API3 adapters).
interface IAggregatorV3 {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @title ChainlinkOracleAdapter — ZEC/USD with hard safety rails
/// @notice Wraps a Chainlink-style feed and enforces the failure modes named in the launch
///         checklist (Phase 2.2): stale rounds, zero/negative answers, and decimal
///         normalization. Any violation reverts — the consuming market treats a reverting
///         oracle as "borrowing and liquidation paused", never as "price is zero".
contract ChainlinkOracleAdapter is IPriceOracle {
    error StalePrice(uint256 updatedAt, uint256 maxAge);
    error InvalidPrice(int256 answer);
    error IncompleteRound();
    error SequencerDown();
    error SequencerGracePeriod(uint256 upSince);

    IAggregatorV3 public immutable feed;
    /// @notice Seconds after which the last update is considered stale (e.g. heartbeat + margin).
    uint256 public immutable maxAge;
    /// @notice Chainlink L2 sequencer uptime feed. Optional (zero = no check) — but on an
    ///         Orbit L2 a fresh-looking price during a sequencer outage is a lie, so wire it
    ///         the moment Chainlink publishes one for this chain.
    IAggregatorV3 public immutable sequencerFeed;
    /// @notice After the sequencer recovers, wait this long before trusting prices again.
    uint256 public constant SEQUENCER_GRACE = 1 hours;
    uint256 private immutable scale; // multiplier from feed decimals to 1e18

    constructor(address feed_, uint256 maxAge_, address sequencerFeed_) {
        require(feed_ != address(0), "oracle: zero feed");
        require(maxAge_ > 0 && maxAge_ <= 7 days, "oracle: bad maxAge");
        feed = IAggregatorV3(feed_);
        maxAge = maxAge_;
        sequencerFeed = IAggregatorV3(sequencerFeed_);
        uint8 dec = IAggregatorV3(feed_).decimals();
        require(dec <= 18, "oracle: feed decimals > 18");
        scale = 10 ** (18 - dec);
    }

    /// @inheritdoc IPriceOracle
    function priceUsd() external view returns (uint256) {
        checkSequencer(sequencerFeed);
        (uint80 roundId, int256 answer, , uint256 updatedAt, uint80 answeredInRound) = feed.latestRoundData();
        if (answer <= 0) revert InvalidPrice(answer);
        if (answeredInRound < roundId || updatedAt == 0) revert IncompleteRound();
        if (block.timestamp - updatedAt > maxAge) revert StalePrice(updatedAt, maxAge);
        return uint256(answer) * scale;
    }

    /// @notice Shared L2 sequencer gate (Chainlink convention: answer 0 = up, 1 = down;
    ///         startedAt = when the current status began). No feed → no check.
    function checkSequencer(IAggregatorV3 sequencer) internal view {
        if (address(sequencer) == address(0)) return;
        (, int256 status, uint256 startedAt,,) = sequencer.latestRoundData();
        if (status != 0) revert SequencerDown();
        if (block.timestamp - startedAt < SEQUENCER_GRACE) revert SequencerGracePeriod(startedAt);
    }
}
