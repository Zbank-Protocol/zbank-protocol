// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ZecUsdDataStreamFeed} from "../src/oracle/ZecUsdDataStreamFeed.sol";
import {ZCredit} from "../src/ZCredit.sol";
import {MockERC20} from "./mocks/Mocks.sol";

/// @notice Verifier stand-in: returns the "verified" report it was primed with, mimicking a
///         successful DON signature check. No fee manager (address(0)), like a waived tier.
contract MockVerifierProxy {
    bytes public nextReport;
    bool public shouldRevert;

    function prime(bytes memory report) external {
        nextReport = report;
    }

    function setRevert(bool v) external {
        shouldRevert = v;
    }

    function s_feeManager() external pure returns (address) {
        return address(0);
    }

    function verify(bytes calldata, bytes calldata) external payable returns (bytes memory) {
        require(!shouldRevert, "verifier: bad signatures");
        return nextReport;
    }
}

contract ZecUsdDataStreamFeedTest is Test {
    bytes32 constant FEED_ID = 0x00039f8a144f4a62715ca60aec1cf848c4821375c57e2259c6c90b7fa49db693;

    MockVerifierProxy verifier;
    ZecUsdDataStreamFeed feed;

    function setUp() public {
        vm.warp(1_800_000_000);
        verifier = new MockVerifierProxy();
        feed = new ZecUsdDataStreamFeed(address(verifier), FEED_ID, 30 minutes, address(0));
    }

    function _report(bytes32 id, int192 price, uint32 observedAt, uint32 expiresAt)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(
            ZecUsdDataStreamFeed.ReportV3({
                feedId: id,
                validFromTimestamp: observedAt,
                observationsTimestamp: observedAt,
                nativeFee: 0,
                linkFee: 0,
                expiresAt: expiresAt,
                price: price,
                bid: price,
                ask: price
            })
        );
    }

    function _push(int192 price) internal {
        verifier.prime(_report(FEED_ID, price, uint32(block.timestamp), uint32(block.timestamp + 1 days)));
        feed.updatePrice("");
    }

    function test_update_and_read() public {
        _push(50e18);
        assertEq(feed.priceUsd(), 50e18);
    }

    function test_no_price_yet_reverts() public {
        vm.expectRevert(ZecUsdDataStreamFeed.NoPriceYet.selector);
        feed.priceUsd();
    }

    function test_staleness_enforced() public {
        _push(50e18);
        skip(31 minutes);
        vm.expectRevert(
            abi.encodeWithSelector(
                ZecUsdDataStreamFeed.StalePrice.selector, block.timestamp - 31 minutes, 30 minutes
            )
        );
        feed.priceUsd();
    }

    function test_wrong_feed_rejected() public {
        verifier.prime(_report(bytes32(uint256(1)), 50e18, uint32(block.timestamp), uint32(block.timestamp + 1)));
        vm.expectRevert(
            abi.encodeWithSelector(ZecUsdDataStreamFeed.WrongFeed.selector, bytes32(uint256(1)), FEED_ID)
        );
        feed.updatePrice("");
    }

    function test_rollback_rejected() public {
        _push(50e18);
        // A genuine but older report cannot overwrite a newer price.
        verifier.prime(
            _report(FEED_ID, 10e18, uint32(block.timestamp - 10), uint32(block.timestamp + 1 days))
        );
        vm.expectRevert(
            abi.encodeWithSelector(
                ZecUsdDataStreamFeed.NotNewer.selector, uint32(block.timestamp - 10), uint32(block.timestamp)
            )
        );
        feed.updatePrice("");
    }

    function test_zero_and_negative_price_rejected() public {
        verifier.prime(_report(FEED_ID, 0, uint32(block.timestamp), uint32(block.timestamp + 1)));
        vm.expectRevert(abi.encodeWithSelector(ZecUsdDataStreamFeed.InvalidPrice.selector, int192(0)));
        feed.updatePrice("");
    }

    function test_expired_report_rejected() public {
        verifier.prime(_report(FEED_ID, 50e18, uint32(block.timestamp), uint32(block.timestamp - 1)));
        vm.expectRevert(
            abi.encodeWithSelector(ZecUsdDataStreamFeed.ReportExpired.selector, uint32(block.timestamp - 1))
        );
        feed.updatePrice("");
    }

    function test_unverified_report_rejected() public {
        verifier.setRevert(true);
        vm.expectRevert("verifier: bad signatures");
        feed.updatePrice("");
    }

    /// @notice End to end: the credit market prices zZEC collateral through the stream feed.
    function test_zcredit_reads_through_stream_feed() public {
        MockERC20 zzec = new MockERC20("ZEAL Wrapped ZEC", "zZEC", 8);
        MockERC20 usdg = new MockERC20("Global Dollar", "USDG", 6);
        ZCredit market = new ZCredit(address(zzec), address(usdg), address(feed), makeAddr("admin"));

        _push(50e18); // ZEC = $50

        address lender = makeAddr("lender");
        address borrower = makeAddr("borrower");
        usdg.mint(lender, 100_000e6);
        zzec.mint(borrower, 1_000e8);

        vm.startPrank(lender);
        usdg.approve(address(market), type(uint256).max);
        market.supply(100_000e6);
        vm.stopPrank();

        vm.startPrank(borrower);
        zzec.approve(address(market), type(uint256).max);
        market.depositCollateral(1_000e8); // $50k
        market.borrow(25_000e6); // exactly max LTV
        vm.stopPrank();
        assertEq(usdg.balanceOf(borrower), 25_000e6);

        // Stream goes stale → new borrowing halts, exactly as designed.
        skip(31 minutes);
        vm.prank(borrower);
        vm.expectRevert();
        market.borrow(1e6);
    }
}
