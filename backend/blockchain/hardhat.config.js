require("@nomicfoundation/hardhat-toolbox");
// Load the SAME backend/.env the Django app uses, so the deployer key + RPC are
// configured in one place. blockchain/ sits inside backend/, so .env is one up.
require("dotenv").config({ path: __dirname + "/../.env" });

// ---------------------------------------------------------------------------
// SAFETY: TESTNET ONLY. This config intentionally defines NO mainnet network.
// The deployer key and RPC come exclusively from environment variables; nothing
// is hardcoded. A separate, audited config is required for any mainnet cutover.
// ---------------------------------------------------------------------------
const BSC_TESTNET_RPC_URL =
  process.env.BSC_TESTNET_RPC_URL || "https://bsc-testnet-rpc.publicnode.com";
const CHAIN_ID = parseInt(process.env.CHAIN_ID || "97", 10);
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";

// Hardhat rejects malformed account keys; only pass a key when one is present.
const accounts = DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [];

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // Local in-process network for the contract test suite (no key needed).
    hardhat: {},
    // BSC Testnet — the ONLY external target. chain id 97.
    bscTestnet: {
      url: BSC_TESTNET_RPC_URL,
      chainId: CHAIN_ID,
      accounts,
    },
  },
  // BscScan verification (optional; needs an API key). Testnet explorer.
  etherscan: {
    apiKey: { bscTestnet: process.env.BSCSCAN_API_KEY || "" },
  },
};
