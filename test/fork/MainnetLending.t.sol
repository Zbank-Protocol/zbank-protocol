// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ZCredit} from "../../src/ZCredit.sol";
import {ChainlinkOracleAdapter} from "../../src/oracle/ChainlinkOracleAdapter.sol";
import {MockAggregator} from "../mocks/Mocks.sol";

/// @title Mainnet fork dry run — the launch rehearsal
/// @notice Runs the entire ZCREDIT lifecycle on a fork of Robinhood Chain mainnet, against
///         the REAL deployed USDG and zZEC token contracts (their true bytecode, decimals,
///         and transfer behavior) — the exact tokens real users will bring.
///
///         The price source is a mock aggregator (pushing a real Data Streams report needs
///         API credentials); the Data Streams path has its own unit suite. Everything else —
///         tokens, market, math — is what mainnet will run.
///
///         Run:  forge test --match-contract MainnetLendingFork
///         (skips silently when FORK_RPC / default RPC is unreachable)
contract MainnetLendingForkTest is Test {
    address constant ZZEC = 0x0b151Ff7a7c5250130EC16C275790961d558E402;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;

    ZCredit market;
    MockAggregator feed;

    address lender = makeAddr("lender");
    address borrower = makeAddr("borrower");
    address keeper = makeAddr("keeper");

    function setUp() public {
        string memory rpc = vm.envOr("FORK_RPC", string("https://rpc.mainnet.chain.robinhood.com"));
        try vm.createSelectFork(rpc) {}
        catch {
            vm.skip(true);
        }

        feed = new MockAggregator(8, 50e8); // ZEC = $50
        ChainlinkOracleAdapter oracle = new ChainlinkOracleAdapter(address(feed), 1 hours, address(0));
        market = new ZCredit(ZZEC, USDG, address(oracle), address(this));

        // Real tokens, dealt balances (storage write on the fork).
        deal(USDG, lender, 50_000e6);
        deal(USDG, keeper, 50_000e6);
        deal(ZZEC, borrower, 1_000e8);

        vm.prank(lender);
        IERC20(USDG).approve(address(market), type(uint256).max);
        vm.prank(keeper);
        IERC20(USDG).approve(address(market), type(uint256).max);
        vm.startPrank(borrower);
        IERC20(ZZEC).approve(address(market), type(uint256).max);
        IERC20(USDG).approve(address(market), type(uint256).max);
        vm.stopPrank();
    }

    /// @notice The twelve-step launch rehearsal: supply → collateral → borrow → interest →
    ///         partial repay → price crash → liquidation → recovery → full exit.
    function test_full_lifecycle_on_mainnet_fork() public {
        // 1. Lender supplies real USDG.
        vm.prank(lender);
        market.supply(50_000e6);
        assertEq(market.balanceOfSupplied(lender), 50_000e6);
        assertEq(market.availableLiquidity(), 50_000e6);

        // 2. Borrower posts real zZEC and draws USDG at half of max LTV.
        vm.startPrank(borrower);
        market.depositCollateral(1_000e8); // $50k at $50
        market.borrow(12_500e6); // 25% LTV
        vm.stopPrank();
        assertEq(IERC20(USDG).balanceOf(borrower), 12_500e6);
        assertGt(market.healthFactor(borrower), 2e18);

        // 3. A month passes; interest accrues; rates and utilization are live numbers.
        skip(30 days);
        feed.set(50e8, block.timestamp);
        uint256 debt = market.debtOf(borrower);
        assertGt(debt, 12_500e6);
        assertGt(market.balanceOfSupplied(lender), 50_000e6); // lender is earning

        // 4. Borrower repays half.
        vm.prank(borrower);
        market.repay(borrower, debt / 2);

        // 5. ZEC crashes to $8 — the halved position goes underwater
        //    (collateral $8k × 70% threshold < ~$6.3k remaining debt).
        feed.set(8e8, block.timestamp);
        assertLt(market.healthFactor(borrower), 1e18);

        // 6. A keeper liquidates within the close factor and takes collateral at the bonus.
        uint256 liqDebt = market.debtOf(borrower);
        vm.prank(keeper);
        market.liquidate(borrower, liqDebt / 2);
        assertGt(IERC20(ZZEC).balanceOf(keeper), 0);

        // 7. Borrower clears the remainder and exits with their remaining collateral.
        vm.startPrank(borrower);
        market.repay(borrower, type(uint256).max);
        assertEq(market.debtOf(borrower), 0);
        market.withdrawCollateral(market.collateralOf(borrower));
        vm.stopPrank();

        // 8. Lender exits with principal + interest, on the real USDG token.
        uint256 claim = market.balanceOfSupplied(lender);
        uint256 cash = market.availableLiquidity();
        uint256 exitAmount = claim < cash ? claim : cash;
        vm.prank(lender);
        market.withdraw(exitAmount);
        assertGe(IERC20(USDG).balanceOf(lender), 50_000e6); // never worse than principal here

        // 9. Owner sweeps protocol reserves — bounded, never lender funds.
        uint256 swept = market.sweepReserves(address(this));
        assertGt(swept, 0);
    }

    /// @notice Pause semantics on the fork: exits always work.
    function test_pause_on_fork_allows_exit() public {
        vm.prank(lender);
        market.supply(10_000e6);
        market.pause();
        vm.prank(lender);
        market.withdraw(10_000e6);
        assertEq(IERC20(USDG).balanceOf(lender), 50_000e6);
    }
}
