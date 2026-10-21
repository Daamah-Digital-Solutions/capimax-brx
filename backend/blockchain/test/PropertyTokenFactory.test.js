const { expect } = require("chai");
const { ethers } = require("hardhat");

// Contract-level tests for PropertyTokenFactory: one token per property, the owner
// (multisig) / operator (server deployer) / minter (hot key) split, two-step ownership.
describe("PropertyTokenFactory", function () {
  async function deploy() {
    const [owner, minter, operator, attacker, alice, newOwner] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("PropertyTokenFactory");
    const factory = await Factory.deploy(owner.address, minter.address, operator.address);
    await factory.waitForDeployment();
    return { factory, owner, minter, operator, attacker, alice, newOwner };
  }

  const role = (name) => ethers.keccak256(ethers.toUtf8Bytes(name));
  const tokenAt = (addr) => ethers.getContractAt("PropertyToken", addr);

  it("records owner, minter and operator", async function () {
    const { factory, owner, minter, operator, attacker } = await deploy();
    expect(await factory.owner()).to.equal(owner.address);
    expect(await factory.minter()).to.equal(minter.address);
    expect(await factory.isOperator(operator.address)).to.equal(true);
    expect(await factory.isOperator(attacker.address)).to.equal(false);
    expect(await factory.totalDeployed()).to.equal(0n);
  });

  it("lets the operator deploy; the token's admin is the owner and its minter the hot key", async function () {
    const { factory, owner, minter, operator, alice } = await deploy();
    const tx = await factory.connect(operator).deployPropertyToken("Capimax BRX - A", "BRXA", 1000n, 100n, "prop-a");
    await expect(tx).to.emit(factory, "PropertyTokenDeployed");
    const addr = await factory.tokenForSlug("prop-a");
    expect(addr).to.not.equal(ethers.ZeroAddress);
    expect(await factory.allTokens(0)).to.equal(addr);

    const token = await tokenAt(addr);
    expect(await token.maxSupply()).to.equal(1000n);
    expect(await token.hasRole(ethers.ZeroHash, owner.address)).to.equal(true);
    expect(await token.hasRole(role("CONTROLLER_ROLE"), owner.address)).to.equal(true);
    expect(await token.hasRole(role("MINTER_ROLE"), minter.address)).to.equal(true);
    // the operator only deploys — it gets no power over the token
    for (const r of ["MINTER_ROLE", "PAUSER_ROLE", "CONTROLLER_ROLE"]) {
      expect(await token.hasRole(role(r), operator.address)).to.equal(false);
    }
    expect(await token.hasRole(ethers.ZeroHash, operator.address)).to.equal(false);

    await token.connect(minter).mint(alice.address, 7n);
    expect(await token.balanceOf(alice.address)).to.equal(7n);
  });

  it("lets the owner deploy too, and blocks everyone else", async function () {
    const { factory, owner, attacker } = await deploy();
    await factory.connect(owner).deployPropertyToken("N", "S", 10n, 100n, "by-owner");
    await expect(factory.connect(attacker).deployPropertyToken("N", "S", 10n, 100n, "evil"))
      .to.be.revertedWith("Factory: not owner or operator");
  });

  it("refuses a duplicate or empty slug", async function () {
    const { factory, operator } = await deploy();
    await factory.connect(operator).deployPropertyToken("N", "S", 10n, 100n, "dup");
    await expect(factory.connect(operator).deployPropertyToken("N", "S", 10n, 100n, "dup"))
      .to.be.revertedWith("Factory: slug already deployed");
    await expect(factory.connect(operator).deployPropertyToken("N", "S", 10n, 100n, ""))
      .to.be.revertedWith("Factory: empty slug");
  });

  it("deploys distinct contracts for distinct properties", async function () {
    const { factory, operator } = await deploy();
    await factory.connect(operator).deployPropertyToken("A", "A", 10n, 100n, "a");
    await factory.connect(operator).deployPropertyToken("B", "B", 10n, 100n, "b");
    expect(await factory.tokenForSlug("a")).to.not.equal(await factory.tokenForSlug("b"));
    expect(await factory.totalDeployed()).to.equal(2n);
  });

  it("only the owner manages operators and the minter; a new minter applies to new tokens only", async function () {
    const { factory, owner, minter, operator, attacker, alice } = await deploy();
    await expect(factory.connect(operator).setOperator(attacker.address, true))
      .to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    await expect(factory.connect(minter).setMinter(attacker.address))
      .to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");

    await factory.connect(operator).deployPropertyToken("Old", "OLD", 10n, 100n, "old");
    await expect(factory.connect(owner).setMinter(alice.address))
      .to.emit(factory, "MinterSet").withArgs(minter.address, alice.address);
    await factory.connect(operator).deployPropertyToken("New", "NEW", 10n, 100n, "new");

    const oldToken = await tokenAt(await factory.tokenForSlug("old"));
    const newToken = await tokenAt(await factory.tokenForSlug("new"));
    expect(await oldToken.hasRole(role("MINTER_ROLE"), minter.address)).to.equal(true);
    expect(await newToken.hasRole(role("MINTER_ROLE"), alice.address)).to.equal(true);
    expect(await newToken.hasRole(role("MINTER_ROLE"), minter.address)).to.equal(false);

    await factory.connect(owner).setOperator(operator.address, false);
    await expect(factory.connect(operator).deployPropertyToken("X", "X", 10n, 100n, "x"))
      .to.be.revertedWith("Factory: not owner or operator");
    await expect(factory.connect(owner).setMinter(ethers.ZeroAddress))
      .to.be.revertedWith("Factory: minter is zero address");
  });

  it("transfers ownership in two steps (the new owner must accept)", async function () {
    const { factory, owner, newOwner, attacker } = await deploy();
    await factory.connect(owner).transferOwnership(newOwner.address);
    expect(await factory.owner()).to.equal(owner.address);
    expect(await factory.pendingOwner()).to.equal(newOwner.address);
    await expect(factory.connect(attacker).acceptOwnership())
      .to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    await factory.connect(newOwner).acceptOwnership();
    expect(await factory.owner()).to.equal(newOwner.address);
  });

  it("can run on a test network with one key in every seat", async function () {
    const [solo, alice] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("PropertyTokenFactory");
    const factory = await Factory.deploy(solo.address, solo.address, solo.address);
    await factory.deployPropertyToken("Solo", "SOLO", 10n, 100n, "solo");
    const token = await tokenAt(await factory.tokenForSlug("solo"));
    await token.mint(alice.address, 1n);
    await token.pause();
    await token.unpause();
    await token.clawback(alice.address, ethers.ZeroAddress, 1n, "test");
    expect(await token.totalSupply()).to.equal(0n);
  });

  it("fits within the 24 KB contract size limit", async function () {
    const { factory } = await deploy();
    const code = await ethers.provider.getCode(await factory.getAddress());
    expect((code.length - 2) / 2).to.be.lessThan(24576);
  });
});
