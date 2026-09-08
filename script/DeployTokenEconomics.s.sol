// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ZBankTreasury} from "../src/ZBankTreasury.sol";
import {ZBankRedemption} from "../src/ZBankRedemption.sol";
import {PayoutRegistry} from "../src/PayoutRegistry.sol";

/// @title DeployTokenEconomics
/// @notice Deploys the PRE-AUDIT ALPHA treasury, payout registry, and dual-path redemption
///         contracts around the canonical Pons-issued ZBNK token.
/// @dev Redemption modes start disabled. The owner must fund the redemption contract with real
///      zZEC and explicitly enable each mode after verifying every recorded address.
contract DeployTokenEconomics is Script {
    address internal constant ZZEC = 0x0b151Ff7a7c5250130EC16C275790961d558E402;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address zbnk = vm.envAddress("ZBNK_ADDRESS");
        address owner = vm.envAddress("OWNER");
        address nativeOperator = vm.envAddress("NATIVE_OPERATOR");
        address settlementRecipient = vm.envOr("NATIVE_SETTLEMENT_RECIPIENT", nativeOperator);
        uint16 treasuryBps = uint16(vm.envOr("TREASURY_BPS", uint256(5_000)));
        uint16 retirementBps = uint16(vm.envOr("RETIREMENT_BPS", uint256(3_000)));
        uint16 reserveBps = uint16(vm.envOr("RESERVE_BPS", uint256(2_000)));
        uint256 claimTimeout = vm.envOr("NATIVE_CLAIM_TIMEOUT", uint256(7 days));

        require(zbnk.code.length > 0, "deploy: ZBNK has no code");
        require(owner != address(0), "deploy: zero owner");
        require(nativeOperator != address(0), "deploy: zero native operator");
        require(settlementRecipient != address(0), "deploy: zero settlement recipient");
        require(IERC20(zbnk).totalSupply() > 0, "deploy: zero ZBNK supply");

        vm.startBroadcast(deployerKey);
        PayoutRegistry registry = new PayoutRegistry();
        ZBankTreasury treasury = new ZBankTreasury(zbnk, owner, treasuryBps, retirementBps, reserveBps);
        ZBankRedemption redemption = new ZBankRedemption(
            zbnk, ZZEC, address(registry), owner, nativeOperator, settlementRecipient, claimTimeout
        );
        vm.stopBroadcast();

        console2.log("PRE-AUDIT ALPHA DEPLOYMENT");
        console2.log("Canonical ZBNK:", zbnk);
        console2.log("Treasury:", address(treasury));
        console2.log("PayoutRegistry:", address(registry));
        console2.log("Redemption:", address(redemption));
        console2.log("Owner:", owner);
        console2.log("Native operator:", nativeOperator);
        console2.log("Settlement recipient:", settlementRecipient);
        console2.log("Redemption modes: DISABLED");
        console2.log("Next: fund Redemption with zZEC, verify balances, then enable modes via the owner Safe.");
    }
}
