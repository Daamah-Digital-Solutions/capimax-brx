const { expect } = require("chai");
const { ethers } = require("hardhat");

// Contract-level tests for PropertyToken: economics, the role split (admin multisig vs
// hot minter), the emergency pause, and controller clawback / burn.
describe("PropertyToken", function () {
  const MAX_SUPPLY = 50000n;
  const PRICE = 100n;
  const SLUG = "marina-tower";

  async function deploy() {
    const [admin, minter, attacker, alice, bob] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("PropertyToken");
    const token = await Token.deploy(
      "Capimax BRX - Marina Tower", "BRXMARINA", MAX_SUPPLY, PRICE, SLUG,
      admin.address, minter.address,
    );
    await token.waitForDeployment();
    return { token, admin, minter, attacker, alice, bob };
  }

  const role = (name) => ethers.keccak256(ethers.toUtf8Bytes(name));
  const DEFAULT_ADMIN = ethers.ZeroHash;

  it("sets immutable economics + metadata from the constructor", async function () {
    const { token } = await deploy();
    expect(await token.maxSupply()).to.equal(MAX_SUPPLY);
    expect(await token.nominalPriceUsd()).to.equal(PRICE);
    expect(await token.propertySlug()).to.equal(SLUG);
    expect(await token.decimals()).to.equal(0);
    expect(await token.totalSupply()).to.equal(0n);
    expect(await token.remainingSupply()).to.equal(MAX_SUPPLY);
  });

  it("splits powers: admin = admin/pauser/controller, minter = minter/pauser only", async function () {
    const { token, admin, minter, attacker } = await deploy();
    expect(await token.hasRole(DEFAULT_ADMIN, admin.address)).to.equal(true);
    expect(await token.hasRole(role("CONTROLLER_ROLE"), admin.address)).to.equal(true);
    expect(await token.hasRole(role("PAUSER_ROLE"), admin.address)).to.equal(true);
    expect(await token.hasRole(role("MINTER_ROLE"), admin.address)).to.equal(false);

    expect(await token.hasRole(role("MINTER_ROLE"), minter.address)).to.equal(true);
    expect(await token.hasRole(role("PAUSER_ROLE"), minter.address)).to.equal(true);
    expect(await token.hasRole(DEFAULT_ADMIN, minter.address)).to.equal(false);
    expect(await token.hasRole(role("CONTROLLER_ROLE"), minter.address)).to.equal(false);

    for (const r of ["MINTER_ROLE", "PAUSER_ROLE", "CONTROLLER_ROLE"]) {
      expect(await token.hasRole(role(r), attacker.address)).to.equal(false);
    }
  });

  it("rejects zero admin / minter / supply at construction", async function () {
    const [a] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("PropertyToken");
    await expect(Token.deploy("N", "S", 0n, PRICE, SLUG, a.address, a.address))
      .to.be.revertedWith("PropertyToken: maxSupply must be > 0");
    await expect(Token.deploy("N", "S", 1n, PRICE, SLUG, ethers.ZeroAddress, a.address))
      .to.be.revertedWith("PropertyToken: admin is zero address");
    await expect(Token.deploy("N", "S", 1n, PRICE, SLUG, a.address, ethers.ZeroAddress))
      .to.be.revertedWith("PropertyToken: minter is zero address");
  });

  it("lets the minter mint within the cap and emits TokensMinted", async function () {
    const { token, minter, alice } = await deploy();
    await expect(token.connect(minter).mint(alice.address, 250n))
      .to.emit(token, "TokensMinted").withArgs(alice.address, 250n, 250n);
    expect(await token.balanceOf(alice.address)).to.equal(250n);
  });

  it("does not let the admin multisig or an outsider mint", async function () {
    const { token, admin, attacker, alice } = await deploy();
    await expect(token.connect(admin).mint(alice.address, 1n))
      .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    await expect(token.connect(attacker).mint(attacker.address, 1n))
      .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
  });

  it("enforces the cap and rejects a zero mint", async function () {
    const { token, minter, alice } = await deploy();
    await token.connect(minter).mint(alice.address, MAX_SUPPLY);
    await expect(token.connect(minter).mint(alice.address, 1n))
      .to.be.revertedWith("PropertyToken: cap exceeded");
    await expect(token.connect(minter).mint(alice.address, 0n))
      .to.be.revertedWith("PropertyToken: amount must be > 0");
  });

  it("supports standard ERC20 transfers between holders", async function () {
    const { token, minter, alice, bob } = await deploy();
    await token.connect(minter).mint(alice.address, 10n);
    await expect(token.connect(alice).transfer(bob.address, 4n))
      .to.emit(token, "Transfer").withArgs(alice.address, bob.address, 4n);
    expect(await token.balanceOf(bob.address)).to.equal(4n);
  });

  describe("emergency pause", function () {
    it("can be pulled by the hot minter key and stops mints and transfers", async function () {
      const { token, minter, alice, bob } = await deploy();
      await token.connect(minter).mint(alice.address, 10n);
      await token.connect(minter).pause();
      expect(await token.paused()).to.equal(true);
      await expect(token.connect(minter).mint(alice.address, 1n))
        .to.be.revertedWithCustomError(token, "EnforcedPause");
      await expect(token.connect(alice).transfer(bob.address, 1n))
        .to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("can only be released by the admin multisig", async function () {
      const { token, admin, minter, attacker } = await deploy();
      await token.connect(admin).pause();
      await expect(token.connect(minter).unpause())
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
      await expect(token.connect(attacker).pause())
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
      await token.connect(admin).unpause();
      expect(await token.paused()).to.equal(false);
    });
  });

  describe("controller clawback", function () {
    it("moves a holder's shares without their signature", async function () {
      const { token, admin, minter, alice, bob } = await deploy();
      await token.connect(minter).mint(alice.address, 10n);
      await expect(token.connect(admin).clawback(alice.address, bob.address, 3n, "court order 17"))
        .to.emit(token, "Clawback").withArgs(alice.address, bob.address, 3n, "court order 17");
      expect(await token.balanceOf(alice.address)).to.equal(7n);
      expect(await token.balanceOf(bob.address)).to.equal(3n);
    });

    it("burns to address(0), which frees the cap for a new mint", async function () {
      const { token, admin, minter, alice, bob } = await deploy();
      await token.connect(minter).mint(alice.address, MAX_SUPPLY);
      await token.connect(admin).clawback(alice.address, ethers.ZeroAddress, 100n, "installment forfeit");
      expect(await token.totalSupply()).to.equal(MAX_SUPPLY - 100n);
      await token.connect(minter).mint(bob.address, 100n);
      expect(await token.totalSupply()).to.equal(MAX_SUPPLY);
    });

    it("works while the token is paused (recover units during an emergency)", async function () {
      const { token, admin, minter, alice, bob } = await deploy();
      await token.connect(minter).mint(alice.address, 5n);
      await token.connect(minter).pause();
      await token.connect(admin).clawback(alice.address, bob.address, 5n, "compromised wallet");
      expect(await token.balanceOf(bob.address)).to.equal(5n);
      // ...and the pause still holds for everyone else afterwards.
      await expect(token.connect(bob).transfer(alice.address, 1n))
        .to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("is refused to the minter and to outsiders, and checks its inputs", async function () {
      const { token, admin, minter, attacker, alice } = await deploy();
      await token.connect(minter).mint(alice.address, 5n);
      await expect(token.connect(minter).clawback(alice.address, minter.address, 1n, "x"))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
      await expect(token.connect(attacker).clawback(alice.address, attacker.address, 1n, "x"))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
      await expect(token.connect(admin).clawback(alice.address, admin.address, 0n, "x"))
        .to.be.revertedWith("PropertyToken: amount must be > 0");
      await expect(token.connect(admin).clawback(ethers.ZeroAddress, admin.address, 1n, "x"))
        .to.be.revertedWith("PropertyToken: from is zero address");
      await expect(token.connect(admin).clawback(alice.address, admin.address, 6n, "x"))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });
  });

  describe("role management", function () {
    it("the admin can revoke a leaked minter key and appoint a new one", async function () {
      const { token, admin, minter, alice, bob } = await deploy();
      await token.connect(admin).revokeRole(role("MINTER_ROLE"), minter.address);
      await token.connect(admin).revokeRole(role("PAUSER_ROLE"), minter.address);
      await expect(token.connect(minter).mint(minter.address, 1n))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
      await token.connect(admin).grantRole(role("MINTER_ROLE"), bob.address);
      await token.connect(bob).mint(alice.address, 1n);
      expect(await token.balanceOf(alice.address)).to.equal(1n);
    });

    it("the minter cannot grant itself more powers", async function () {
      const { token, minter } = await deploy();
      await expect(token.connect(minter).grantRole(role("CONTROLLER_ROLE"), minter.address))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
      await expect(token.connect(minter).grantRole(DEFAULT_ADMIN, minter.address))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });
  });
});
