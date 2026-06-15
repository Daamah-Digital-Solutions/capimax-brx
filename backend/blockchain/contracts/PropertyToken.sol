// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PropertyToken
 * @notice Fractional ownership of ONE property, mirroring the per-property SPV
 *         legal structure. There is exactly one PropertyToken contract per
 *         property; they are all minted from a single audited template by
 *         {PropertyTokenFactory}.
 *
 * @dev SECURITY / DEPLOYMENT NOTICE
 *      ------------------------------------------------------------------------
 *      UNAUDITED. TESTNET ONLY (BSC Testnet, chain id 97). A professional
 *      third-party security audit is REQUIRED before any mainnet deployment or
 *      any handling of real funds. Do not deploy to mainnet from this source.
 *      ------------------------------------------------------------------------
 *
 *      Design (kept minimal + standard for audit-friendliness):
 *      - ERC20 from OpenZeppelin (well-known, audited base).
 *      - decimals() == 0: each whole token is one indivisible ownership share
 *        with a $100 nominal price. This matches the platform's integer token
 *        economics (supply = total_value / 100; see backend SPEC 7C.6) instead
 *        of the default 18-decimal divisibility.
 *      - Fixed cap: total supply can never exceed `maxSupply` (the property's
 *        token_supply). Enforced in {mint}.
 *      - Mint is restricted to MINTER_ROLE (the platform custodial signer).
 *        Wave 1 only DEPLOYS tokens; minting on a user investment is wired in
 *        Wave 2 — this contract simply makes the capability available + tested.
 *      - Standard ERC20 Transfer event covers transfers; {TokensMinted} is
 *        emitted on mint so the backend can observe issuance distinctly.
 */
contract PropertyToken is ERC20, AccessControl {
    /// @notice Role allowed to mint new ownership shares (held by the platform).
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Hard cap on total supply — equals the property's token_supply.
    uint256 public immutable maxSupply;

    /// @notice Nominal price per token in whole USD (100 for the $100/token model).
    uint256 public immutable nominalPriceUsd;

    /// @notice Off-chain link back to the platform Property (its `slug`/string id).
    string public propertySlug;

    /// @notice Emitted whenever new shares are minted.
    event TokensMinted(address indexed to, uint256 amount, uint256 newTotalSupply);

    /**
     * @param name_            ERC20 name (e.g. "Capimax BRX — Marina Tower").
     * @param symbol_          ERC20 symbol (e.g. "BRX1").
     * @param maxSupply_       Fixed share cap (the property's token_supply). > 0.
     * @param nominalPriceUsd_ Nominal USD price per share (100).
     * @param propertySlug_    The platform Property.slug this contract represents.
     * @param admin_           Platform address granted DEFAULT_ADMIN_ROLE + MINTER_ROLE.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        uint256 nominalPriceUsd_,
        string memory propertySlug_,
        address admin_
    ) ERC20(name_, symbol_) {
        require(maxSupply_ > 0, "PropertyToken: maxSupply must be > 0");
        require(admin_ != address(0), "PropertyToken: admin is zero address");
        maxSupply = maxSupply_;
        nominalPriceUsd = nominalPriceUsd_;
        propertySlug = propertySlug_;
        // The platform is both the role administrator and the sole minter.
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(MINTER_ROLE, admin_);
    }

    /// @notice Whole, indivisible shares: 1 token == one $100 ownership unit.
    function decimals() public pure override returns (uint8) {
        return 0;
    }

    /**
     * @notice Mint ownership shares to `to`. Restricted to MINTER_ROLE (platform).
     * @dev Reverts if the mint would push total supply past the fixed `maxSupply`.
     *      Wave 2 calls this on a confirmed user investment; never wired to an
     *      unauthenticated user action.
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(amount > 0, "PropertyToken: amount must be > 0");
        require(totalSupply() + amount <= maxSupply, "PropertyToken: cap exceeded");
        _mint(to, amount);
        emit TokensMinted(to, amount, totalSupply());
    }

    /// @notice Shares not yet minted (maxSupply - totalSupply).
    function remainingSupply() external view returns (uint256) {
        return maxSupply - totalSupply();
    }
}
