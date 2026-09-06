// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PayoutRegistry} from "../src/PayoutRegistry.sol";
import {ZcashAddress} from "../src/ZcashAddress.sol";

contract PayoutRegistryTest is Test {
    PayoutRegistry internal registry;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    string constant ALICE_ADDR = "t1YYiZAZNamauF6bfzCUc7mBaDZdaMmX56U";
    bytes20 constant ALICE_HASH160 = bytes20(hex"a0f7733c65c22914cd657ce95ecb3c9e653ac07e");
    string constant BOB_ADDR = "t3RGLfnZuS1KC8NXizVcdWf5JRkonfbwKdd";
    string constant ALICE_ADDR_2 = "t1YWKgvpE5sqoXnWGsneB3mmmZvcPL5VBub";

    event PayoutAddressSet(address indexed holder, bytes22 versionedPayload, string encoded);
    event PayoutAddressCleared(address indexed holder);

    function setUp() public {
        registry = new PayoutRegistry();
    }

    function test_registersAndReadsBack() public {
        vm.prank(alice);
        registry.setPayoutAddress(ALICE_ADDR);

        (bytes2 version, bytes20 hash160) = registry.payoutOf(alice);
        assertEq(version, ZcashAddress.VERSION_P2PKH, "version");
        assertEq(hash160, ALICE_HASH160, "hash160");
        assertTrue(registry.isRegistered(alice));
        assertEq(registry.registeredCount(), 1);
    }

    function test_emitsEventWithEncodedAddress() public {
        bytes22 expectedPayload =
            bytes22(uint176(uint16(ZcashAddress.VERSION_P2PKH)) << 160 | uint176(uint160(ALICE_HASH160)));

        vm.expectEmit(true, false, false, true);
        emit PayoutAddressSet(alice, expectedPayload, ALICE_ADDR);

        vm.prank(alice);
        registry.setPayoutAddress(ALICE_ADDR);
    }

    function test_supportsP2shDestinations() public {
        vm.prank(bob);
        registry.setPayoutAddress(BOB_ADDR);

        (bytes2 version,) = registry.payoutOf(bob);
        assertEq(version, ZcashAddress.VERSION_P2SH);
    }

    /// @dev Re-registering must not double-count the holder.
    function test_updatingDoesNotInflateRegisteredCount() public {
        vm.startPrank(alice);
        registry.setPayoutAddress(ALICE_ADDR);
        registry.setPayoutAddress(ALICE_ADDR_2);
        vm.stopPrank();

        assertEq(registry.registeredCount(), 1, "count");
        (, bytes20 hash160) = registry.payoutOf(alice);
        assertEq(hash160, bytes20(hex"a08387cfa5b3d238c3d549dfa9a2f78e9254627a"), "updated hash160");
    }

    function test_countsMultipleHolders() public {
        vm.prank(alice);
        registry.setPayoutAddress(ALICE_ADDR);
        vm.prank(bob);
        registry.setPayoutAddress(BOB_ADDR);

        assertEq(registry.registeredCount(), 2);
    }

    function test_clearRemovesRegistration() public {
        vm.startPrank(alice);
        registry.setPayoutAddress(ALICE_ADDR);

        vm.expectEmit(true, false, false, false);
        emit PayoutAddressCleared(alice);
        registry.clearPayoutAddress();
        vm.stopPrank();

        assertFalse(registry.isRegistered(alice));
        assertEq(registry.registeredCount(), 0);
        assertEq(registry.rawPayoutOf(alice), bytes22(0));
    }

    function test_clearRevertsWhenNotRegistered() public {
        vm.expectRevert(abi.encodeWithSelector(PayoutRegistry.NotRegistered.selector, alice));
        vm.prank(alice);
        registry.clearPayoutAddress();
    }

    function test_payoutOfRevertsWhenNotRegistered() public {
        vm.expectRevert(abi.encodeWithSelector(PayoutRegistry.NotRegistered.selector, bob));
        registry.payoutOf(bob);
    }

    /// @dev A malformed address must be rejected at registration, not at payout time.
    function test_rejectsMalformedAddressWithSpecificError() public {
        vm.prank(alice);
        vm.expectRevert(ZcashAddress.BadChecksum.selector);
        registry.setPayoutAddress("t1YYiZAZNamauF6bfzCUc7mBaDZdaMmX56V");

        assertFalse(registry.isRegistered(alice));
        assertEq(registry.registeredCount(), 0);
    }

    function test_isValidPayoutAddressDoesNotMutateState() public view {
        assertTrue(registry.isValidPayoutAddress(ALICE_ADDR));
        assertFalse(registry.isValidPayoutAddress("t1YYiZAZNamauF6bfzCUc7mBaDZdaMmX56V"));
        assertEq(registry.registeredCount(), 0);
    }

    /// @dev Registrations must be per-caller; nobody can set another holder's destination.
    function test_registrationIsScopedToCaller() public {
        vm.prank(alice);
        registry.setPayoutAddress(ALICE_ADDR);

        assertTrue(registry.isRegistered(alice));
        assertFalse(registry.isRegistered(bob));
    }
}
