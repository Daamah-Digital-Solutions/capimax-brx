// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PropertyToken} from "./PropertyToken.sol";

/**
 * @title PropertyTokenFactory
 * @notice Deploys ONE {PropertyToken} per property from a single audited template,
 *         so every property's token contract is identical-by-construction and
 *         deployment is automatic rather than hand-rolled. This mirrors the
 *         per-property SPV: one legal vehicle (and now one contract) per asset.
 *
 * @dev SECURITY / DEPLOYMENT NOTICE
 *      ------------------------------------------------------------------------
 *      UNAUDITED. TESTNET ONLY (BSC Testnet, chain id 97). A professional
 *      third-party security audit is REQUIRED before any mainnet deployment or
 *      any handling of real funds.
 *      ------------------------------------------------------------------------
 *
 *      The factory is owned by the platform. Only the owner can deploy property
 *      tokens. Each child token grants DEFAULT_ADMIN_ROLE + MINTER_ROLE to the
 *      factory owner (the platform custodial signer), so the same key that
 *      deploys can later mint (Wave 2).
 */
contract PropertyTokenFactory is Ownable {
    /// @notice propertySlug => deployed PropertyToken address (address(0) if none).
    mapping(string => address) public tokenForSlug;

    /// @notice All deployed token addresses, in deployment order.
    address[] public allTokens;

    /**
     * @notice Emitted on every property-token deployment.
     * @dev `propertySlugIndexed` is the hashed/indexed copy (for topic filtering);
     *      `propertySlug` is the plain readable copy.
     */
    event PropertyTokenDeployed(
        string indexed propertySlugIndexed,
        string propertySlug,
        address indexed tokenAddress,
        uint256 maxSupply,
        uint256 nominalPriceUsd
    );

    constructor(address owner_) Ownable(owner_) {}

    /**
     * @notice Deploy a new PropertyToken for `propertySlug_`. Owner-only.
     * @dev Reverts if a token already exists for the slug (idempotency guard at
     *      the chain level — the backend also guards this off-chain).
     * @return The address of the newly deployed PropertyToken.
     */
    function deployPropertyToken(
        string calldata name_,
        string calldata symbol_,
        uint256 maxSupply_,
        uint256 nominalPriceUsd_,
        string calldata propertySlug_
    ) external onlyOwner returns (address) {
        require(
            tokenForSlug[propertySlug_] == address(0),
            "Factory: slug already deployed"
        );
        // Factory owner (the platform) becomes admin + minter on the child token.
        PropertyToken token = new PropertyToken(
            name_,
            symbol_,
            maxSupply_,
            nominalPriceUsd_,
            propertySlug_,
            owner()
        );
        address tokenAddress = address(token);
        tokenForSlug[propertySlug_] = tokenAddress;
        allTokens.push(tokenAddress);
        emit PropertyTokenDeployed(
            propertySlug_,
            propertySlug_,
            tokenAddress,
            maxSupply_,
            nominalPriceUsd_
        );
        return tokenAddress;
    }

    /// @notice Number of property tokens deployed by this factory.
    function totalDeployed() external view returns (uint256) {
        return allTokens.length;
    }
}
