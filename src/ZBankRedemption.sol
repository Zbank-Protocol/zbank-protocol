// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {PayoutRegistry} from "./PayoutRegistry.sol";

/// @title ZBankRedemption
/// @notice PRE-AUDIT ALPHA. Retires ZBNK for a proportional share of available zZEC backing.
///         Users can receive zZEC atomically on Robinhood Chain or request an operator-settled
///         native ZEC payout to a registered transparent Zcash address.
/// @dev Pons tokens expose the standard ERC-20 interface but not a holder burn function. Redeemed
///      ZBNK is therefore permanently locked in this contract and excluded from eligible supply.
///      Native claims reserve the quoted zZEC until settlement or claimant cancellation.
contract ZBankRedemption is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant RETIREMENT_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    uint256 public constant MIN_CLAIM_TIMEOUT = 1 days;
    uint256 public constant MAX_CLAIM_TIMEOUT = 30 days;

    enum ClaimStatus {
        None,
        Pending,
        Settled,
        Cancelled
    }

    struct NativeClaim {
        address claimant;
        uint256 zbnkRetired;
        uint256 zecAmount;
        uint64 requestedAt;
        uint64 cancelAfter;
        bytes22 payout;
        ClaimStatus status;
    }

    error ZeroAmount();
    error ZeroOutput();
    error InvalidConfiguration();
    error DirectRedemptionDisabled();
    error NativeRedemptionDisabled();
    error NoEligibleSupply();
    error Slippage(uint256 output, uint256 minimum);
    error UnsupportedTransferFee();
    error PayoutAddressRequired();
    error ClaimNotPending(uint256 claimId);
    error NotClaimant();
    error NotNativeOperator();
    error ClaimNotCancellable(uint256 cancelAfter);
    error InvalidSettlementProof();

    event RedemptionModesSet(bool directEnabled, bool nativeEnabled);
    event NativeOperatorSet(address indexed operator, address indexed settlementRecipient);
    event ClaimTimeoutSet(uint256 timeout);
    event DirectRedeemed(
        address indexed account, uint256 zbnkRetired, uint256 zzecReceived, uint256 eligibleSupplyAfter
    );
    event NativeClaimRequested(
        uint256 indexed claimId,
        address indexed account,
        uint256 zbnkRetired,
        uint256 zecAmount,
        bytes22 payout,
        uint256 cancelAfter
    );
    event NativeClaimSettled(
        uint256 indexed claimId, address indexed account, uint256 zecAmount, bytes32 indexed settlementProof
    );
    event NativeClaimCancelled(uint256 indexed claimId, address indexed account, uint256 zbnkReturned);

    IERC20 public immutable zbnk;
    IERC20 public immutable zzec;
    PayoutRegistry public immutable payoutRegistry;

    address public nativeOperator;
    address public nativeSettlementRecipient;
    uint256 public claimTimeout;
    bool public directRedemptionEnabled;
    bool public nativeRedemptionEnabled;
    uint256 public reservedForNativeClaims;
    uint256 public totalZbnkRetired;
    uint256 public totalZzecPaidDirect;
    uint256 public totalNativeZecSettled;
    uint256 public nextClaimId = 1;

    mapping(uint256 claimId => NativeClaim claim) public nativeClaims;

    constructor(
        address zbnk_,
        address zzec_,
        address payoutRegistry_,
        address owner_,
        address nativeOperator_,
        address nativeSettlementRecipient_,
        uint256 claimTimeout_
    ) Ownable(owner_) {
        if (
            zbnk_ == address(0) || zzec_ == address(0) || payoutRegistry_ == address(0) || nativeOperator_ == address(0)
                || nativeSettlementRecipient_ == address(0) || claimTimeout_ < MIN_CLAIM_TIMEOUT
                || claimTimeout_ > MAX_CLAIM_TIMEOUT
        ) revert InvalidConfiguration();
        zbnk = IERC20(zbnk_);
        zzec = IERC20(zzec_);
        payoutRegistry = PayoutRegistry(payoutRegistry_);
        nativeOperator = nativeOperator_;
        nativeSettlementRecipient = nativeSettlementRecipient_;
        claimTimeout = claimTimeout_;
    }

    /// @notice Supply participating in redemption math. Pons-issued ZBNK locked here or sent to
    ///         the canonical retirement address is excluded even though ERC-20 totalSupply does
    ///         not expose a holder burn function.
    function eligibleSupply() public view returns (uint256) {
        uint256 supply = zbnk.totalSupply();
        uint256 excluded = zbnk.balanceOf(address(this)) + zbnk.balanceOf(RETIREMENT_ADDRESS);
        return excluded >= supply ? 0 : supply - excluded;
    }

    /// @notice zZEC not already reserved for pending native-chain claims.
    function redeemableZzec() public view returns (uint256) {
        return zzec.balanceOf(address(this)) - reservedForNativeClaims;
    }

    function quote(uint256 zbnkAmount) public view returns (uint256 zecAmount) {
        if (zbnkAmount == 0) return 0;
        uint256 supply = eligibleSupply();
        if (supply == 0) revert NoEligibleSupply();
        return Math.mulDiv(redeemableZzec(), zbnkAmount, supply);
    }

    function redeemZzec(uint256 zbnkAmount, uint256 minimumZzecOut)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 zecAmount)
    {
        if (!directRedemptionEnabled) revert DirectRedemptionDisabled();
        if (zbnkAmount == 0) revert ZeroAmount();
        zecAmount = quote(zbnkAmount);
        if (zecAmount == 0) revert ZeroOutput();
        if (zecAmount < minimumZzecOut) revert Slippage(zecAmount, minimumZzecOut);

        _retireFrom(msg.sender, zbnkAmount);
        totalZzecPaidDirect += zecAmount;
        zzec.safeTransfer(msg.sender, zecAmount);
        emit DirectRedeemed(msg.sender, zbnkAmount, zecAmount, eligibleSupply());
    }

    function requestNativeZec(uint256 zbnkAmount, uint256 minimumZecOut)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 claimId, uint256 zecAmount)
    {
        if (!nativeRedemptionEnabled) revert NativeRedemptionDisabled();
        if (zbnkAmount == 0) revert ZeroAmount();
        bytes22 payout = payoutRegistry.rawPayoutOf(msg.sender);
        if (payout == bytes22(0)) revert PayoutAddressRequired();

        zecAmount = quote(zbnkAmount);
        if (zecAmount == 0) revert ZeroOutput();
        if (zecAmount < minimumZecOut) revert Slippage(zecAmount, minimumZecOut);
        _retireFrom(msg.sender, zbnkAmount);

        claimId = nextClaimId++;
        uint64 requestedAt = uint64(block.timestamp);
        uint64 cancelAfter = uint64(block.timestamp + claimTimeout);
        nativeClaims[claimId] = NativeClaim({
            claimant: msg.sender,
            zbnkRetired: zbnkAmount,
            zecAmount: zecAmount,
            requestedAt: requestedAt,
            cancelAfter: cancelAfter,
            payout: payout,
            status: ClaimStatus.Pending
        });
        reservedForNativeClaims += zecAmount;
        emit NativeClaimRequested(claimId, msg.sender, zbnkAmount, zecAmount, payout, cancelAfter);
    }

    /// @notice Records an externally verifiable native ZEC settlement and releases the reserved
    ///         zZEC to the configured settlement recipient. The operator is trusted to pay the
    ///         snapshotted t-address before calling this function.
    function settleNativeClaim(uint256 claimId, bytes32 settlementProof) external nonReentrant {
        if (msg.sender != nativeOperator) revert NotNativeOperator();
        if (settlementProof == bytes32(0)) revert InvalidSettlementProof();
        NativeClaim storage claim = nativeClaims[claimId];
        if (claim.status != ClaimStatus.Pending) revert ClaimNotPending(claimId);

        claim.status = ClaimStatus.Settled;
        reservedForNativeClaims -= claim.zecAmount;
        totalNativeZecSettled += claim.zecAmount;
        zzec.safeTransfer(nativeSettlementRecipient, claim.zecAmount);
        emit NativeClaimSettled(claimId, claim.claimant, claim.zecAmount, settlementProof);
    }

    /// @notice Returns a claimant's ZBNK if the operator has not settled before the snapshotted
    ///         deadline. This remains available while the contract is paused.
    function cancelNativeClaim(uint256 claimId) external nonReentrant {
        NativeClaim storage claim = nativeClaims[claimId];
        if (claim.status != ClaimStatus.Pending) revert ClaimNotPending(claimId);
        if (claim.claimant != msg.sender) revert NotClaimant();
        if (block.timestamp < claim.cancelAfter) revert ClaimNotCancellable(claim.cancelAfter);

        claim.status = ClaimStatus.Cancelled;
        reservedForNativeClaims -= claim.zecAmount;
        totalZbnkRetired -= claim.zbnkRetired;
        zbnk.safeTransfer(msg.sender, claim.zbnkRetired);
        emit NativeClaimCancelled(claimId, msg.sender, claim.zbnkRetired);
    }

    function setRedemptionModes(bool directEnabled, bool nativeEnabled) external onlyOwner {
        directRedemptionEnabled = directEnabled;
        nativeRedemptionEnabled = nativeEnabled;
        emit RedemptionModesSet(directEnabled, nativeEnabled);
    }

    function setNativeOperator(address operator, address settlementRecipient) external onlyOwner {
        if (operator == address(0) || settlementRecipient == address(0)) revert InvalidConfiguration();
        nativeOperator = operator;
        nativeSettlementRecipient = settlementRecipient;
        emit NativeOperatorSet(operator, settlementRecipient);
    }

    function setClaimTimeout(uint256 timeout) external onlyOwner {
        if (timeout < MIN_CLAIM_TIMEOUT || timeout > MAX_CLAIM_TIMEOUT) revert InvalidConfiguration();
        claimTimeout = timeout;
        emit ClaimTimeoutSet(timeout);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _retireFrom(address account, uint256 amount) private {
        uint256 balanceBefore = zbnk.balanceOf(address(this));
        zbnk.safeTransferFrom(account, address(this), amount);
        if (zbnk.balanceOf(address(this)) - balanceBefore != amount) revert UnsupportedTransferFee();
        totalZbnkRetired += amount;
    }
}
