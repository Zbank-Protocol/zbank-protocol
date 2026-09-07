// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ZCredit} from "../src/ZCredit.sol";
import {ChainlinkOracleAdapter} from "../src/oracle/ChainlinkOracleAdapter.sol";
import {MockERC20, MockAggregator} from "./mocks/Mocks.sol";

contract ZCreditTest is Test {
    MockERC20 zec; // 8 decimals, like most wrapped-ZEC representations
    MockERC20 usdg; // 6 decimals
    MockAggregator feed; // 8 decimals, Chainlink convention
    ChainlinkOracleAdapter oracle;
    ZCredit market;

    address admin = makeAddr("admin");
    address lender = makeAddr("lender");
    address borrower = makeAddr("borrower");
    address keeper = makeAddr("keeper");

    uint256 constant ZEC = 1e8;
    uint256 constant USDG = 1e6;

    function setUp() public {
        zec = new MockERC20("Wrapped ZEC", "wZEC", 8);
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        feed = new MockAggregator(8, 50e8); // ZEC = $50
        oracle = new ChainlinkOracleAdapter(address(feed), 1 hours, address(0));
        market = new ZCredit(address(zec), address(usdg), address(oracle), admin);

        usdg.mint(lender, 1_000_000 * USDG);
        zec.mint(borrower, 10_000 * ZEC);
        usdg.mint(keeper, 1_000_000 * USDG);

        vm.prank(lender);
        usdg.approve(address(market), type(uint256).max);
        vm.startPrank(borrower);
        zec.approve(address(market), type(uint256).max);
        usdg.approve(address(market), type(uint256).max);
        vm.stopPrank();
        vm.prank(keeper);
        usdg.approve(address(market), type(uint256).max);
    }

    function _seedPool(uint256 amount) internal {
        vm.prank(lender);
        market.supply(amount);
    }

    // ---------------------------------------------------------------- lender

    function test_supply_withdraw_roundtrip() public {
        _seedPool(100_000 * USDG);
        assertEq(market.balanceOfSupplied(lender), 100_000 * USDG);
        vm.prank(lender);
        market.withdraw(100_000 * USDG);
        assertEq(usdg.balanceOf(lender), 1_000_000 * USDG);
        assertEq(market.totalSupplyShares(), 0);
    }

    function test_withdraw_bounded_by_liquidity() public {
        _seedPool(100_000 * USDG);
        vm.startPrank(borrower);
        market.depositCollateral(4_000 * ZEC); // $200k collateral
        market.borrow(80_000 * USDG); // 40% LTV
        vm.stopPrank();
        vm.prank(lender);
        vm.expectRevert(abi.encodeWithSelector(ZCredit.InsufficientLiquidity.selector, 50_000 * USDG, 20_000 * USDG));
        market.withdraw(50_000 * USDG);
    }

    // -------------------------------------------------------------- borrower

    function test_borrow_within_ltv_and_blocked_beyond() public {
        _seedPool(100_000 * USDG);
        vm.startPrank(borrower);
        market.depositCollateral(1_000 * ZEC); // $50k at $50
        market.borrow(25_000 * USDG); // exactly max LTV (50%)
        vm.expectRevert(); // one more dollar breaches max LTV
        market.borrow(1 * USDG);
        vm.stopPrank();
        assertEq(usdg.balanceOf(borrower), 25_000 * USDG);
    }

    function test_interest_accrues_to_lenders_and_reserves() public {
        _seedPool(100_000 * USDG);
        vm.startPrank(borrower);
        market.depositCollateral(4_000 * ZEC);
        market.borrow(80_000 * USDG); // utilization 80% = kink
        vm.stopPrank();

        skip(365 days);
        market.accrue();

        // At the kink: base 0% + slopeLow 4% = 4% APR on 80k = 3.2k interest.
        uint256 debt = market.debtOf(borrower);
        assertApproxEqRel(debt, 83_200 * USDG, 0.001e18);
        // Reserve factor 10% of interest.
        assertApproxEqRel(market.totalReserves(), 320 * USDG, 0.001e18);
        // Lenders own the rest.
        assertApproxEqRel(market.balanceOfSupplied(lender), 102_880 * USDG, 0.001e18);
    }

    function test_full_repay_clears_position() public {
        _seedPool(100_000 * USDG);
        vm.startPrank(borrower);
        market.depositCollateral(1_000 * ZEC);
        market.borrow(20_000 * USDG);
        vm.stopPrank();
        skip(30 days);

        uint256 debt = market.debtOf(borrower);
        usdg.mint(borrower, debt); // cover accrued interest
        vm.startPrank(borrower);
        market.repay(borrower, type(uint256).max);
        assertEq(market.debtOf(borrower), 0);
        market.withdrawCollateral(1_000 * ZEC); // free after full repay
        vm.stopPrank();
        assertEq(zec.balanceOf(borrower), 10_000 * ZEC);
    }

    function test_collateral_withdraw_blocked_when_levered() public {
        _seedPool(100_000 * USDG);
        vm.startPrank(borrower);
        market.depositCollateral(1_000 * ZEC);
        market.borrow(25_000 * USDG); // at max LTV — nothing is free
        vm.expectRevert();
        market.withdrawCollateral(1 * ZEC);
        vm.stopPrank();
    }

    // ------------------------------------------------------------ liquidation

    function test_liquidation_flow() public {
        _seedPool(100_000 * USDG);
        vm.startPrank(borrower);
        market.depositCollateral(1_000 * ZEC); // $50k
        market.borrow(25_000 * USDG);
        vm.stopPrank();

        // Healthy: HF = 50k * 0.70 / 25k = 1.4
        assertApproxEqRel(market.healthFactor(borrower), 1.4e18, 0.001e18);
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(ZCredit.HealthyPosition.selector, 1.4e18));
        market.liquidate(borrower, 1_000 * USDG);

        // ZEC drops to $34: HF = 34k * 0.70 / 25k = 0.952 → liquidatable.
        feed.set(34e8, block.timestamp);
        assertLt(market.healthFactor(borrower), 1e18);

        // Close factor: at most half the debt.
        vm.prank(keeper);
        vm.expectRevert();
        market.liquidate(borrower, 20_000 * USDG);

        uint256 keeperZecBefore = zec.balanceOf(keeper);
        vm.prank(keeper);
        market.liquidate(borrower, 12_500 * USDG);

        // Seized = 12.5k * 1.08 / $34 = 397.058... ZEC
        uint256 seized = zec.balanceOf(keeper) - keeperZecBefore;
        assertApproxEqRel(seized, uint256(12_500e6) * 1.08e8 * 1e2 / 34e8, 0.001e18);
        assertApproxEqRel(market.debtOf(borrower), 12_500 * USDG, 0.001e18);
        // Health improved after the cut.
        assertGt(market.healthFactor(borrower), 1e18);
    }

    // ----------------------------------------------------------------- oracle

    function test_stale_oracle_blocks_borrowing() public {
        _seedPool(100_000 * USDG);
        vm.startPrank(borrower);
        market.depositCollateral(1_000 * ZEC);
        skip(2 hours); // beyond maxAge, no feed update
        vm.expectRevert(
            abi.encodeWithSelector(ChainlinkOracleAdapter.StalePrice.selector, block.timestamp - 2 hours, 1 hours)
        );
        market.borrow(1_000 * USDG);
        vm.stopPrank();
    }

    function test_zero_price_reverts() public {
        feed.set(0, block.timestamp);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkOracleAdapter.InvalidPrice.selector, int256(0)));
        oracle.priceUsd();
    }

    // --------------------------------------------------------------- security

    /// @notice The classic first-depositor donation attack must not work: virtual shares
    ///         make donated balance unable to round later suppliers down to zero.
    function test_share_inflation_attack_neutralized() public {
        address attacker = makeAddr("attacker");
        address victim = makeAddr("victim");
        usdg.mint(attacker, 200_001 * USDG);
        usdg.mint(victim, 100_000 * USDG);

        // Attacker: dust supply, then donate a fortune directly to the pool.
        vm.startPrank(attacker);
        usdg.approve(address(market), type(uint256).max);
        market.supply(1);
        usdg.transfer(address(market), 100_000 * USDG);
        vm.stopPrank();

        // Victim supplies normally — and must retain (essentially) full claim.
        vm.startPrank(victim);
        usdg.approve(address(market), type(uint256).max);
        market.supply(100_000 * USDG);
        vm.stopPrank();

        assertApproxEqRel(market.balanceOfSupplied(victim), 100_000 * USDG, 0.0001e18);
        // The attacker's donation is stranded in the pool, not stolen from the victim.
        assertLe(market.balanceOfSupplied(attacker), 100_001 * USDG);
    }

    function test_collateral_cap_enforced() public {
        vm.startPrank(borrower);
        market.depositCollateral(5_000 * ZEC); // exactly the launch cap
        vm.expectRevert(abi.encodeWithSelector(ZCredit.CollateralCapExceeded.selector, 5_001 * ZEC, 5_000 * ZEC));
        market.depositCollateral(1 * ZEC);
        vm.stopPrank();

        // The multisig raises the cap deliberately; deposits resume.
        vm.prank(admin);
        market.setCollateralCap(10_000 * ZEC);
        vm.prank(borrower);
        market.depositCollateral(1 * ZEC);
        assertEq(market.totalCollateral(), 5_001 * ZEC);
    }

    function test_sequencer_down_blocks_pricing() public {
        MockAggregator sequencer = new MockAggregator(0, 0); // 0 = up, fresh
        ChainlinkOracleAdapter guarded = new ChainlinkOracleAdapter(address(feed), 1 hours, address(sequencer));

        // Up, but inside the recovery grace period → blocked.
        vm.expectRevert();
        guarded.priceUsd();

        // Grace period passes → prices flow.
        skip(2 hours);
        feed.set(50e8, block.timestamp);
        assertEq(guarded.priceUsd(), 50e18);

        // Sequencer goes down → blocked immediately.
        sequencer.set(1, block.timestamp);
        vm.expectRevert(ChainlinkOracleAdapter.SequencerDown.selector);
        guarded.priceUsd();
    }

    // ------------------------------------------------------------------ admin

    function test_admin_rails_hold() public {
        vm.startPrank(admin);
        // LTV must sit strictly below the liquidation threshold.
        vm.expectRevert(ZCredit.ParamOutOfBounds.selector);
        market.setRiskParams(7_000, 7_000, 800, 1_000);
        // Threshold above 90% is out.
        vm.expectRevert(ZCredit.ParamOutOfBounds.selector);
        market.setRiskParams(5_000, 9_500, 800, 1_000);
        vm.stopPrank();
        // Non-owner can't touch params or pause.
        vm.expectRevert();
        market.setRiskParams(5_000, 7_000, 800, 1_000);
        vm.expectRevert();
        market.pause();
    }

    function test_reserve_sweep_only_reserves() public {
        _seedPool(100_000 * USDG);
        vm.startPrank(borrower);
        market.depositCollateral(4_000 * ZEC);
        market.borrow(80_000 * USDG);
        vm.stopPrank();
        skip(365 days);
        feed.set(50e8, block.timestamp);

        vm.prank(admin);
        uint256 swept = market.sweepReserves(admin);
        assertApproxEqRel(swept, 320 * USDG, 0.001e18);
        // Lender claims unaffected by the sweep.
        assertApproxEqRel(market.balanceOfSupplied(lender), 102_880 * USDG, 0.001e18);
    }

    function test_pause_blocks_new_risk_but_allows_exit() public {
        _seedPool(100_000 * USDG);
        vm.startPrank(borrower);
        market.depositCollateral(1_000 * ZEC);
        market.borrow(10_000 * USDG);
        vm.stopPrank();

        vm.prank(admin);
        market.pause();

        // New exposure blocked…
        vm.prank(borrower);
        vm.expectRevert();
        market.borrow(1_000 * USDG);
        vm.prank(lender);
        vm.expectRevert();
        market.supply(1_000 * USDG);

        // …but repayment and lender withdrawal still work.
        vm.prank(borrower);
        market.repay(borrower, 5_000 * USDG);
        vm.prank(lender);
        market.withdraw(10_000 * USDG);
    }
}
