import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("AegisScanner", function () {
  async function deployScannerFixture() {
    const [owner, scanner1, scanner2, user1] = await ethers.getSigners();

    const Scanner = await ethers.getContractFactory("AegisScanner");
    const aegisScanner = await Scanner.deploy();

    // Authorize scanner1
    await aegisScanner.setScannerAuthorization(scanner1.address, true);

    return { aegisScanner, owner, scanner1, scanner2, user1 };
  }

  // Helper: generate a random token-like address
  function randomAddress() {
    return ethers.Wallet.createRandom().address;
  }

  // Standard bool flags: [honeypot, canMint, canPause, canBlacklist, renounced, lpLocked, verified]
  const SAFE_FLAGS: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] = [false, false, false, false, true, true, true];
  const HONEYPOT_FLAGS: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] = [true, true, true, true, false, false, false];
  const RISKY_FLAGS: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] = [false, true, true, false, false, false, false];

  describe("Deployment", function () {
    it("should set correct owner", async function () {
      const { aegisScanner, owner } = await loadFixture(deployScannerFixture);
      expect(await aegisScanner.owner()).to.equal(owner.address);
    });

    it("should authorize owner as scanner by default", async function () {
      const { aegisScanner, owner } = await loadFixture(deployScannerFixture);
      expect(await aegisScanner.authorizedScanners(owner.address)).to.be.true;
    });

    it("should start with zero scans", async function () {
      const { aegisScanner } = await loadFixture(deployScannerFixture);
      expect(await aegisScanner.totalScans()).to.equal(0);
      expect(await aegisScanner.getScannedTokenCount()).to.equal(0);
    });

    it("should start with zero honeypots and rug risks", async function () {
      const { aegisScanner } = await loadFixture(deployScannerFixture);
      expect(await aegisScanner.totalHoneypots()).to.equal(0);
      expect(await aegisScanner.totalRugRisks()).to.equal(0);
    });
  });

  describe("Scanner Authorization", function () {
    it("should allow owner to authorize a scanner", async function () {
      const { aegisScanner, scanner2 } = await loadFixture(deployScannerFixture);
      await aegisScanner.setScannerAuthorization(scanner2.address, true);
      expect(await aegisScanner.authorizedScanners(scanner2.address)).to.be.true;
    });

    it("should allow owner to revoke a scanner", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      await aegisScanner.setScannerAuthorization(scanner1.address, false);
      expect(await aegisScanner.authorizedScanners(scanner1.address)).to.be.false;
    });

    it("should emit ScannerAuthorized event", async function () {
      const { aegisScanner, scanner2 } = await loadFixture(deployScannerFixture);
      await expect(aegisScanner.setScannerAuthorization(scanner2.address, true))
        .to.emit(aegisScanner, "ScannerAuthorized")
        .withArgs(scanner2.address, true);
    });

    it("should reject non-owner authorization", async function () {
      const { aegisScanner, scanner1, scanner2 } = await loadFixture(deployScannerFixture);
      await expect(
        aegisScanner.connect(scanner1).setScannerAuthorization(scanner2.address, true)
      ).to.be.revertedWithCustomError(aegisScanner, "OwnableUnauthorizedAccount");
    });
  });

  describe("Submit Scan", function () {
    it("should accept a valid scan from authorized scanner", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await expect(
        aegisScanner.connect(scanner1).submitScan(
          token, 25, ethers.parseEther("50000"), 1500, 1200, 300, 300, SAFE_FLAGS, "VERIFIED"
        )
      ).to.emit(aegisScanner, "TokenScanned");
    });

    it("should reject scan from unauthorized address", async function () {
      const { aegisScanner, user1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await expect(
        aegisScanner.connect(user1).submitScan(
          token, 25, ethers.parseEther("50000"), 1500, 1200, 300, 300, SAFE_FLAGS, ""
        )
      ).to.be.revertedWith("Not authorized scanner");
    });

    it("should reject zero address token", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);

      await expect(
        aegisScanner.connect(scanner1).submitScan(
          ethers.ZeroAddress, 25, 0, 0, 0, 0, 0, SAFE_FLAGS, ""
        )
      ).to.be.revertedWith("Invalid token");
    });

    it("should reject risk score > 100", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await expect(
        aegisScanner.connect(scanner1).submitScan(
          token, 101, 0, 0, 0, 0, 0, SAFE_FLAGS, ""
        )
      ).to.be.revertedWith("Risk score 0-100");
    });

    it("should reject topHolderPercent > 10000", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await expect(
        aegisScanner.connect(scanner1).submitScan(
          token, 50, 0, 0, 10001, 0, 0, SAFE_FLAGS, ""
        )
      ).to.be.revertedWith("Percent in bps");
    });

    it("should store all scan fields correctly", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1).submitScan(
        token, 35, ethers.parseEther("25000"), 800, 2500, 500, 700, RISKY_FLAGS, "MINT_FUNCTION,PAUSE_FUNCTION"
      );

      const scan = await aegisScanner.getTokenScan(token);
      expect(scan.token).to.equal(token);
      expect(scan.riskScore).to.equal(35);
      expect(scan.liquidity).to.equal(ethers.parseEther("25000"));
      expect(scan.holderCount).to.equal(800);
      expect(scan.topHolderPercent).to.equal(2500);
      expect(scan.buyTax).to.equal(500);
      expect(scan.sellTax).to.equal(700);
      expect(scan.isHoneypot).to.be.false;
      expect(scan.ownerCanMint).to.be.true;
      expect(scan.ownerCanPause).to.be.true;
      expect(scan.ownerCanBlacklist).to.be.false;
      expect(scan.isContractRenounced).to.be.false;
      expect(scan.isLiquidityLocked).to.be.false;
      expect(scan.isVerified).to.be.false;
      expect(scan.scannedBy).to.equal(scanner1.address);
      expect(scan.flags).to.equal("MINT_FUNCTION,PAUSE_FUNCTION");
    });

    it("should overwrite previous scan for same token", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1).submitScan(
        token, 80, 0, 10, 5000, 0, 0, HONEYPOT_FLAGS, "HONEYPOT"
      );
      expect(await aegisScanner.getTokenRiskScore(token)).to.equal(80);

      await aegisScanner.connect(scanner1).submitScan(
        token, 20, ethers.parseEther("100000"), 5000, 500, 100, 100, SAFE_FLAGS, "VERIFIED"
      );
      expect(await aegisScanner.getTokenRiskScore(token)).to.equal(20);
    });

    it("should increment totalScans on each scan", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);

      for (let i = 0; i < 3; i++) {
        await aegisScanner.connect(scanner1).submitScan(
          randomAddress(), 10 + i, 0, 0, 0, 0, 0, SAFE_FLAGS, ""
        );
      }
      expect(await aegisScanner.totalScans()).to.equal(3);
    });

    it("should track unique token count correctly on rescan", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1).submitScan(token, 30, 0, 0, 0, 0, 0, SAFE_FLAGS, "");
      await aegisScanner.connect(scanner1).submitScan(token, 40, 0, 0, 0, 0, 0, SAFE_FLAGS, "");

      expect(await aegisScanner.totalScans()).to.equal(2);
      expect(await aegisScanner.getScannedTokenCount()).to.equal(1);
    });

    it("should increment honeypot counter", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);

      await aegisScanner.connect(scanner1).submitScan(
        randomAddress(), 100, 0, 0, 0, 0, 0, HONEYPOT_FLAGS, "HONEYPOT"
      );
      expect(await aegisScanner.totalHoneypots()).to.equal(1);
    });

    it("should increment rug risk counter for score >= 70", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);

      await aegisScanner.connect(scanner1).submitScan(
        randomAddress(), 70, 0, 0, 0, 0, 0, RISKY_FLAGS, "RUG_PULL_RISK"
      );
      expect(await aegisScanner.totalRugRisks()).to.equal(1);
    });

    it("should not increment rug risk counter for score < 70", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);

      await aegisScanner.connect(scanner1).submitScan(
        randomAddress(), 69, 0, 0, 0, 0, 0, RISKY_FLAGS, ""
      );
      expect(await aegisScanner.totalRugRisks()).to.equal(0);
    });
  });

  describe("View Functions", function () {
    it("getTokenRiskScore should return correct score", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1).submitScan(
        token, 55, 0, 0, 0, 0, 0, SAFE_FLAGS, ""
      );
      expect(await aegisScanner.getTokenRiskScore(token)).to.equal(55);
    });

    it("isHoneypot should return correct status", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const safe = randomAddress();
      const honeypot = randomAddress();

      await aegisScanner.connect(scanner1).submitScan(safe, 10, 0, 0, 0, 0, 0, SAFE_FLAGS, "");
      await aegisScanner.connect(scanner1).submitScan(honeypot, 100, 0, 0, 0, 0, 0, HONEYPOT_FLAGS, "HONEYPOT");

      expect(await aegisScanner.isHoneypot(safe)).to.be.false;
      expect(await aegisScanner.isHoneypot(honeypot)).to.be.true;
    });

    it("isScanned should return false for unscanned token", async function () {
      const { aegisScanner } = await loadFixture(deployScannerFixture);
      expect(await aegisScanner.isScanned(randomAddress())).to.be.false;
    });

    it("isScanned should return true after scan", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await aegisScanner.connect(scanner1).submitScan(token, 10, 0, 0, 0, 0, 0, SAFE_FLAGS, "");
      expect(await aegisScanner.isScanned(token)).to.be.true;
    });

    it("getRecentScans should return most recent first", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const tokens = [randomAddress(), randomAddress(), randomAddress()];

      for (let i = 0; i < 3; i++) {
        await aegisScanner.connect(scanner1).submitScan(
          tokens[i], (i + 1) * 10, 0, 0, 0, 0, 0, SAFE_FLAGS, `TOKEN_${i}`
        );
      }

      const recent = await aegisScanner.getRecentScans(3);
      expect(recent.length).to.equal(3);
      // Most recent first
      expect(recent[0].token).to.equal(tokens[2]);
      expect(recent[1].token).to.equal(tokens[1]);
      expect(recent[2].token).to.equal(tokens[0]);
    });

    it("getRecentScans should handle count > total", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);

      await aegisScanner.connect(scanner1).submitScan(
        randomAddress(), 10, 0, 0, 0, 0, 0, SAFE_FLAGS, ""
      );

      const recent = await aegisScanner.getRecentScans(100);
      expect(recent.length).to.equal(1);
    });

    it("getScannerStats should return correct totals", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);

      // Submit: 1 safe, 1 honeypot, 1 risky (score 75)
      await aegisScanner.connect(scanner1).submitScan(randomAddress(), 10, 0, 0, 0, 0, 0, SAFE_FLAGS, "");
      await aegisScanner.connect(scanner1).submitScan(randomAddress(), 100, 0, 0, 0, 0, 0, HONEYPOT_FLAGS, "HONEYPOT");
      await aegisScanner.connect(scanner1).submitScan(randomAddress(), 75, 0, 0, 0, 0, 0, RISKY_FLAGS, "RUG_PULL_RISK");

      const [totalScans, totalHoneypots, totalRugRisks, totalTokens] = await aegisScanner.getScannerStats();
      expect(totalScans).to.equal(3);
      expect(totalHoneypots).to.equal(1);
      expect(totalRugRisks).to.equal(2); // honeypot (100 >= 70) + risky (75 >= 70)
      expect(totalTokens).to.equal(3);
    });
  });

  describe("Event Emission", function () {
    it("should emit TokenScanned with correct params", async function () {
      const { aegisScanner, scanner1 } = await loadFixture(deployScannerFixture);
      const token = randomAddress();

      await expect(
        aegisScanner.connect(scanner1).submitScan(
          token, 45, ethers.parseEther("10000"), 500, 3000, 200, 300, SAFE_FLAGS, "LIMITED_LIQUIDITY"
        )
      )
        .to.emit(aegisScanner, "TokenScanned")
        .withArgs(token, 45, false, ethers.parseEther("10000"), scanner1.address, (v: bigint) => v > 0n);
    });
  });
});
