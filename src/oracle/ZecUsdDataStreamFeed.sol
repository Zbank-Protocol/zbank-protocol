// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPriceOracle} from "./IPriceOracle.sol";
import {IAggregatorV3} from "./ChainlinkOracleAdapter.sol";

/// @notice Chainlink Data Streams verifier proxy (deployed on Robinhood Chain at
///         0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7 per docs.robinhood.com/chain/data-streams).
interface IVerifierProxy {
    function verify(bytes calldata payload, bytes calldata parameterPayload)
        external
        payable
        returns (bytes memory verifierResponse);
    function s_feeManager() external view returns (address);
}

/// @notice Minimal fee manager surface for the native-fee quote.
interface IVerifierFeeManager {
    struct Asset {
        address assetAddress;
        uint256 amount;
    }

    function i_nativeAddress() external view returns (address);
    function getFeeAndReward(address subscriber, bytes memory reportData, address quoteAddress)
        external
        view
        returns (Asset memory fee, Asset memory reward, uint256 discount);
}

/// @title ZecUsdDataStreamFeed — ZEC/USD onchain, from Chainlink Data Streams
/// @notice There is no ZEC/USD push feed on Robinhood Chain, but Chainlink runs a ZEC/USD
///         Data Stream (pull model). This contract is the bridge: anyone may submit a signed
///         report; the Chainlink verifier proxy checks the DON signatures onchain; only then
///         is the price stored. Trust therefore rests on Chainlink's verifier — not on
///         whoever happens to relay the report — which is why `updatePrice` is permissionless.
///
///         Consumers read through `priceUsd()`, which reverts on stale, unset, or invalid
///         data, matching the market's "no price → halt, never zero" rule.
/// @dev    Report schema V3 (crypto streams): price is int192 with 18 decimals — already the
///         WAD this protocol uses. Monotonic observation timestamps make replaying an old
///         (but genuine) report a no-op. NOT AUDITED.
contract ZecUsdDataStreamFeed is IPriceOracle {
    error WrongFeed(bytes32 got, bytes32 want);
    error InvalidPrice(int192 price);
    error ReportExpired(uint32 expiresAt);
    error NotNewer(uint32 got, uint32 have);
    error StalePrice(uint256 observedAt, uint256 maxAge);
    error NoPriceYet();
    error SequencerDown();
    error SequencerGracePeriod(uint256 upSince);

    event PriceUpdated(int192 price, uint32 observationsTimestamp);

    /// @dev Verified report, schema V3 (crypto streams).
    struct ReportV3 {
        bytes32 feedId;
        uint32 validFromTimestamp;
        uint32 observationsTimestamp;
        uint192 nativeFee;
        uint192 linkFee;
        uint32 expiresAt;
        int192 price;
        int192 bid;
        int192 ask;
    }

    IVerifierProxy public immutable verifier;
    /// @notice ZEC/USD-RefPrice-DS-Premium-Global-003 (mainnet feed ID).
    bytes32 public immutable feedId;
    /// @notice Seconds after which the stored price is considered stale.
    uint256 public immutable maxAge;
    /// @notice Optional Chainlink L2 sequencer uptime feed (zero = no check).
    IAggregatorV3 public immutable sequencerFeed;
    /// @notice After the sequencer recovers, wait this long before trusting prices again.
    uint256 public constant SEQUENCER_GRACE = 1 hours;

    int192 public lastPrice;
    uint32 public lastObservedAt;

    constructor(address verifier_, bytes32 feedId_, uint256 maxAge_, address sequencerFeed_) {
        require(verifier_ != address(0), "feed: zero verifier");
        require(feedId_ != bytes32(0), "feed: zero id");
        require(maxAge_ > 0 && maxAge_ <= 1 days, "feed: bad maxAge");
        verifier = IVerifierProxy(verifier_);
        feedId = feedId_;
        maxAge = maxAge_;
        sequencerFeed = IAggregatorV3(sequencerFeed_);
    }

    /// @notice Verify a signed Data Streams report through the Chainlink verifier and store
    ///         its price. Permissionless: validity comes from DON signatures, not the caller.
    ///         Send the native verification fee as msg.value (quote it via `quoteFee`).
    function updatePrice(bytes calldata signedReport) external payable {
        bytes memory parameterPayload;
        address feeManager = verifier.s_feeManager();
        if (feeManager != address(0)) {
            parameterPayload = abi.encode(IVerifierFeeManager(feeManager).i_nativeAddress());
        }
        bytes memory verified = verifier.verify{value: msg.value}(signedReport, parameterPayload);
        ReportV3 memory report = abi.decode(verified, (ReportV3));

        if (report.feedId != feedId) revert WrongFeed(report.feedId, feedId);
        if (report.price <= 0) revert InvalidPrice(report.price);
        if (report.expiresAt < block.timestamp) revert ReportExpired(report.expiresAt);
        if (report.observationsTimestamp <= lastObservedAt) {
            revert NotNewer(report.observationsTimestamp, lastObservedAt);
        }

        lastPrice = report.price;
        lastObservedAt = report.observationsTimestamp;
        emit PriceUpdated(report.price, report.observationsTimestamp);

        // Anything the verifier didn't take goes back to the relayer.
        if (address(this).balance > 0) {
            (bool ok,) = msg.sender.call{value: address(this).balance}("");
            ok; // refund failure must not block a valid price update
        }
    }

    /// @notice Native fee required to verify `reportData` right now (0 if no fee manager).
    function quoteFee(bytes calldata signedReport) external view returns (uint256) {
        address feeManager = verifier.s_feeManager();
        if (feeManager == address(0)) return 0;
        (, bytes memory reportData) = abi.decode(signedReport, (bytes32[3], bytes));
        (IVerifierFeeManager.Asset memory fee,,) = IVerifierFeeManager(feeManager)
            .getFeeAndReward(address(this), reportData, IVerifierFeeManager(feeManager).i_nativeAddress());
        return fee.amount;
    }

    /// @inheritdoc IPriceOracle
    function priceUsd() external view returns (uint256) {
        if (address(sequencerFeed) != address(0)) {
            (, int256 status, uint256 startedAt,,) = sequencerFeed.latestRoundData();
            if (status != 0) revert SequencerDown();
            if (block.timestamp - startedAt < SEQUENCER_GRACE) revert SequencerGracePeriod(startedAt);
        }
        if (lastObservedAt == 0) revert NoPriceYet();
        if (block.timestamp - lastObservedAt > maxAge) revert StalePrice(lastObservedAt, maxAge);
        return uint256(int256(lastPrice)); // V3 crypto reports are 18-decimal — already WAD
    }
}
