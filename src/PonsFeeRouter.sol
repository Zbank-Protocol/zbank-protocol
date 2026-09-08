// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPonsRouterFeeEscrow {
    function claimToken(address token) external;
}

interface IPonsRouterFactory {
    function transferCreatorFeeRecipient(address token, address newRecipient) external;
    function setBuybackEnabled(address token, bool enabled) external;
}

interface IPonsFeeManager {
    function fundAvailable() external returns (uint256 tokenId);
}

/// @title PonsFeeRouter
/// @notice Permanent Pons creator-fee recipient with a Safe-controlled, timelocked downstream
///         manager. New manager contracts can be deployed and selected without changing ZBNK.
/// @dev Claims only the immutable quote asset. Routing and the manager call are atomic: if the
///      manager is not ready, the entire escrow claim reverts and fees remain credited there.
contract PonsFeeRouter is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MANAGER_CHANGE_DELAY = 1 days;

    IERC20 public immutable quoteAsset;
    IPonsRouterFeeEscrow public immutable feeEscrow;
    IPonsRouterFactory public immutable ponsFactory;

    address public manager;
    address public pendingManager;
    uint256 public pendingManagerValidAt;
    uint256 public totalRouted;

    error InvalidConfiguration();
    error NoFeesAvailable();
    error NoManagerChangePending();
    error ManagerChangeNotReady(uint256 validAt);
    error QuoteAssetRecoveryDisabled();

    event ManagerChangeProposed(address indexed currentManager, address indexed pendingManager, uint256 validAt);
    event ManagerChangeCancelled(address indexed cancelledManager);
    event ManagerChanged(address indexed previousManager, address indexed newManager);
    event FeesRouted(address indexed caller, address indexed manager, uint256 amount, uint256 indexed liquidityTokenId);
    event CreatorFeeRecipientTransferred(address indexed token, address indexed newRecipient);
    event BuybackEnabledSet(address indexed token, bool enabled);

    constructor(address quoteAsset_, address feeEscrow_, address ponsFactory_, address owner_, address initialManager_)
        Ownable(owner_)
    {
        if (
            quoteAsset_ == address(0) || feeEscrow_ == address(0) || ponsFactory_ == address(0) || owner_ == address(0)
                || initialManager_.code.length == 0
        ) revert InvalidConfiguration();

        quoteAsset = IERC20(quoteAsset_);
        feeEscrow = IPonsRouterFeeEscrow(feeEscrow_);
        ponsFactory = IPonsRouterFactory(ponsFactory_);
        manager = initialManager_;
        emit ManagerChanged(address(0), initialManager_);
    }

    /// @notice Claims this router's Pons quote-asset fees and atomically sends every available
    ///         unit through the active manager.
    function claimAndRoute() external nonReentrant whenNotPaused returns (uint256 amount, uint256 tokenId) {
        feeEscrow.claimToken(address(quoteAsset));
        return _routeAvailable();
    }

    /// @notice Routes quote assets donated directly or retained after an interrupted operation.
    function routeAvailable() external nonReentrant whenNotPaused returns (uint256 amount, uint256 tokenId) {
        return _routeAvailable();
    }

    /// @notice Starts a delayed manager upgrade. The active manager continues operating during
    ///         the notice period.
    function proposeManager(address newManager) external onlyOwner {
        if (newManager.code.length == 0 || newManager == manager) revert InvalidConfiguration();
        pendingManager = newManager;
        pendingManagerValidAt = block.timestamp + MANAGER_CHANGE_DELAY;
        emit ManagerChangeProposed(manager, newManager, pendingManagerValidAt);
    }

    function cancelManagerChange() external onlyOwner {
        address cancelled = pendingManager;
        if (cancelled == address(0)) revert NoManagerChangePending();
        pendingManager = address(0);
        pendingManagerValidAt = 0;
        emit ManagerChangeCancelled(cancelled);
    }

    /// @notice Permissionless execution after the Safe-proposed notice period.
    function executeManagerChange() external {
        address next = pendingManager;
        if (next == address(0)) revert NoManagerChangePending();
        uint256 validAt = pendingManagerValidAt;
        if (block.timestamp < validAt) revert ManagerChangeNotReady(validAt);

        address previous = manager;
        manager = next;
        pendingManager = address(0);
        pendingManagerValidAt = 0;
        emit ManagerChanged(previous, next);
    }

    /// @notice Emergency escape hatch: because this router is Pons's recorded creator recipient,
    ///         it can hand future fees to another address without Pons-owner intervention.
    function transferCreatorFeeRecipient(address token, address newRecipient) external onlyOwner {
        if (token == address(0) || newRecipient == address(0)) revert InvalidConfiguration();
        ponsFactory.transferCreatorFeeRecipient(token, newRecipient);
        emit CreatorFeeRecipientTransferred(token, newRecipient);
    }

    /// @notice Controls Pons buyback-and-lock after launch while this router is the creator
    ///         recipient. Launch-time state is pinned separately in launch calldata.
    function setBuybackEnabled(address token, bool enabled) external onlyOwner {
        if (token == address(0)) revert InvalidConfiguration();
        ponsFactory.setBuybackEnabled(token, enabled);
        emit BuybackEnabledSet(token, enabled);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Recovers unrelated tokens only. USDG creator fees must follow the disclosed
    ///         manager route and cannot be swept around it.
    function recoverUnsupportedToken(IERC20 token, address recipient, uint256 amount) external onlyOwner {
        if (address(token) == address(quoteAsset)) revert QuoteAssetRecoveryDisabled();
        if (recipient == address(0)) revert InvalidConfiguration();
        token.safeTransfer(recipient, amount);
    }

    function _routeAvailable() private returns (uint256 amount, uint256 tokenId) {
        amount = quoteAsset.balanceOf(address(this));
        if (amount == 0) revert NoFeesAvailable();

        address activeManager = manager;
        quoteAsset.safeTransfer(activeManager, amount);
        tokenId = IPonsFeeManager(activeManager).fundAvailable();
        totalRouted += amount;
        emit FeesRouted(msg.sender, activeManager, amount, tokenId);
    }
}
