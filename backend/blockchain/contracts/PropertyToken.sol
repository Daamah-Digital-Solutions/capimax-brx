// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PropertyToken
 * @notice Fractional ownership of ONE property, mirroring the per-property SPV
 *         legal structure. There is exactly one PropertyToken contract per
 *         property; they are all minted from a single template by
 *         {PropertyTokenFactory}.
 *
 * @dev SECURITY / DEPLOYMENT NOTICE
 *      ------------------------------------------------------------------------
 *      Internal review 2026-10-21 (backend/blockchain/AUDIT-2026-10-21.md).
 *      A professional third-party security audit is REQUIRED before any
 *      mainnet deployment or any handling of real funds.
 *      ------------------------------------------------------------------------
 *
 *      Roles (audit H-1 — no single key holds every power):
 *      - DEFAULT_ADMIN_ROLE  the platform's multisig (Safe). Grants / revokes every
 *                            role, unpauses, and is the only CONTROLLER by default.
 *      - MINTER_ROLE         the hot server key that issues shares on confirmed
 *                            purchases. Cannot change roles, cannot move holdings.
 *      - PAUSER_ROLE         admin + the hot key: anyone on duty can stop the token
 *                            in an emergency; only the admin can restart it.
 *      - CONTROLLER_ROLE     forced transfers / burns (installment forfeiture,
 *                            recovery of units from a compromised wallet, court
 *                            orders). Admin only unless the admin delegates it.
 *
 *      Economics: decimals() == 0 (1 token = one $100 share), fixed `maxSupply`.
 *      A controller burn (clawback to address(0)) lowers totalSupply, so the freed
 *      units can be minted again within the same cap.
 */
contract PropertyToken is ERC20, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant CONTROLLER_ROLE = keccak256("CONTROLLER_ROLE");

    /// @notice Hard cap on total supply — equals the property's token_supply.
    uint256 public immutable maxSupply;

    /// @notice Nominal price per token in whole USD (100 for the $100/token model).
    uint256 public immutable nominalPriceUsd;

    /// @notice Off-chain link back to the platform Property (its `slug`).
    string public propertySlug;

    /// @dev Set only for the duration of a controller transfer, so it works while paused.
    bool private _forced;

    event TokensMinted(address indexed to, uint256 amount, uint256 newTotalSupply);

    /// @notice A controller moved (`to` != 0) or burned (`to` == 0) a holder's shares.
    event Clawback(address indexed from, address indexed to, uint256 amount, string reason);

    /**
     * @param admin_   Multisig: DEFAULT_ADMIN_ROLE + PAUSER_ROLE + CONTROLLER_ROLE.
     * @param minter_  Hot server key: MINTER_ROLE + PAUSER_ROLE. May equal admin_ on a
     *                 test network; on mainnet it must be a different address.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        uint256 nominalPriceUsd_,
        string memory propertySlug_,
        address admin_,
        address minter_
    ) ERC20(name_, symbol_) {
        require(maxSupply_ > 0, "PropertyToken: maxSupply must be > 0");
        require(admin_ != address(0), "PropertyToken: admin is zero address");
        require(minter_ != address(0), "PropertyToken: minter is zero address");
        maxSupply = maxSupply_;
        nominalPriceUsd = nominalPriceUsd_;
        propertySlug = propertySlug_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(PAUSER_ROLE, admin_);
        _grantRole(CONTROLLER_ROLE, admin_);
        _grantRole(MINTER_ROLE, minter_);
        _grantRole(PAUSER_ROLE, minter_);
    }

    /// @notice Whole, indivisible shares: 1 token == one $100 ownership unit.
    function decimals() public pure override returns (uint8) {
        return 0;
    }

    /// @notice Mint shares to `to` within the cap. MINTER_ROLE; blocked while paused.
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(amount > 0, "PropertyToken: amount must be > 0");
        require(totalSupply() + amount <= maxSupply, "PropertyToken: cap exceeded");
        _mint(to, amount);
        emit TokensMinted(to, amount, totalSupply());
    }

    /// @notice Stop all mints and transfers. Admin or the hot key (emergency brake).
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Restart the token. Admin (multisig) only.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Forced move of `amount` shares from `from` to `to`, or a burn when
     *         `to` is address(0). CONTROLLER_ROLE only; works while paused so stolen
     *         or forfeited units can be recovered during an emergency stop.
     * @param reason Short human / ledger reference recorded in the event.
     */
    function clawback(address from, address to, uint256 amount, string calldata reason)
        external
        onlyRole(CONTROLLER_ROLE)
    {
        require(from != address(0), "PropertyToken: from is zero address");
        require(amount > 0, "PropertyToken: amount must be > 0");
        _forced = true;
        if (to == address(0)) {
            _burn(from, amount);
        } else {
            _transfer(from, to, amount);
        }
        _forced = false;
        emit Clawback(from, to, amount, reason);
    }

    /// @notice Shares not yet minted (maxSupply - totalSupply).
    function remainingSupply() external view returns (uint256) {
        return maxSupply - totalSupply();
    }

    /// @dev Every balance change goes through here: blocked while paused, except a
    ///      controller clawback.
    function _update(address from, address to, uint256 value) internal override {
        if (!_forced) {
            _requireNotPaused();
        }
        super._update(from, to, value);
    }
}
