// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "./mocks/Mocks.sol";
import {PayoutRegistry} from "../src/PayoutRegistry.sol";
import {ZBankRedemption} from "../src/ZBankRedemption.sol";

contract ZBankRedemptionTest is Test {
    uint256 internal constant ZBNK = 1e18;
    uint256 internal constant ZZEC = 1e8;
    string internal constant ALICE_TADDR = "t1YYiZAZNamauF6bfzCUc7mBaDZdaMmX56U";
    string internal constant ALICE_TADDR_2 = "t1YWKgvpE5sqoXnWGsneB3mmmZvcPL5VBub";

    MockERC20 internal zbnk;
    MockERC20 internal zzec;
    PayoutRegistry internal registry;
    ZBankRedemption internal redemption;

    address internal owner = makeAddr("owner");
    address internal operator = makeAddr("operator");
    address internal settlementRecipient = makeAddr("settlementRecipient");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        zbnk = new MockERC20("ZBANK", "ZBNK", 18);
        zzec = new MockERC20("Wrapped ZEC", "zZEC", 8);
        registry = new PayoutRegistry();
        redemption = new ZBankRedemption(
            address(zbnk), address(zzec), address(registry), owner, operator, settlementRecipient, 7 days
        );

        zbnk.mint(alice, 200 * ZBNK);
        zbnk.mint(bob, 200 * ZBNK);
        zbnk.mint(makeAddr("market"), 600 * ZBNK);
        zzec.mint(address(redemption), 100 * ZZEC);

        vm.prank(owner);
        redemption.setRedemptionModes(true, true);
        vm.prank(alice);
        zbnk.approve(address(redemption), type(uint256).max);
        vm.prank(bob);
        zbnk.approve(address(redemption), type(uint256).max);
    }

    function test_directRedemptionPreservesBackingRatio() public {
        assertEq(redemption.eligibleSupply(), 1_000 * ZBNK);
        assertEq(redemption.quote(100 * ZBNK), 10 * ZZEC);

        vm.prank(alice);
        uint256 received = redemption.redeemZzec(100 * ZBNK, 10 * ZZEC);

        assertEq(received, 10 * ZZEC);
        assertEq(zzec.balanceOf(alice), 10 * ZZEC);
        assertEq(zbnk.balanceOf(address(redemption)), 100 * ZBNK);
        assertEq(redemption.eligibleSupply(), 900 * ZBNK);
        assertEq(redemption.redeemableZzec(), 90 * ZZEC);
        assertEq(redemption.quote(100 * ZBNK), 10 * ZZEC);
    }

    function test_nativeClaimReservesBackingAndSnapshotsPayout() public {
        vm.prank(alice);
        registry.setPayoutAddress(ALICE_TADDR);

        vm.prank(alice);
        (uint256 claimId, uint256 amount) = redemption.requestNativeZec(100 * ZBNK, 10 * ZZEC);
        assertEq(claimId, 1);
        assertEq(amount, 10 * ZZEC);
        assertEq(redemption.reservedForNativeClaims(), 10 * ZZEC);
        assertEq(redemption.redeemableZzec(), 90 * ZZEC);

        (,,,,, bytes22 payout, ZBankRedemption.ClaimStatus status) = redemption.nativeClaims(claimId);
        assertEq(uint256(status), uint256(ZBankRedemption.ClaimStatus.Pending));

        vm.prank(alice);
        registry.setPayoutAddress(ALICE_TADDR_2);
        (,,,,, bytes22 payoutAfterUpdate,) = redemption.nativeClaims(claimId);
        assertEq(payoutAfterUpdate, payout);
        assertTrue(payout != registry.rawPayoutOf(alice));
    }

    function test_operatorSettlementReleasesReservedZzec() public {
        vm.prank(alice);
        registry.setPayoutAddress(ALICE_TADDR);
        vm.prank(alice);
        (uint256 claimId,) = redemption.requestNativeZec(100 * ZBNK, 0);

        bytes32 proof = keccak256("zcash settlement transaction");
        vm.prank(operator);
        redemption.settleNativeClaim(claimId, proof);

        assertEq(zzec.balanceOf(settlementRecipient), 10 * ZZEC);
        assertEq(redemption.reservedForNativeClaims(), 0);
        assertEq(redemption.totalNativeZecSettled(), 10 * ZZEC);
        (,,,,,, ZBankRedemption.ClaimStatus status) = redemption.nativeClaims(claimId);
        assertEq(uint256(status), uint256(ZBankRedemption.ClaimStatus.Settled));
    }

    function test_claimantCanCancelUnsettledClaimAfterDeadline() public {
        vm.prank(alice);
        registry.setPayoutAddress(ALICE_TADDR);
        vm.prank(alice);
        (uint256 claimId,) = redemption.requestNativeZec(100 * ZBNK, 0);

        vm.expectRevert();
        vm.prank(alice);
        redemption.cancelNativeClaim(claimId);

        vm.warp(block.timestamp + 7 days);
        vm.prank(alice);
        redemption.cancelNativeClaim(claimId);

        assertEq(zbnk.balanceOf(alice), 200 * ZBNK);
        assertEq(redemption.totalZbnkRetired(), 0);
        assertEq(redemption.reservedForNativeClaims(), 0);
        assertEq(redemption.eligibleSupply(), 1_000 * ZBNK);
    }

    function test_nativeClaimRequiresRegisteredPayout() public {
        vm.expectRevert(ZBankRedemption.PayoutAddressRequired.selector);
        vm.prank(alice);
        redemption.requestNativeZec(100 * ZBNK, 0);
    }

    function test_onlyOperatorCanSettle() public {
        vm.prank(alice);
        registry.setPayoutAddress(ALICE_TADDR);
        vm.prank(alice);
        (uint256 claimId,) = redemption.requestNativeZec(100 * ZBNK, 0);

        vm.expectRevert(ZBankRedemption.NotNativeOperator.selector);
        vm.prank(bob);
        redemption.settleNativeClaim(claimId, keccak256("proof"));
    }

    function test_slippageFloorProtectsDirectAndNativeQuotes() public {
        vm.expectRevert(abi.encodeWithSelector(ZBankRedemption.Slippage.selector, 10 * ZZEC, 11 * ZZEC));
        vm.prank(alice);
        redemption.redeemZzec(100 * ZBNK, 11 * ZZEC);

        vm.prank(alice);
        registry.setPayoutAddress(ALICE_TADDR);
        vm.expectRevert(abi.encodeWithSelector(ZBankRedemption.Slippage.selector, 10 * ZZEC, 11 * ZZEC));
        vm.prank(alice);
        redemption.requestNativeZec(100 * ZBNK, 11 * ZZEC);
    }

    function test_pauseBlocksNewClaimsButNotCancellation() public {
        vm.prank(alice);
        registry.setPayoutAddress(ALICE_TADDR);
        vm.prank(alice);
        (uint256 claimId,) = redemption.requestNativeZec(100 * ZBNK, 0);

        vm.prank(owner);
        redemption.pause();
        vm.expectRevert();
        vm.prank(bob);
        redemption.redeemZzec(10 * ZBNK, 0);

        vm.warp(block.timestamp + 7 days);
        vm.prank(alice);
        redemption.cancelNativeClaim(claimId);
        assertEq(zbnk.balanceOf(alice), 200 * ZBNK);
    }

    function test_deadAddressRetirementIsExcludedFromSupply() public {
        address retirementAddress = redemption.RETIREMENT_ADDRESS();
        vm.prank(alice);
        zbnk.transfer(retirementAddress, 100 * ZBNK);

        assertEq(redemption.eligibleSupply(), 900 * ZBNK);
        assertEq(redemption.quote(90 * ZBNK), 10 * ZZEC);
    }

    function test_nativeReservationCannotBeTakenByDirectRedeemer() public {
        vm.prank(alice);
        registry.setPayoutAddress(ALICE_TADDR);
        vm.prank(alice);
        redemption.requestNativeZec(100 * ZBNK, 0);

        vm.prank(bob);
        redemption.redeemZzec(100 * ZBNK, 10 * ZZEC);

        assertEq(redemption.reservedForNativeClaims(), 10 * ZZEC);
        assertEq(zzec.balanceOf(address(redemption)), 90 * ZZEC);
        assertEq(redemption.redeemableZzec(), 80 * ZZEC);
    }
}
