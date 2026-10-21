// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {PropertyToken} from "./PropertyToken.sol";

/**
 * @title PropertyTokenFactory
 * @notice Deploys ONE {PropertyToken} per property from a single template, so every
 *         property's token contract is identical-by-construction. Mirrors the
 *         per-property SPV: one legal vehicle (and one contract) per asset.
 *
 * @dev SECURITY / DEPLOYMENT NOTICE
 *      ------------------------------------------------------------------------
 *      Internal review 2026-10-21 (backend/blockchain/AUDIT-2026-10-21.md).
 *      A professional third-party security audit is REQUIRED before mainnet.
 *      ------------------------------------------------------------------------
 *
 *      Separation of powers (audit H-1):
 *      - owner     the platform multisig. Two-step ownership transfer. Sets the
 *                  minter for future tokens, adds / removes operators, and becomes
 *                  the admin of every token deployed.
 *      - operator  a server key allowed to deploy property tokens (so publishing a
 *                  property needs no multisig signature). Cannot do anything else.
 *      - minter    the hot server key granted MINTER_ROLE + PAUSER_ROLE on each new
 *                  token. Changing it affects future tokens only; on existing tokens
 *                  the multisig grants / revokes roles directly.
 */
contract PropertyTokenFactory is Ownable2Step {
    /// @notice propertySlug => deployed PropertyToken address (address(0) if none).
    mapping(string => address) public tokenForSlug;

    /// @notice All deployed token addresses, in deployment order.
    address[] public allTokens;

    /// @notice Server keys allowed to call {deployPropertyToken}.
    mapping(address => bool) public isOperator;

    /// @notice Hot key granted MINTER_ROLE + PAUSER_ROLE on each newly deployed token.
    address public minter;

    event PropertyTokenDeployed(
        string indexed propertySlugIndexed,
        string propertySlug,
        address indexed tokenAddress,
        uint256 maxSupply,
        uint256 nominalPriceUsd
    );
    event OperatorSet(address indexed operator, bool allowed);
    event MinterSet(address indexed previousMinter, address indexed newMinter);

    /**
     * @param owner_    the multisig (on a test network it may be the deployer key).
     * @param minter_   the hot minting key.
     * @param operator_ a server key allowed to deploy tokens (address(0) for none).
     */
    constructor(address owner_, address minter_, address operator_) Ownable(owner_) {
        _setMinter(minter_);
        if (operator_ != address(0)) {
            isOperator[operator_] = true;
            emit OperatorSet(operator_, true);
        }
    }

    modifier onlyOwnerOrOperator() {
        require(msg.sender == owner() || isOperator[msg.sender], "Factory: not owner or operator");
        _;
    }

    function setOperator(address operator_, bool allowed) external onlyOwner {
        require(operator_ != address(0), "Factory: operator is zero address");
        isOperator[operator_] = allowed;
        emit OperatorSet(operator_, allowed);
    }

    function setMinter(address minter_) external onlyOwner {
        _setMinter(minter_);
    }

    function _setMinter(address minter_) private {
        require(minter_ != address(0), "Factory: minter is zero address");
        emit MinterSet(minter, minter_);
        minter = minter_;
    }

    /**
     * @notice Deploy a new PropertyToken for `propertySlug_`. Owner or operator.
     * @dev Reverts if a token already exists for the slug. The token's admin is the
     *      factory owner (multisig); its minter is the current `minter`.
     */
    function deployPropertyToken(
        string calldata name_,
        string calldata symbol_,
        uint256 maxSupply_,
        uint256 nominalPriceUsd_,
        string calldata propertySlug_
    ) external onlyOwnerOrOperator returns (address) {
        require(bytes(propertySlug_).length > 0, "Factory: empty slug");
        require(tokenForSlug[propertySlug_] == address(0), "Factory: slug already deployed");
        PropertyToken token = new PropertyToken(
            name_,
            symbol_,
            maxSupply_,
            nominalPriceUsd_,
            propertySlug_,
            owner(),
            minter
        );
        address tokenAddress = address(token);
        tokenForSlug[propertySlug_] = tokenAddress;
        allTokens.push(tokenAddress);
        emit PropertyTokenDeployed(propertySlug_, propertySlug_, tokenAddress, maxSupply_, nominalPriceUsd_);
        return tokenAddress;
    }

    /// @notice Number of property tokens deployed by this factory.
    function totalDeployed() external view returns (uint256) {
        return allTokens.length;
    }
}
