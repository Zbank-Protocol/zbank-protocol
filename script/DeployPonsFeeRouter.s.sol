// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {PonsFeeRouter} from "../src/PonsFeeRouter.sol";

/// @title DeployPonsFeeRouter
/// @notice Deploys the permanent, Safe-controlled Pons creator-fee recipient. Use the resulting
///         address in TokenParams.creatorFeeRecipient instead of pointing Pons at a manager
///         implementation directly.
contract DeployPonsFeeRouter is Script {
    address internal constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address internal constant PONS_FEE_ESCROW = 0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e;
    address internal constant PONS_FACTORY = 0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e;
    address internal constant CURRENT_MANAGER = 0x082B87D21A5F840De52F2c154aC4132E3C365295;
    address internal constant PROTOCOL_SAFE = 0x31837999D9E463B2EB4327CEb4BD7CCa2a500480;

    function run() external returns (PonsFeeRouter router) {
        vm.startBroadcast();
        router = new PonsFeeRouter(USDG, PONS_FEE_ESCROW, PONS_FACTORY, PROTOCOL_SAFE, CURRENT_MANAGER);
        vm.stopBroadcast();

        console2.log("Pons creator-fee router:", address(router));
        console2.log("Owner:", PROTOCOL_SAFE);
        console2.log("Initial manager:", CURRENT_MANAGER);
        console2.log("Manager upgrade delay:", router.MANAGER_CHANGE_DELAY());
    }
}
