const { expect } = require("chai");
const { ethers } = require("hardhat");

// Contract-level tests for PropertyToken (the per-property ownership token).
// Run on the in-process Hardhat network: `npm test`.
describe("PropertyToken", function () {
  const NAME = "Capimax BRX - Test Tower";
  const SYMBOL = "BRXT";
  const MAX_SUPPLY = 50000n; // mirrors a property's token_supply (5,000,000 / 100)
  const NOMINAL = 100n; // $100 per token
  const SLUG = "1";

  async function deploy() {
    const [platform, alice, bob] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("PropertyToken");
    const token = await Token.deploy(
      NAME,
      SYMBOL,
      MAX_SUPPLY,
      NOMINAL,
      SLUG,
      platform.address
    );
    await token.waitForDeployment();
    return { token, platform, alice, bob };
  }

  it("sets immutable economics + metadata from the constructor", async function () {
    const { token } = await deploy();
    expect(await token.name()).to.equal(NAME);
    expect(await token.symbol()).to.equal(SYMBOL);
    expect(await token.maxSupply()).to.equal(MAX_SUPPLY);
    expect(await token.nominalPriceUsd()).to.equal(NOMINAL);
    expect(await token.propertySlug()).to.equal(SLUG);
  });

  it("uses 0 decimals (whole, indivisible shares)", async function () {
    const { token } = await deploy();
    expect(await token.decimals()).to.equal(0);
  });

  it("starts with zero supply (Wave 1 deploys; minting is Wave 2)", async function () {
    const { token } = await deploy();
    expect(await token.totalSupply()).to.equal(0n);
    expect(await token.remainingSupply()).to.equal(MAX_SUPPLY);
  });

  it("grants admin + minter role to the platform address only", async function () {
    const { token, platform, alice } = await deploy();
    const MINTER = await token.MINTER_ROLE();
    const ADMIN = await token.DEFAULT_ADMIN_ROLE();
    expect(await token.hasRole(MINTER, platform.address)).to.equal(true);
    expect(await token.hasRole(ADMIN, platform.address)).to.equal(true);
    expect(await token.hasRole(MINTER, alice.address)).to.equal(false);
  });

  it("lets the platform mint within the cap and emits TokensMinted", async function () {
    const { token, platform, alice } = await deploy();
    await expect(token.connect(platform).mint(alice.address, 100n))
      .to.emit(token, "TokensMinted")
      .withArgs(alice.address, 100n, 100n);
    expect(await token.balanceOf(alice.address)).to.equal(100n);
    expect(await token.totalSupply()).to.equal(100n);
    expect(await token.remainingSupply()).to.equal(MAX_SUPPLY - 100n);
  });

  it("reverts when a non-minter tries to mint", async function () {
    const { token, alice, bob } = await deploy();
    await expect(
      token.connect(alice).mint(bob.address, 1n)
    ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
  });

  it("enforces the fixed supply cap", async function () {
    const { token, platform, alice } = await deploy();
    await token.connect(platform).mint(alice.address, MAX_SUPPLY);
    expect(await token.totalSupply()).to.equal(MAX_SUPPLY);
    await expect(
      token.connect(platform).mint(alice.address, 1n)
    ).to.be.revertedWith("PropertyToken: cap exceeded");
  });

  it("rejects a zero mint amount", async function () {
    const { token, platform, alice } = await deploy();
    await expect(
      token.connect(platform).mint(alice.address, 0n)
    ).to.be.revertedWith("PropertyToken: amount must be > 0");
  });

  it("supports standard ERC20 transfer of shares between holders", async function () {
    const { token, platform, alice, bob } = await deploy();
    await token.connect(platform).mint(alice.address, 10n);
    await expect(token.connect(alice).transfer(bob.address, 4n))
      .to.emit(token, "Transfer")
      .withArgs(alice.address, bob.address, 4n);
    expect(await token.balanceOf(alice.address)).to.equal(6n);
    expect(await token.balanceOf(bob.address)).to.equal(4n);
  });

  it("rejects a zero maxSupply at construction", async function () {
    const [platform] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("PropertyToken");
    await expect(
      Token.deploy(NAME, SYMBOL, 0n, NOMINAL, SLUG, platform.address)
    ).to.be.revertedWith("PropertyToken: maxSupply must be > 0");
  });
});
