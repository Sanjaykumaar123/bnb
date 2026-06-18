import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("AegisVault", function () {
  const REGISTRATION_FEE = ethers.parseEther("0.01");
  const MAX_AGENTS = 1000;
  const PROTOCOL_FEE_BPS = 50; // 0.5%
  const MIN_DEPOSIT = ethers.parseEther("0.001");
  const PERFORMANCE_FEE_BPS = 1500; // 15%

  async function deployFullFixture() {
    const [owner, user1, user2, agentOperator] = await ethers.getSigners();

    // Deploy Registry
    const Registry = await ethers.getContractFactory("AegisRegistry");
    const registry = await Registry.deploy(REGISTRATION_FEE, MAX_AGENTS);

    // Deploy Vault
    const Vault = await ethers.getContractFactory("AegisVault");
    const vault = await Vault.deploy(
      await registry.getAddress(),
      PROTOCOL_FEE_BPS,
      MIN_DEPOSIT,
      PERFORMANCE_FEE_BPS
    );

    // Authorize vault in registry
    await registry.setVaultAuthorization(await vault.getAddress(), true);

    // Register an agent
    await registry.connect(agentOperator).registerAgent(
      "Guardian Alpha",
      "ipfs://agent1",
      1, // Guardian tier
      { value: REGISTRATION_FEE }
    );

    // Authorize the agent operator in vault
    await vault.setOperatorAuthorization(agentOperator.address, true);

    return { registry, vault, owner, user1, user2, agentOperator };
  }

  describe("Deployment", function () {
    it("should set correct registry address", async function () {
      const { vault, registry } = await loadFixture(deployFullFixture);
      expect(await vault.registryAddress()).to.equal(await registry.getAddress());
    });

    it("should set correct protocol fee", async function () {
      const { vault } = await loadFixture(deployFullFixture);
      expect(await vault.protocolFeeBps()).to.equal(PROTOCOL_FEE_BPS);
    });

    it("should reject fee > 5%", async function () {
      const { registry } = await loadFixture(deployFullFixture);
      const Vault = await ethers.getContractFactory("AegisVault");
      await expect(
        Vault.deploy(await registry.getAddress(), 600, MIN_DEPOSIT, PERFORMANCE_FEE_BPS)
      ).to.be.revertedWithCustomError(Vault, "FeeTooHigh");
    });
  });

  describe("Deposits", function () {
    it("should accept BNB deposits", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      const depositAmount = ethers.parseEther("1");
      await expect(
        vault.connect(user1).deposit({ value: depositAmount })
      ).to.emit(vault, "Deposited");

      const position = await vault.getPosition(user1.address);
      expect(position.bnbBalance).to.equal(depositAmount);
      expect(position.isActive).to.be.true;
    });

    it("should reject deposits below minimum", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await expect(
        vault.connect(user1).deposit({ value: ethers.parseEther("0.0001") })
      ).to.be.revertedWithCustomError(vault, "BelowMinDeposit");
    });

    it("should accumulate multiple deposits", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });

      const position = await vault.getPosition(user1.address);
      expect(position.bnbBalance).to.equal(ethers.parseEther("3"));
    });

    it("should set default risk profile on first deposit", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      const riskProfile = await vault.getRiskProfile(user1.address);
      expect(riskProfile.maxSlippage).to.equal(100); // 1%
      expect(riskProfile.stopLossThreshold).to.equal(1000); // 10%
      expect(riskProfile.allowAutoWithdraw).to.be.true;
    });

    it("should track total deposited", async function () {
      const { vault, user1, user2 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
      await vault.connect(user2).deposit({ value: ethers.parseEther("2") });

      expect(await vault.totalBnbDeposited()).to.equal(ethers.parseEther("3"));
    });
  });

  describe("Withdrawals", function () {
    it("should withdraw partial BNB", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });

      await expect(
        vault.connect(user1).withdraw(ethers.parseEther("1"))
      ).to.emit(vault, "Withdrawn");

      const position = await vault.getPosition(user1.address);
      expect(position.bnbBalance).to.equal(ethers.parseEther("1"));
    });

    it("should withdraw all BNB when amount is 0", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user1).withdraw(0);

      const position = await vault.getPosition(user1.address);
      expect(position.bnbBalance).to.equal(0);
      expect(position.isActive).to.be.false;
    });

    it("should revert on insufficient balance", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      await expect(
        vault.connect(user1).withdraw(ethers.parseEther("2"))
      ).to.be.revertedWithCustomError(vault, "InsufficientBalance");
    });

    it("should emergency withdraw all assets", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("5") });
      await vault.connect(user1).authorizeAgent(0);

      await vault.connect(user1).emergencyWithdraw();

      const position = await vault.getPosition(user1.address);
      expect(position.bnbBalance).to.equal(0);
      expect(position.isActive).to.be.false;
      expect(position.agentAuthorized).to.be.false;
    });
  });

  describe("Agent Authorization", function () {
    it("should authorize an agent", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      await expect(
        vault.connect(user1).authorizeAgent(0)
      ).to.emit(vault, "AgentAuthorized");

      const position = await vault.getPosition(user1.address);
      expect(position.agentAuthorized).to.be.true;
      expect(position.authorizedAgentId).to.equal(0);
    });

    it("should revoke an agent", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
      await vault.connect(user1).authorizeAgent(0);

      await expect(
        vault.connect(user1).revokeAgent()
      ).to.emit(vault, "AgentRevoked");

      const position = await vault.getPosition(user1.address);
      expect(position.agentAuthorized).to.be.false;
    });
  });

  describe("Risk Profile", function () {
    it("should update risk profile", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      await vault.connect(user1).updateRiskProfile(
        200,   // 2% max slippage
        2000,  // 20% stop loss
        ethers.parseEther("0.5"),  // 0.5 BNB max action
        true,  // allow auto withdraw
        true   // allow auto swap
      );

      const riskProfile = await vault.getRiskProfile(user1.address);
      expect(riskProfile.maxSlippage).to.equal(200);
      expect(riskProfile.stopLossThreshold).to.equal(2000);
      expect(riskProfile.allowAutoSwap).to.be.true;
    });

    it("should reject excessive slippage", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      await expect(
        vault.connect(user1).updateRiskProfile(1500, 1000, ethers.parseEther("1"), true, false)
      ).to.be.revertedWith("Slippage too high");
    });
  });

  describe("Protection Execution", function () {
    it("should execute emergency withdrawal protection", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      // Setup: user deposits and authorizes agent
      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user1).authorizeAgent(0);

      const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("Rug pull detected on protocol XYZ"));
      const protectValue = ethers.parseEther("1");

      const balanceBefore = await ethers.provider.getBalance(user1.address);

      await expect(
        vault.connect(agentOperator).executeProtection(
          user1.address,
          0, // EmergencyWithdraw
          protectValue,
          reasonHash
        )
      ).to.emit(vault, "ProtectionExecuted");

      const balanceAfter = await ethers.provider.getBalance(user1.address);
      // Protocol fee (50 bps = 0.5%) deducted: user receives 0.995 BNB
      const expectedFee = protectValue * BigInt(PROTOCOL_FEE_BPS) / BigInt(10000);
      expect(balanceAfter - balanceBefore).to.equal(protectValue - expectedFee);

      // Check vault stats
      expect(await vault.totalActionsExecuted()).to.equal(1);
      expect(await vault.totalValueProtected()).to.equal(protectValue);
    });

    it("should reject unauthorized agent execution", async function () {
      const { vault, user1, user2 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
      await vault.connect(user1).authorizeAgent(0);

      await expect(
        vault.connect(user2).executeProtection(
          user1.address,
          0,
          ethers.parseEther("0.5"),
          ethers.ZeroHash
        )
      ).to.be.revertedWithCustomError(vault, "NotAuthorizedOperator");
    });

    it("should reject protection exceeding max action value", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      const depositAmount = ethers.parseEther("2");
      await vault.connect(user1).deposit({ value: depositAmount });
      await vault.connect(user1).authorizeAgent(0);

      // Default max action value is deposit / 2 = 1 BNB
      // Try to protect 1.5 BNB
      await expect(
        vault.connect(agentOperator).executeProtection(
          user1.address,
          0,
          ethers.parseEther("1.5"),
          ethers.ZeroHash
        )
      ).to.be.revertedWithCustomError(vault, "ExceedsMaxActionValue");
    });

    it("should track action history", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user1).authorizeAgent(0);

      const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("Market crash detected"));

      await vault.connect(agentOperator).executeProtection(
        user1.address,
        2, // AlertOnly
        0,
        reasonHash
      );

      const action = await vault.getAction(0);
      expect(action.agentId).to.equal(0);
      expect(action.user).to.equal(user1.address);
      expect(action.actionType).to.equal(2); // AlertOnly
      expect(action.reasonHash).to.equal(reasonHash);
      expect(action.successful).to.be.true;

      const userActionIds = await vault.getUserActions(user1.address);
      expect(userActionIds.length).to.equal(1);
    });
  });

  describe("Vault Stats", function () {
    it("should return accurate vault statistics", async function () {
      const { vault, user1, user2, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("3") });
      await vault.connect(user2).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user1).authorizeAgent(0);

      await vault.connect(agentOperator).executeProtection(
        user1.address, 0, ethers.parseEther("1"), ethers.ZeroHash
      );

      const stats = await vault.getVaultStats();
      expect(stats[0]).to.equal(ethers.parseEther("4")); // 3+2-1 = 4 BNB
      expect(stats[1]).to.equal(1); // 1 action
      expect(stats[2]).to.equal(ethers.parseEther("1")); // 1 BNB protected
    });
  });

  describe("Deposit Pausing", function () {
    it("should revert deposits when paused", async function () {
      const { vault, owner, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(owner).setDepositsPaused(true);

      await expect(
        vault.connect(user1).deposit({ value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(vault, "DepositsPaused");
    });

    it("should accept deposits after unpausing", async function () {
      const { vault, owner, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(owner).setDepositsPaused(true);
      await vault.connect(owner).setDepositsPaused(false);

      await expect(
        vault.connect(user1).deposit({ value: ethers.parseEther("1") })
      ).to.emit(vault, "Deposited");
    });
  });

  describe("Position Guard", function () {
    it("should revert withdraw without active position", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await expect(
        vault.connect(user1).withdraw(ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(vault, "NoActivePosition");
    });

    it("should revert authorizeAgent without active position", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await expect(
        vault.connect(user1).authorizeAgent(0)
      ).to.be.revertedWithCustomError(vault, "NoActivePosition");
    });

    it("should revert revokeAgent without active position", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await expect(
        vault.connect(user1).revokeAgent()
      ).to.be.revertedWithCustomError(vault, "NoActivePosition");
    });

    it("should revert updateRiskProfile without active position", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await expect(
        vault.connect(user1).updateRiskProfile(100, 1000, ethers.parseEther("1"), true, false)
      ).to.be.revertedWithCustomError(vault, "NoActivePosition");
    });
  });

  describe("Constructor Validation", function () {
    it("should revert on zero registry address", async function () {
      const Vault = await ethers.getContractFactory("AegisVault");
      await expect(
        Vault.deploy(ethers.ZeroAddress, 50, ethers.parseEther("0.001"), 1500)
      ).to.be.revertedWithCustomError(Vault, "InvalidRegistry");
    });
  });

  describe("Admin Functions", function () {
    it("should allow owner to set min deposit", async function () {
      const { vault, owner } = await loadFixture(deployFullFixture);

      const newMin = ethers.parseEther("0.01");
      await vault.connect(owner).setMinDeposit(newMin);
      expect(await vault.minDeposit()).to.equal(newMin);
    });

    it("should allow owner to update protocol fee", async function () {
      const { vault, owner } = await loadFixture(deployFullFixture);

      await vault.connect(owner).setProtocolFee(100);
      expect(await vault.protocolFeeBps()).to.equal(100);
    });

    it("should revert protocol fee above 5%", async function () {
      const { vault, owner } = await loadFixture(deployFullFixture);

      await expect(
        vault.connect(owner).setProtocolFee(600)
      ).to.be.revertedWithCustomError(vault, "FeeTooHigh");
    });

    it("should revert setOperatorAuthorization with zero address", async function () {
      const { vault, owner } = await loadFixture(deployFullFixture);

      await expect(
        vault.connect(owner).setOperatorAuthorization(ethers.ZeroAddress, true)
      ).to.be.revertedWithCustomError(vault, "InvalidOperator");
    });
  });

  describe("Protection Edge Cases", function () {
    it("should execute StopLoss protection action", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user1).authorizeAgent(0);

      const balanceBefore = await ethers.provider.getBalance(user1.address);

      await vault.connect(agentOperator).executeProtection(
        user1.address,
        3, // StopLoss
        ethers.parseEther("0.5"),
        ethers.ZeroHash
      );

      const balanceAfter = await ethers.provider.getBalance(user1.address);
      // Protocol fee deducted: 0.5 BNB - 0.5% = 0.4975 BNB
      const protectAmount = ethers.parseEther("0.5");
      const expectedFee = protectAmount * BigInt(PROTOCOL_FEE_BPS) / BigInt(10000);
      expect(balanceAfter - balanceBefore).to.equal(protectAmount - expectedFee);
    });

    it("should revert EmergencyWithdraw when auto withdraw disabled", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user1).updateRiskProfile(100, 1000, ethers.parseEther("1"), false, false);
      await vault.connect(user1).authorizeAgent(0);

      await expect(
        vault.connect(agentOperator).executeProtection(
          user1.address,
          0, // EmergencyWithdraw
          ethers.parseEther("0.5"),
          ethers.ZeroHash
        )
      ).to.be.revertedWithCustomError(vault, "AutoWithdrawNotAllowed");
    });

    it("should revert StopLoss when auto withdraw disabled", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user1).updateRiskProfile(100, 1000, ethers.parseEther("1"), false, false);
      await vault.connect(user1).authorizeAgent(0);

      await expect(
        vault.connect(agentOperator).executeProtection(
          user1.address,
          3, // StopLoss
          ethers.parseEther("0.5"),
          ethers.ZeroHash
        )
      ).to.be.revertedWithCustomError(vault, "AutoWithdrawNotAllowed");
    });

    it("should execute AlertOnly with zero value", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
      await vault.connect(user1).authorizeAgent(0);

      await expect(
        vault.connect(agentOperator).executeProtection(
          user1.address, 2, 0, ethers.ZeroHash
        )
      ).to.emit(vault, "ProtectionExecuted");

      // Balance unchanged
      const position = await vault.getPosition(user1.address);
      expect(position.bnbBalance).to.equal(ethers.parseEther("1"));
    });

    it("should revert protection when no agent authorized", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      await expect(
        vault.connect(agentOperator).executeProtection(
          user1.address, 0, ethers.parseEther("0.5"), ethers.ZeroHash
        )
      ).to.be.revertedWithCustomError(vault, "NoAgentAuthorized");
    });

    it("should track multiple sequential actions", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("5") });
      await vault.connect(user1).authorizeAgent(0);

      // Execute 3 actions
      await vault.connect(agentOperator).executeProtection(
        user1.address, 2, 0, ethers.ZeroHash // AlertOnly
      );
      await vault.connect(agentOperator).executeProtection(
        user1.address, 0, ethers.parseEther("0.5"), ethers.ZeroHash // EmergencyWithdraw
      );
      await vault.connect(agentOperator).executeProtection(
        user1.address, 2, 0, ethers.ZeroHash // AlertOnly
      );

      expect(await vault.totalActionsExecuted()).to.equal(3);
      const userActionIds = await vault.getUserActions(user1.address);
      expect(userActionIds.length).to.equal(3);
    });
  });

  describe("Action History", function () {
    it("should revert getAction with invalid ID", async function () {
      const { vault } = await loadFixture(deployFullFixture);

      await expect(
        vault.getAction(999)
      ).to.be.revertedWithCustomError(vault, "ActionDoesNotExist");
    });

    it("should return correct action count", async function () {
      const { vault } = await loadFixture(deployFullFixture);
      expect(await vault.getActionCount()).to.equal(0);
    });

    it("should track agent action IDs", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user1).authorizeAgent(0);

      await vault.connect(agentOperator).executeProtection(
        user1.address, 2, 0, ethers.ZeroHash
      );

      const agentActionIds = await vault.getAgentActions(0);
      expect(agentActionIds.length).to.equal(1);
      expect(agentActionIds[0]).to.equal(0);
    });
  });

  describe("Risk Profile Validation", function () {
    it("should revert stop loss above 50%", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      await expect(
        vault.connect(user1).updateRiskProfile(100, 6000, ethers.parseEther("1"), true, false)
      ).to.be.revertedWith("Stop loss too high");
    });
  });

  describe("Emergency Withdraw", function () {
    it("should work even with zero BNB balance", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      // No deposit, just call emergency withdraw — should not revert
      await vault.connect(user1).emergencyWithdraw();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Phase 2: TokenGate Integration Tests
  // ═══════════════════════════════════════════════════════════════

  describe("TokenGate Integration", function () {
    const BRONZE = ethers.parseEther("10000");
    const SILVER = ethers.parseEther("100000");
    const GOLD   = ethers.parseEther("1000000");
    const TOTAL  = ethers.parseEther("1000000000");

    async function deployWithTokenGateFixture() {
      const base = await deployFullFixture();
      const { vault, owner } = base;

      // Deploy mock $UNIQ
      const Token = await ethers.getContractFactory("MockERC20");
      const uniq = await Token.deploy("Uniq Minds", "UNIQ", TOTAL);

      // Deploy TokenGate
      const Gate = await ethers.getContractFactory("AegisTokenGate");
      const gate = await Gate.deploy(await uniq.getAddress());

      // Wire TokenGate into Vault
      await vault.setTokenGate(await gate.getAddress());

      return { ...base, uniq, gate };
    }

    it("should return base fee when no TokenGate set", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);
      expect(await vault.getEffectiveFee(user1.address)).to.equal(PROTOCOL_FEE_BPS);
    });

    it("should return base fee for non-holder with TokenGate set", async function () {
      const { vault, user1 } = await loadFixture(deployWithTokenGateFixture);
      expect(await vault.getEffectiveFee(user1.address)).to.equal(PROTOCOL_FEE_BPS);
    });

    it("should return discounted fee for bronze holder", async function () {
      const { vault, uniq, owner, user1 } = await loadFixture(deployWithTokenGateFixture);
      await uniq.transfer(user1.address, BRONZE);
      expect(await vault.getEffectiveFee(user1.address)).to.equal(40); // 50 - 10
    });

    it("should return discounted fee for silver holder", async function () {
      const { vault, uniq, owner, user1 } = await loadFixture(deployWithTokenGateFixture);
      await uniq.transfer(user1.address, SILVER);
      expect(await vault.getEffectiveFee(user1.address)).to.equal(25); // 50 - 25
    });

    it("should return discounted fee for gold holder", async function () {
      const { vault, uniq, owner, user1 } = await loadFixture(deployWithTokenGateFixture);
      await uniq.transfer(user1.address, GOLD);
      expect(await vault.getEffectiveFee(user1.address)).to.equal(10); // 50 - 40
    });

    it("should allow owner to set TokenGate", async function () {
      const { vault, owner, gate } = await loadFixture(deployWithTokenGateFixture);
      expect(await vault.tokenGate()).to.equal(await gate.getAddress());
    });

    it("should emit TokenGateUpdated event", async function () {
      const { vault, owner } = await loadFixture(deployFullFixture);

      const Gate = await ethers.getContractFactory("AegisTokenGate");
      const Token = await ethers.getContractFactory("MockERC20");
      const uniq = await Token.deploy("Uniq", "UNIQ", TOTAL);
      const gate = await Gate.deploy(await uniq.getAddress());

      await expect(
        vault.setTokenGate(await gate.getAddress())
      ).to.emit(vault, "TokenGateUpdated");
    });

    it("should allow disabling TokenGate (set to zero address)", async function () {
      const { vault, owner } = await loadFixture(deployWithTokenGateFixture);
      await vault.setTokenGate(ethers.ZeroAddress);
      expect(await vault.tokenGate()).to.equal(ethers.ZeroAddress);
    });

    it("should return base fee after TokenGate disabled", async function () {
      const { vault, uniq, owner, user1 } = await loadFixture(deployWithTokenGateFixture);
      await uniq.transfer(user1.address, GOLD);
      expect(await vault.getEffectiveFee(user1.address)).to.equal(10); // discounted

      await vault.setTokenGate(ethers.ZeroAddress);
      expect(await vault.getEffectiveFee(user1.address)).to.equal(PROTOCOL_FEE_BPS); // back to base
    });

    it("should update fee dynamically when user sells tokens", async function () {
      const { vault, uniq, owner, user1, user2 } = await loadFixture(deployWithTokenGateFixture);
      await uniq.transfer(user1.address, GOLD);
      expect(await vault.getEffectiveFee(user1.address)).to.equal(10); // Gold discount

      // User sells most tokens
      await uniq.connect(user1).transfer(user2.address, ethers.parseEther("990000"));
      expect(await vault.getEffectiveFee(user1.address)).to.equal(40); // Bronze discount (10K left)
    });

    // ─── Fee Deduction in executeProtection ──────────────────────

    it("should deduct protocol fee on EmergencyWithdraw", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployWithTokenGateFixture);
      const depositAmount = ethers.parseEther("10");
      await vault.connect(user1).deposit({ value: depositAmount });
      await vault.connect(user1).authorizeAgent(0);
      // Update risk profile to allow for larger single action
      await vault.connect(user1).updateRiskProfile(100, 1000, depositAmount, true, false);

      const protectAmount = ethers.parseEther("1");
      const balanceBefore = await ethers.provider.getBalance(user1.address);

      await vault.connect(agentOperator).executeProtection(
        user1.address, 0, protectAmount, ethers.ZeroHash
      );

      const balanceAfter = await ethers.provider.getBalance(user1.address);
      // Base fee = 50 bps = 0.5% of 1 BNB = 0.005 BNB (no holder discount)
      const expectedFee = protectAmount * BigInt(50) / BigInt(10000);
      const expectedReceived = protectAmount - expectedFee;
      expect(balanceAfter - balanceBefore).to.equal(expectedReceived);
    });

    it("should deduct discounted fee for Gold holder on EmergencyWithdraw", async function () {
      const { vault, uniq, user1, agentOperator } = await loadFixture(deployWithTokenGateFixture);
      await uniq.transfer(user1.address, GOLD);

      const depositAmount = ethers.parseEther("10");
      await vault.connect(user1).deposit({ value: depositAmount });
      await vault.connect(user1).authorizeAgent(0);
      await vault.connect(user1).updateRiskProfile(100, 1000, depositAmount, true, false);

      const protectAmount = ethers.parseEther("1");
      const balanceBefore = await ethers.provider.getBalance(user1.address);

      await vault.connect(agentOperator).executeProtection(
        user1.address, 0, protectAmount, ethers.ZeroHash
      );

      const balanceAfter = await ethers.provider.getBalance(user1.address);
      // Gold discount: effective fee = 50 - 40 = 10 bps = 0.1%
      const expectedFee = protectAmount * BigInt(10) / BigInt(10000);
      const expectedReceived = protectAmount - expectedFee;
      expect(balanceAfter - balanceBefore).to.equal(expectedReceived);
    });

    it("should deduct fee on StopLoss action", async function () {
      const { vault, uniq, user1, agentOperator } = await loadFixture(deployWithTokenGateFixture);
      await uniq.transfer(user1.address, SILVER);

      const depositAmount = ethers.parseEther("10");
      await vault.connect(user1).deposit({ value: depositAmount });
      await vault.connect(user1).authorizeAgent(0);
      await vault.connect(user1).updateRiskProfile(100, 1000, depositAmount, true, false);

      const protectAmount = ethers.parseEther("2");
      const balanceBefore = await ethers.provider.getBalance(user1.address);

      await vault.connect(agentOperator).executeProtection(
        user1.address, 3, protectAmount, ethers.ZeroHash // StopLoss = 3
      );

      const balanceAfter = await ethers.provider.getBalance(user1.address);
      // Silver discount: effective fee = 50 - 25 = 25 bps
      const expectedFee = protectAmount * BigInt(25) / BigInt(10000);
      const expectedReceived = protectAmount - expectedFee;
      expect(balanceAfter - balanceBefore).to.equal(expectedReceived);
    });

    it("should emit ProtocolFeeDeducted event", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployWithTokenGateFixture);
      const depositAmount = ethers.parseEther("10");
      await vault.connect(user1).deposit({ value: depositAmount });
      await vault.connect(user1).authorizeAgent(0);
      await vault.connect(user1).updateRiskProfile(100, 1000, depositAmount, true, false);

      const protectAmount = ethers.parseEther("1");
      const expectedFee = protectAmount * BigInt(50) / BigInt(10000);

      await expect(
        vault.connect(agentOperator).executeProtection(
          user1.address, 0, protectAmount, ethers.ZeroHash
        )
      ).to.emit(vault, "ProtocolFeeDeducted").withArgs(user1.address, expectedFee, 50);
    });

    it("should accumulate fees and allow owner withdrawal", async function () {
      const { vault, owner, user1, agentOperator } = await loadFixture(deployWithTokenGateFixture);
      const depositAmount = ethers.parseEther("10");
      await vault.connect(user1).deposit({ value: depositAmount });
      await vault.connect(user1).authorizeAgent(0);
      await vault.connect(user1).updateRiskProfile(100, 1000, depositAmount, true, false);

      // Execute protection to accumulate fee
      const protectAmount = ethers.parseEther("2");
      await vault.connect(agentOperator).executeProtection(
        user1.address, 0, protectAmount, ethers.ZeroHash
      );

      const expectedFee = protectAmount * BigInt(50) / BigInt(10000);
      expect(await vault.accumulatedFees()).to.equal(expectedFee);

      // Owner withdraws fees
      const ownerBalBefore = await ethers.provider.getBalance(owner.address);
      const tx = await vault.withdrawAccumulatedFees();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const ownerBalAfter = await ethers.provider.getBalance(owner.address);

      expect(ownerBalAfter - ownerBalBefore + gasUsed).to.equal(expectedFee);
      expect(await vault.accumulatedFees()).to.equal(0);
    });

    it("should revert withdrawAccumulatedFees when nothing to withdraw", async function () {
      const { vault } = await loadFixture(deployWithTokenGateFixture);
      await expect(vault.withdrawAccumulatedFees()).to.be.revertedWithCustomError(vault, "ZeroAmount");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Phase 3: Yield Distribution Tests
  // ═══════════════════════════════════════════════════════════════

  describe("Yield Distribution", function () {
    it("should distribute yield to a single user", async function () {
      const { vault, user1, owner } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      const yieldAmount = ethers.parseEther("0.01"); // 0.01 BNB yield
      await expect(
        vault.connect(owner).distributeYield([user1.address], [yieldAmount], { value: yieldAmount })
      ).to.emit(vault, "YieldDistributed");

      // Check position grew (minus 15% performance fee)
      const position = await vault.getPosition(user1.address);
      const expectedNet = yieldAmount - (yieldAmount * BigInt(PERFORMANCE_FEE_BPS) / BigInt(10000));
      expect(position.bnbBalance).to.equal(ethers.parseEther("1") + expectedNet);
    });

    it("should deduct correct performance fee", async function () {
      const { vault, user1, owner } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      const yieldAmount = ethers.parseEther("0.1");
      await vault.connect(owner).distributeYield([user1.address], [yieldAmount], { value: yieldAmount });

      const expectedFee = yieldAmount * BigInt(PERFORMANCE_FEE_BPS) / BigInt(10000);
      expect(await vault.accumulatedPerformanceFees()).to.equal(expectedFee);
    });

    it("should track total yield distributed", async function () {
      const { vault, user1, owner } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      const y1 = ethers.parseEther("0.05");
      const y2 = ethers.parseEther("0.03");
      await vault.connect(owner).distributeYield([user1.address], [y1], { value: y1 });
      await vault.connect(owner).distributeYield([user1.address], [y2], { value: y2 });

      expect(await vault.totalYieldDistributed()).to.equal(y1 + y2);
      expect(await vault.yieldEarned(user1.address)).to.equal(y1 + y2);
    });

    it("should distribute yield to multiple users", async function () {
      const { vault, user1, user2, owner } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user2).deposit({ value: ethers.parseEther("1") });

      const y1 = ethers.parseEther("0.02");
      const y2 = ethers.parseEther("0.01");
      const total = y1 + y2;

      await vault.connect(owner).distributeYield(
        [user1.address, user2.address],
        [y1, y2],
        { value: total }
      );

      const net1 = y1 - (y1 * BigInt(PERFORMANCE_FEE_BPS) / BigInt(10000));
      const net2 = y2 - (y2 * BigInt(PERFORMANCE_FEE_BPS) / BigInt(10000));

      const pos1 = await vault.getPosition(user1.address);
      const pos2 = await vault.getPosition(user2.address);
      expect(pos1.bnbBalance).to.equal(ethers.parseEther("2") + net1);
      expect(pos2.bnbBalance).to.equal(ethers.parseEther("1") + net2);
    });

    it("should revert if msg.value mismatches total amounts", async function () {
      const { vault, user1, owner } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      await expect(
        vault.connect(owner).distributeYield(
          [user1.address], [ethers.parseEther("0.01")],
          { value: ethers.parseEther("0.005") }
        )
      ).to.be.revertedWithCustomError(vault, "YieldValueMismatch");
    });

    it("should revert if arrays have different lengths", async function () {
      const { vault, owner } = await loadFixture(deployFullFixture);

      await expect(
        vault.connect(owner).distributeYield(
          [owner.address], [ethers.parseEther("0.01"), ethers.parseEther("0.02")],
          { value: ethers.parseEther("0.03") }
        )
      ).to.be.revertedWithCustomError(vault, "YieldArrayMismatch");
    });

    it("should revert if caller is not owner or operator", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      await expect(
        vault.connect(user1).distributeYield(
          [user1.address], [ethers.parseEther("0.01")],
          { value: ethers.parseEther("0.01") }
        )
      ).to.be.revertedWithCustomError(vault, "NotAuthorizedOperator");
    });

    it("should skip inactive users without reverting", async function () {
      const { vault, user1, user2, owner } = await loadFixture(deployFullFixture);

      // Only user1 has deposited
      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      const y1 = ethers.parseEther("0.01");
      const y2 = ethers.parseEther("0.005");

      // user2 has no active position — should be skipped
      await vault.connect(owner).distributeYield(
        [user1.address, user2.address], [y1, y2],
        { value: y1 + y2 }
      );

      // user1 gets yield, user2 has no position
      const pos1 = await vault.getPosition(user1.address);
      const net1 = y1 - (y1 * BigInt(PERFORMANCE_FEE_BPS) / BigInt(10000));
      expect(pos1.bnbBalance).to.equal(ethers.parseEther("1") + net1);

      const pos2 = await vault.getPosition(user2.address);
      expect(pos2.bnbBalance).to.equal(0);
    });

    it("should allow authorized operator to distribute yield", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      const yieldAmount = ethers.parseEther("0.01");
      await vault.connect(agentOperator).distributeYield(
        [user1.address], [yieldAmount],
        { value: yieldAmount }
      );

      expect(await vault.yieldEarned(user1.address)).to.equal(yieldAmount);
    });

    it("should return correct yield info via getYieldInfo", async function () {
      const { vault, user1, owner } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      const yieldAmount = ethers.parseEther("0.1");
      await vault.connect(owner).distributeYield([user1.address], [yieldAmount], { value: yieldAmount });

      const info = await vault.getYieldInfo(user1.address);
      expect(info.grossYieldEarned).to.equal(yieldAmount);
      expect(info.effectivePerformanceFeeBps).to.equal(PERFORMANCE_FEE_BPS);

      const expectedNet = yieldAmount - (yieldAmount * BigInt(PERFORMANCE_FEE_BPS) / BigInt(10000));
      expect(info.netYieldEarned).to.equal(expectedNet);
    });

    it("should return yield stats via getYieldStats", async function () {
      const { vault, user1, owner } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      const yieldAmount = ethers.parseEther("0.05");
      await vault.connect(owner).distributeYield([user1.address], [yieldAmount], { value: yieldAmount });

      const stats = await vault.getYieldStats();
      expect(stats[0]).to.equal(yieldAmount); // totalYieldDistributed
      expect(stats[1]).to.equal(PERFORMANCE_FEE_BPS); // performanceFeeBps
      const expectedFee = yieldAmount * BigInt(PERFORMANCE_FEE_BPS) / BigInt(10000);
      expect(stats[2]).to.equal(expectedFee); // accumulatedPerformanceFees
    });

    it("should allow owner to update performance fee", async function () {
      const { vault, owner } = await loadFixture(deployFullFixture);

      await expect(vault.connect(owner).setPerformanceFeeBps(2000))
        .to.emit(vault, "PerformanceFeeUpdated")
        .withArgs(PERFORMANCE_FEE_BPS, 2000);

      expect(await vault.performanceFeeBps()).to.equal(2000);
    });

    it("should revert performance fee above 30%", async function () {
      const { vault, owner } = await loadFixture(deployFullFixture);

      await expect(
        vault.connect(owner).setPerformanceFeeBps(3100)
      ).to.be.revertedWithCustomError(vault, "PerformanceFeeTooHigh");
    });

    it("should allow owner to withdraw performance fees", async function () {
      const { vault, user1, owner } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      const yieldAmount = ethers.parseEther("1");
      await vault.connect(owner).distributeYield([user1.address], [yieldAmount], { value: yieldAmount });

      const expectedFee = yieldAmount * BigInt(PERFORMANCE_FEE_BPS) / BigInt(10000);

      const balBefore = await ethers.provider.getBalance(owner.address);
      const tx = await vault.connect(owner).withdrawPerformanceFees();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(owner.address);

      expect(balAfter - balBefore + gasUsed).to.equal(expectedFee);
      expect(await vault.accumulatedPerformanceFees()).to.equal(0);
    });

    it("should revert withdrawPerformanceFees when nothing to withdraw", async function () {
      const { vault } = await loadFixture(deployFullFixture);
      await expect(vault.withdrawPerformanceFees()).to.be.revertedWithCustomError(vault, "ZeroAmount");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //              VENUS PROTOCOL INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  describe("Venus Protocol Integration", function () {
    async function deployVenusFixture() {
      const base = await loadFixture(deployFullFixture);
      const { vault, owner, user1, user2, agentOperator } = base;

      // Deploy MockVenusBNB
      const MockVenus = await ethers.getContractFactory("MockVenusBNB");
      const venus = await MockVenus.deploy();
      const venusAddress = await venus.getAddress();

      // Fund MockVenus with extra BNB for yield payouts
      await owner.sendTransaction({ to: venusAddress, value: ethers.parseEther("10") });

      // Deploy Mock USDT for stop-loss
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const usdt = await MockERC20.deploy("Mock USDT", "USDT", ethers.parseEther("1000000"));
      const usdtAddress = await usdt.getAddress();

      // Configure Venus on vault
      const dummyRouter = "0x0000000000000000000000000000000000000001"; // Placeholder
      await vault.connect(owner).setVenusConfig(venusAddress, dummyRouter, usdtAddress);
      await vault.connect(owner).setVenusAllocationBps(8000); // 80%
      await vault.connect(owner).setVenusEnabled(true);

      return { ...base, venus, usdt, venusAddress, usdtAddress };
    }

    describe("Configuration", function () {
      it("should set Venus config correctly", async function () {
        const { vault, venusAddress } = await loadFixture(deployVenusFixture);
        expect(await vault.venusEnabled()).to.be.true;
        expect(await vault.venusAllocationBps()).to.equal(8000);
        expect(await vault.venusVBNB()).to.equal(venusAddress);
      });

      it("should reject allocation above 95%", async function () {
        const { vault, owner } = await loadFixture(deployVenusFixture);
        await expect(vault.connect(owner).setVenusAllocationBps(9600)).to.be.reverted;
      });

      it("should allow toggling Venus enabled", async function () {
        const { vault, owner } = await loadFixture(deployVenusFixture);
        await vault.connect(owner).setVenusEnabled(false);
        expect(await vault.venusEnabled()).to.be.false;
      });

      it("should only allow owner to set config", async function () {
        const { vault, user1 } = await loadFixture(deployVenusFixture);
        await expect(vault.connect(user1).setVenusEnabled(false)).to.be.reverted;
      });
    });

    describe("Auto-deploy on deposit", function () {
      it("should auto-supply 80% to Venus on deposit", async function () {
        const { vault, user1, venus } = await loadFixture(deployVenusFixture);

        const depositAmount = ethers.parseEther("1");
        await vault.connect(user1).deposit({ value: depositAmount });

        // 80% of 1 BNB = 0.8 BNB deployed to Venus
        const deployed = await vault.venusDeployedAmount();
        expect(deployed).to.equal(ethers.parseEther("0.8"));

        // Vault should hold 0.2 BNB (20% liquid)
        // Venus should have received 0.8 BNB
        const vTokenBal = await venus.vTokenBalances(await vault.getAddress());
        expect(vTokenBal).to.be.gt(0);
      });

      it("should not deploy to Venus when disabled", async function () {
        const { vault, owner, user1 } = await loadFixture(deployVenusFixture);
        await vault.connect(owner).setVenusEnabled(false);

        await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
        expect(await vault.venusDeployedAmount()).to.equal(0);
      });

      it("should track user balance correctly with Venus", async function () {
        const { vault, user1 } = await loadFixture(deployVenusFixture);

        const depositAmount = ethers.parseEther("1");
        await vault.connect(user1).deposit({ value: depositAmount });

        // User's full deposit is tracked in their position
        const pos = await vault.getPosition(user1.address);
        expect(pos.bnbBalance).to.equal(depositAmount);
      });
    });

    describe("Auto-redeem on withdraw", function () {
      it("should redeem from Venus when vault balance insufficient", async function () {
        const { vault, user1 } = await loadFixture(deployVenusFixture);

        await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
        // Vault has 0.2 BNB liquid, 0.8 in Venus

        // Withdraw full amount — should trigger Venus redeem
        const balBefore = await ethers.provider.getBalance(user1.address);
        const tx = await vault.connect(user1).withdraw(ethers.parseEther("1"));
        const receipt = await tx.wait();
        const gas = receipt!.gasUsed * receipt!.gasPrice;
        const balAfter = await ethers.provider.getBalance(user1.address);

        expect(balAfter - balBefore + gas).to.be.closeTo(
          ethers.parseEther("1"),
          ethers.parseEther("0.001") // small rounding tolerance
        );
      });

      it("should not touch Venus if vault has enough BNB", async function () {
        const { vault, owner, user1 } = await loadFixture(deployVenusFixture);

        await vault.connect(owner).setVenusAllocationBps(0); // 0% to Venus
        await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

        const deployedBefore = await vault.venusDeployedAmount();
        await vault.connect(user1).withdraw(ethers.parseEther("0.5"));
        const deployedAfter = await vault.venusDeployedAmount();

        expect(deployedAfter).to.equal(deployedBefore); // No Venus activity
      });
    });

    describe("Manual supply/redeem", function () {
      it("should allow operator to supply to Venus manually", async function () {
        const { vault, user1, agentOperator } = await loadFixture(deployVenusFixture);

        // Deposit with Venus disabled to keep BNB in vault
        await vault.setVenusEnabled(false);
        await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
        await vault.setVenusEnabled(true);

        await expect(vault.connect(agentOperator).supplyToVenus(ethers.parseEther("0.5")))
          .to.emit(vault, "VenusSupplied");

        expect(await vault.venusDeployedAmount()).to.equal(ethers.parseEther("0.5"));
      });

      it("should allow operator to redeem from Venus manually", async function () {
        const { vault, user1, agentOperator } = await loadFixture(deployVenusFixture);

        await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
        // 0.8 BNB in Venus

        await expect(vault.connect(agentOperator).redeemFromVenus(ethers.parseEther("0.3")))
          .to.emit(vault, "VenusRedeemed");

        expect(await vault.venusDeployedAmount()).to.equal(ethers.parseEther("0.5"));
      });

      it("should revert supply when Venus disabled", async function () {
        const { vault, owner, agentOperator, user1 } = await loadFixture(deployVenusFixture);
        await vault.connect(owner).setVenusEnabled(false);
        await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

        await expect(
          vault.connect(agentOperator).supplyToVenus(ethers.parseEther("0.5"))
        ).to.be.revertedWithCustomError(vault, "VenusNotEnabled");
      });

      it("should revert for non-operator", async function () {
        const { vault, user1 } = await loadFixture(deployVenusFixture);
        await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

        await expect(
          vault.connect(user1).supplyToVenus(ethers.parseEther("0.1"))
        ).to.be.revertedWithCustomError(vault, "NotAuthorizedOperator");
      });
    });

    describe("Harvest yield", function () {
      it("should harvest Venus yield and distribute to users", async function () {
        const { vault, user1, owner } = await loadFixture(deployVenusFixture);

        await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
        const deployedBefore = await vault.venusDeployedAmount();
        expect(deployedBefore).to.equal(ethers.parseEther("0.8"));

        // Fast forward time to accrue yield (MockVenusBNB exchange rate grows)
        await ethers.provider.send("evm_increaseTime", [365 * 24 * 3600]); // 1 year
        await ethers.provider.send("evm_mine", []);

        // Harvest yield — user gets 100% share
        await expect(
          vault.connect(owner).harvestVenusYield([user1.address], [10000])
        ).to.emit(vault, "VenusYieldHarvested");

        // User's balance should have increased
        const pos = await vault.getPosition(user1.address);
        expect(pos.bnbBalance).to.be.gt(ethers.parseEther("1"));
      });

      it("should revert harvest when no yield accrued beyond rounding", async function () {
        const { vault, owner } = await loadFixture(deployVenusFixture);

        // No deposits = no Venus position = should revert
        await expect(
          vault.connect(owner).harvestVenusYield([owner.address], [10000])
        ).to.be.revertedWithCustomError(vault, "NoYieldToClaim");
      });

      it("should revert harvest with invalid shares", async function () {
        const { vault, user1, owner } = await loadFixture(deployVenusFixture);

        await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
        await ethers.provider.send("evm_increaseTime", [365 * 24 * 3600]);
        await ethers.provider.send("evm_mine", []);

        await expect(
          vault.connect(owner).harvestVenusYield([user1.address], [5000]) // doesn't sum to 10000
        ).to.be.reverted;
      });
    });

    describe("Venus view functions", function () {
      it("should return correct Venus info", async function () {
        const { vault, user1 } = await loadFixture(deployVenusFixture);

        await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

        const info = await vault.getVenusInfo();
        expect(info.deployed).to.equal(ethers.parseEther("0.8"));
        expect(info.enabled).to.be.true;
        expect(info.allocationBps).to.equal(8000);
        expect(info.currentValue).to.be.closeTo(info.deployed, ethers.parseEther("0.001"));
      });

      it("should return zero when Venus not configured", async function () {
        const { vault } = await loadFixture(deployFullFixture);
        const info = await vault.getVenusInfo();
        expect(info.deployed).to.equal(0);
        expect(info.enabled).to.be.false;
      });
    });

    describe("Emergency withdraw with Venus", function () {
      it("should redeem from Venus on emergency withdraw", async function () {
        const { vault, user1 } = await loadFixture(deployVenusFixture);

        await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

        const balBefore = await ethers.provider.getBalance(user1.address);
        const tx = await vault.connect(user1).emergencyWithdraw();
        const receipt = await tx.wait();
        const gas = receipt!.gasUsed * receipt!.gasPrice;
        const balAfter = await ethers.provider.getBalance(user1.address);

        // User should get back approximately their deposit
        expect(balAfter - balBefore + gas).to.be.closeTo(
          ethers.parseEther("1"),
          ethers.parseEther("0.001")
        );

        // Position should be deactivated
        const pos = await vault.getPosition(user1.address);
        expect(pos.isActive).to.be.false;
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //                   STOP-LOSS SWAP
  // ═══════════════════════════════════════════════════════════════

  describe("Stop-Loss Swap", function () {
    it("should track stablecoin balances", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      // Stablecoin balance starts at 0
      expect(await vault.getStablecoinBalance(user1.address)).to.equal(0);
    });

    it("should revert stop-loss when autoSwap not allowed", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
      await vault.connect(user1).authorizeAgent(0);

      // Default allowAutoSwap is false
      await expect(
        vault.connect(agentOperator).executeStopLoss(user1.address, ethers.parseEther("0.5"), 0)
      ).to.be.revertedWithCustomError(vault, "AutoSwapNotAllowed");
    });

    it("should revert stop-loss when router not configured", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
      await vault.connect(user1).authorizeAgent(0);
      await vault.connect(user1).updateRiskProfile(100, 1000, ethers.parseEther("1"), true, true);

      await expect(
        vault.connect(agentOperator).executeStopLoss(user1.address, ethers.parseEther("0.5"), 0)
      ).to.be.revertedWithCustomError(vault, "VenusNotEnabled");
    });

    it("should allow user to withdraw stablecoin after stop-loss", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      // No stablecoin to withdraw
      await expect(
        vault.connect(user1).withdrawStablecoin(ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(vault, "InvalidToken");
    });
  });
});
