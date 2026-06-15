const { expect } = require("chai");
const { ethers } = require("hardhat");

// Contract-level tests for PropertyTokenFactory (one token per property).
describe("PropertyTokenFactory", function () {
  async function deploy() {
    const [platform, attacker, alice] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("PropertyTokenFactory");
    const factory = await Factory.deploy(platform.address);
    await factory.waitForDeployment();
    return { factory, platform, attacker, alice };
  }

  it("is owned by the platform deployer", async function () {
    const { factory, platform } = await deploy();
    expect(await factory.owner()).to.equal(platform.address);
    expect(await factory.totalDeployed()).to.equal(0n);
  });

  it("deploys a PropertyToken and records it by slug", async function () {
    const { factory, platform } = await deploy();
    const tx = await factory.deployPropertyToken(
      "Capimax BRX - Marina Tower",
      "BRX1",
      50000n,
      100n,
      "1"
    );
    await expect(tx).to.emit(factory, "PropertyTokenDeployed");

    const tokenAddress = await factory.tokenForSlug("1");
    expect(tokenAddress).to.not.equal(ethers.ZeroAddress);
    expect(await factory.totalDeployed()).to.equal(1n);
    expect(await factory.allTokens(0)).to.equal(tokenAddress);

    // The deployed child is a real PropertyToken with the right economics, and
    // the platform (factory owner) is its admin + minter.
    const token = await ethers.getContractAt("PropertyToken", tokenAddress);
    expect(await token.maxSupply()).to.equal(50000n);
    expect(await token.nominalPriceUsd()).to.equal(100n);
    expect(await token.propertySlug()).to.equal("1");
    const MINTER = await token.MINTER_ROLE();
    expect(await token.hasRole(MINTER, platform.address)).to.equal(true);
  });

  it("lets the platform mint on a factory-deployed token", async function () {
    const { factory, platform, alice } = await deploy();
    await factory.deployPropertyToken("P", "P", 1000n, 100n, "10");
    const token = await ethers.getContractAt(
      "PropertyToken",
      await factory.tokenForSlug("10")
    );
    await token.connect(platform).mint(alice.address, 25n);
    expect(await token.balanceOf(alice.address)).to.equal(25n);
  });

  it("blocks non-owners from deploying", async function () {
    const { factory, attacker } = await deploy();
    await expect(
      factory
        .connect(attacker)
        .deployPropertyToken("X", "X", 1000n, 100n, "99")
    ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
  });

  it("refuses a duplicate slug (one contract per property)", async function () {
    const { factory } = await deploy();
    await factory.deployPropertyToken("A", "A", 1000n, 100n, "7");
    await expect(
      factory.deployPropertyToken("A2", "A2", 2000n, 100n, "7")
    ).to.be.revertedWith("Factory: slug already deployed");
  });

  it("deploys distinct contracts for distinct properties", async function () {
    const { factory } = await deploy();
    await factory.deployPropertyToken("A", "A", 1000n, 100n, "a");
    await factory.deployPropertyToken("B", "B", 2000n, 100n, "b");
    const a = await factory.tokenForSlug("a");
    const b = await factory.tokenForSlug("b");
    expect(a).to.not.equal(b);
    expect(await factory.totalDeployed()).to.equal(2n);
  });
});
