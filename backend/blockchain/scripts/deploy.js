// Deploy the PropertyTokenFactory (platform infrastructure) to BSC Testnet, and
// optionally one demo PropertyToken so the contracts are provable on-chain
// independent of the Django app.
//
// Usage:
//   npm run deploy:testnet            # deploy factory (+ demo token)
//
// SAFETY: targets the `bscTestnet` network only (see hardhat.config.js). The RPC
// URL and deployer key come from backend/.env (BSC_TESTNET_RPC_URL,
// DEPLOYER_PRIVATE_KEY). UNAUDITED — testnet only.
//
// After running, copy the printed factory address into backend/.env as
// PROPERTY_TOKEN_FACTORY_ADDRESS so the Django chain layer can use it.
const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer account. Set DEPLOYER_PRIVATE_KEY in backend/.env."
    );
  }

  const net = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Network:        ", network.name, "chainId", net.chainId.toString());
  console.log("Deployer:       ", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "BNB");
  if (balance === 0n) {
    throw new Error(
      "Deployer has 0 testnet BNB. Fund it from a BSC Testnet faucet first."
    );
  }

  // 1) Factory (owned by the deployer / platform).
  console.log("\nDeploying PropertyTokenFactory...");
  const Factory = await ethers.getContractFactory("PropertyTokenFactory");
  const factory = await Factory.deploy(deployer.address);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  const factoryTx = factory.deploymentTransaction();
  console.log("  PropertyTokenFactory:", factoryAddress);
  console.log("  tx:", factoryTx.hash);

  // 2) One demo PropertyToken via the factory (proves the per-property path).
  const demoSlug = process.env.DEMO_PROPERTY_SLUG || "1";
  const demoSupply = BigInt(process.env.DEMO_PROPERTY_SUPPLY || "50000");
  console.log(`\nDeploying a demo PropertyToken for property "${demoSlug}"...`);
  const deployTx = await factory.deployPropertyToken(
    "Capimax BRX - Demo Property",
    "BRXD",
    demoSupply,
    100n,
    demoSlug
  );
  const receipt = await deployTx.wait();
  const tokenAddress = await factory.tokenForSlug(demoSlug);
  console.log("  PropertyToken:", tokenAddress);
  console.log("  tx:", receipt.hash);

  const explorer = "https://testnet.bscscan.com";
  console.log("\n--- Summary (BSC Testnet) ---");
  console.log("Factory:   ", `${explorer}/address/${factoryAddress}`);
  console.log("DemoToken: ", `${explorer}/address/${tokenAddress}`);
  console.log("\nAdd to backend/.env:");
  console.log(`PROPERTY_TOKEN_FACTORY_ADDRESS=${factoryAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
