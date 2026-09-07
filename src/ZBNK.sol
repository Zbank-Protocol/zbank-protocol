// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title ZBNK — the ZBANK protocol token
/// @notice Fixed-supply ERC20. The entire supply is minted once, at deployment, to the
///         distribution address (launch allocation is handled offchain / by the launchpad).
///         There is no mint function: supply can only ever go down, via `burn` — which is
///         the mechanical half of "MORE ZEC. FEWER ZBNK."
/// @dev    If the token is instead launched through the Pons factory, this contract is not
///         deployed; the treasury engine only requires an ERC20Burnable-compatible token.
contract ZBNK is ERC20, ERC20Burnable, ERC20Permit {
    /// @notice 1,000,000,000 ZBNK, 18 decimals. Immutable by construction.
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000e18;

    constructor(address distributor) ERC20("ZBANK", "ZBNK") ERC20Permit("ZBANK") {
        require(distributor != address(0), "ZBNK: zero distributor");
        _mint(distributor, INITIAL_SUPPLY);
    }
}
