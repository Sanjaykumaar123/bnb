import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("AegisTokenGate", function () {
  const BRONZE  = ethers.parseEther("10000");    // 10K
  const SILVER  = ethers.parseEther("100000");   // 100K
  const GOLD    = ethers.parseEther("1000000");  // 1M
  const TOTAL   = ethers.parseEther("1000000000"); // 1B supply

  async function deployTokenGateFixture() {
    const [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy mock $UNIQ token
    const Token = await ethers.getContractFactory("MockERC20");
    const uniq = await Token.deploy("Uniq Minds", "UNIQ", TOTAL);

    // Deploy TokenGate
    const Gate = await ethers.getContractFactory("AegisTokenGate");
    const gate = await Gate.deploy(await uniq.getAddress());

    return { gate, uniq, owner, user1, user2, user3 };
  }

  describe("Deployment", function () {
    it("should set correct token address", async function () {
      const { gate, uniq } = await loadFixture(deployTokenGateFixture);
      expect(await gate.uniqToken()).to.equal(await uniq.getAddress());
    });

    it("should set default thresholds", async function () {
      const { gate } = await loadFixture(deployTokenGateFixture);
      const [bronze, silver, gold] = await gate.getThresholds();
      expect(bronze).to.equal(BRONZE);
      expect(silver).to.equal(SILVER);
      expect(gold).to.equal(GOLD);
    });

    it("should set default discounts", async function () {
      const { gate } = await loadFixture(deployTokenGateFixture);
      const [bronze, silver, gold] = await gate.getDiscounts();
      expect(bronze).to.equal(10);
      expect(silver).to.equal(25);
      expect(gold).to.equal(40);
    });

    it("should revert on zero token address", async function () {
      const Gate = await ethers.getContractFactory("AegisTokenGate");
      await expect(
        Gate.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(Gate, "InvalidTokenAddress");
    });
  });

  describe("Tier Classification", function () {
    it("should return None for zero balance", async function () {
      const { gate, user1 } = await loadFixture(deployTokenGateFixture);
      expect(await gate.getHolderTier(user1.address)).to.equal(0); // None
    });

    it("should return None below bronze threshold", async function () {
      const { gate, uniq, owner, user1 } = await loadFixture(deployTokenGateFixture);
      await uniq.transfer(user1.address, ethers.parseEther("9999"));
      expect(await gate.getHolderTier(user1.address)).to.equal(0); // None
    });

    it("should return Bronze at exact threshold", async function () {
      const { gate, uniq, owner, user1 } = await loadFixture(deployTokenGateFixture);
      await uniq.transfer(user1.address, BRONZE);
      expect(await gate.getHolderTier(user1.address)).to.equal(1); // Bronze
    });

    it("should return Silver at exact threshold", async function () {
      const { gate, uniq, owner, user1 } = await loadFixture(deployTokenGateFixture);
      await uniq.transfer(user1.address, SILVER);
      expect(await gate.getHolderTier(user1.address)).to.equal(2); // Silver
    });

    it("should return Gold at exact threshold", async function () {
      const { gate, uniq, owner, user1 } = await loadFixture(deployTokenGateFixture);
      await uniq.transfer(user1.address, GOLD);
      expect(await gate.getHolderTier(user1.address)).to.equal(3); // Gold
    });

    it("should return Gold above gold threshold", async function () {
      const { gate, uniq, owner, user1 } = await loadFixture(deployTokenGateFixture);
      await uniq.transfer(user1.address, ethers.parseEther("5000000"));
      expect(await gate.getHolderTier(user1.address)).to.equal(3); // Gold
    });

    it("should return Bronze between bronze and silver", async function () {
      const { gate, uniq, owner, user1 } = await loadFixture(deployTokenGateFixture);
      await uniq.transfer(user1.address, ethers.parseEther("50000"));
      expect(await gate.getHolderTier(user1.address)).to.equal(1); // Bronze
    });

    it("should return Silver between silver and gold", async function () {
      const { gate, uniq, owner, user1 } = await loadFixture(deployTokenGateFixture);
      await uniq.transfer(user1.address, ethers.parseEther("500000"));
      expect(await gate.getHolderTier(user1.address)).to.equal(2); // Silver
    });
  });

  describe("Fee Discount", function () {
    it("should return 0 discount for no holdings", async function () {
      const { gate, user1 } = await loadFixture(deployTokenGateFixture);
      expect(await gate.getFeeDiscount(user1.address)).to.equal(0);
    });

    it("should return bronze discount for bronze tier", async function () {
      const { gate, uniq, owner, user1 } = await loadFixture(deployTokenGateFixture);
      await uniq.transfer(user1.address, BRONZE);
      expect(await gate.getFeeDiscount(user1.address)).to.equal(10);
    });

    it("should return silver discount for silver tier", async function () {
      const { gate, uniq, owner, user1 } = await loadFixture(deployTokenGateFixture);
      await uniq.transfer(user1.address, SILVER);
      expect(await gate.getFeeDiscount(user1.address)).to.equal(25);
    });

    it("should return gold discount for gold tier", async function () {
      const { gate, uniq, owner, user1 } = await loadFixture(deployTokenGateFixture);
      await uniq.transfer(user1.address, GOLD);
      expect(await gate.getFeeDiscount(user1.address)).to.equal(40);
    });
  });

  describe("Effective Fee", function () {
    it("should return full fee for non-holders", async function () {
      const { gate, user1 } = await loadFixture(deployTokenGateFixture);
      expect(await gate.getEffectiveFee(user1.address, 50)).to.equal(50);
    });

    it("should return discounted fee for bronze holder", async function () {
      const { gate, uniq, owner, user1 } = await loadFixture(deployTokenGateFixture);
      await uniq.transfer(user1.address, BRONZE);
      expect(await gate.getEffectiveFee(user1.address, 50)).to.equal(40); // 50 - 10
    });

    it("should return discounted fee for gold holder", async function () {
      const { gate, uniq, owner, user1 } = await loadFixture(deployTokenGateFixture);
      await uniq.transfer(user1.address, GOLD);
      expect(await gate.getEffectiveFee(user1.address, 50)).to.equal(10); // 50 - 40
    });

    it("should return 0 when discount exceeds base fee", async function () {
      const { gate, uniq, owner, user1 } = await loadFixture(deployTokenGateFixture);
      await uniq.transfer(user1.address, GOLD);
      expect(await gate.getEffectiveFee(user1.address, 30)).to.equal(0); // 30 - 40 = 0
    });
  });

  describe("isHolder", function () {
    it("should return false for zero balance", async function () {
      const { gate, user1 } = await loadFixture(deployTokenGateFixture);
      expect(await gate.isHolder(user1.address)).to.be.false;
    });

    it("should return true for any positive balance", async function () {
      const { gate, uniq, owner, user1 } = await loadFixture(deployTokenGateFixture);
      await uniq.transfer(user1.address, 1);
      expect(await gate.isHolder(user1.address)).to.be.true;
    });
  });

  describe("Balance & Info", function () {
    it("should return correct balance", async function () {
      const { gate, uniq, owner, user1 } = await loadFixture(deployTokenGateFixture);
      await uniq.transfer(user1.address, ethers.parseEther("12345"));
      expect(await gate.getBalance(user1.address)).to.equal(ethers.parseEther("12345"));
    });
  });

  describe("Admin: Thresholds", function () {
    it("should update thresholds", async function () {
      const { gate, owner } = await loadFixture(deployTokenGateFixture);

      const newBronze = ethers.parseEther("5000");
      const newSilver = ethers.parseEther("50000");
      const newGold   = ethers.parseEther("500000");

      await expect(
        gate.setThresholds(newBronze, newSilver, newGold)
      ).to.emit(gate, "ThresholdsUpdated");

      const [b, s, g] = await gate.getThresholds();
      expect(b).to.equal(newBronze);
      expect(s).to.equal(newSilver);
      expect(g).to.equal(newGold);
    });

    it("should revert on zero bronze threshold", async function () {
      const { gate } = await loadFixture(deployTokenGateFixture);

      await expect(
        gate.setThresholds(0, SILVER, GOLD)
      ).to.be.revertedWithCustomError(gate, "InvalidThreshold");
    });

    it("should revert on non-ascending thresholds", async function () {
      const { gate } = await loadFixture(deployTokenGateFixture);

      await expect(
        gate.setThresholds(SILVER, BRONZE, GOLD) // bronze >= silver
      ).to.be.revertedWithCustomError(gate, "ThresholdNotAscending");
    });

    it("should revert when silver >= gold", async function () {
      const { gate } = await loadFixture(deployTokenGateFixture);

      await expect(
        gate.setThresholds(BRONZE, GOLD, GOLD) // silver >= gold
      ).to.be.revertedWithCustomError(gate, "ThresholdNotAscending");
    });

    it("should revert non-owner threshold update", async function () {
      const { gate, user1 } = await loadFixture(deployTokenGateFixture);

      await expect(
        gate.connect(user1).setThresholds(BRONZE, SILVER, GOLD)
      ).to.be.revertedWithCustomError(gate, "OwnableUnauthorizedAccount");
    });
  });

  describe("Admin: Discounts", function () {
    it("should update discounts", async function () {
      const { gate } = await loadFixture(deployTokenGateFixture);

      await expect(
        gate.setDiscounts(15, 30, 50)
      ).to.emit(gate, "DiscountsUpdated");

      const [b, s, g] = await gate.getDiscounts();
      expect(b).to.equal(15);
      expect(s).to.equal(30);
      expect(g).to.equal(50);
    });

    it("should revert when gold discount exceeds 5%", async function () {
      const { gate } = await loadFixture(deployTokenGateFixture);

      await expect(
        gate.setDiscounts(10, 25, 501)
      ).to.be.revertedWithCustomError(gate, "InvalidDiscount");
    });

    it("should revert non-ascending discounts", async function () {
      const { gate } = await loadFixture(deployTokenGateFixture);

      await expect(
        gate.setDiscounts(30, 20, 40) // bronze > silver
      ).to.be.revertedWithCustomError(gate, "InvalidDiscount");
    });

    it("should revert non-owner discount update", async function () {
      const { gate, user1 } = await loadFixture(deployTokenGateFixture);

      await expect(
        gate.connect(user1).setDiscounts(10, 25, 40)
      ).to.be.revertedWithCustomError(gate, "OwnableUnauthorizedAccount");
    });
  });

  describe("Tier Changes on Transfer", function () {
    it("should downgrade tier when user sells tokens", async function () {
      const { gate, uniq, owner, user1, user2 } = await loadFixture(deployTokenGateFixture);

      // Give user1 gold-level tokens
      await uniq.transfer(user1.address, GOLD);
      expect(await gate.getHolderTier(user1.address)).to.equal(3); // Gold

      // User1 sells most tokens
      await uniq.connect(user1).transfer(user2.address, ethers.parseEther("990000"));
      expect(await gate.getHolderTier(user1.address)).to.equal(1); // Bronze (10K left)
    });

    it("should upgrade tier when user buys tokens", async function () {
      const { gate, uniq, owner, user1 } = await loadFixture(deployTokenGateFixture);

      await uniq.transfer(user1.address, BRONZE);
      expect(await gate.getHolderTier(user1.address)).to.equal(1); // Bronze

      await uniq.transfer(user1.address, SILVER - BRONZE); // top up to silver
      expect(await gate.getHolderTier(user1.address)).to.equal(2); // Silver
    });
  });
});
