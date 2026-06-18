// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DecisionLogger
 * @author Aegis Protocol  
 * @notice On-chain log of every AI agent decision for full transparency.
 *         Every risk assessment, protection trigger, and action outcome
 *         is permanently recorded and publicly verifiable.
 * @dev This contract serves as an immutable audit trail for AI agent
 *      behavior, enabling trustless verification of agent performance.
 */
contract DecisionLogger is Ownable {
    // ═══════════════════════════════════════════════════════════════
    //                        STRUCTS
    // ═══════════════════════════════════════════════════════════════

    /// @notice Detailed decision entry
    struct Decision {
        uint256 agentId;           // Agent that made the decision
        address targetUser;        // User the decision concerns
        DecisionType decisionType; // Type of decision
        RiskLevel riskLevel;       // Assessed risk level
        uint256 confidence;        // AI confidence score (0-10000 = 0-100.00%)
        bytes32 analysisHash;      // IPFS hash of full AI analysis
        bytes32 dataHash;          // Hash of input data used for decision
        uint256 timestamp;         // When decision was made
        bool actionTaken;          // Whether an on-chain action followed
        uint256 actionId;          // Action ID in AegisVault (if action taken)
    }

    /// @notice Types of AI decisions
    enum DecisionType {
        RiskAssessment,       // Periodic risk evaluation
        ThreatDetected,       // Active threat identified
        ProtectionTriggered,  // Protection action initiated
        AllClear,             // Position is safe
        MarketAnalysis,       // Market condition update
        PositionReview        // Comprehensive position review
    }

    /// @notice Risk severity levels
    enum RiskLevel {
        None,       // No risk detected
        Low,        // Minor concerns, monitoring
        Medium,     // Notable risk, increased monitoring
        High,       // Significant risk, protection recommended
        Critical    // Imminent threat, immediate action required
    }

    /// @notice Aggregated risk metrics for a user
    struct RiskSnapshot {
        uint256 timestamp;
        RiskLevel overallRisk;
        uint256 liquidationRisk;     // 0-10000 basis points
        uint256 volatilityScore;     // 0-10000 basis points
        uint256 protocolRisk;        // 0-10000 basis points
        uint256 smartContractRisk;   // 0-10000 basis points
        bytes32 detailsHash;         // IPFS hash of detailed analysis
    }

    // ═══════════════════════════════════════════════════════════════
    //                        STATE
    // ═══════════════════════════════════════════════════════════════

    /// @notice All decisions in chronological order
    Decision[] public decisions;

    /// @notice Decisions by agent
    mapping(uint256 => uint256[]) public agentDecisions;

    /// @notice Decisions concerning a user
    mapping(address => uint256[]) public userDecisions;

    /// @notice Latest risk snapshot per user
    mapping(address => RiskSnapshot) public latestRiskSnapshot;

    /// @notice Risk snapshot history per user
    mapping(address => RiskSnapshot[]) public riskHistory;

    /// @notice Authorized loggers (agent operators and vault contracts)
    mapping(address => bool) public authorizedLoggers;

    /// @notice Total threat detections across all agents
    uint256 public totalThreatsDetected;

    /// @notice Total protections triggered
    uint256 public totalProtectionsTriggered;

    // ═══════════════════════════════════════════════════════════════
    //                        EVENTS
    // ═══════════════════════════════════════════════════════════════

    event DecisionLogged(
        uint256 indexed decisionId,
        uint256 indexed agentId,
        address indexed targetUser,
        DecisionType decisionType,
        RiskLevel riskLevel,
        uint256 confidence,
        uint256 timestamp
    );

    event ThreatDetected(
        uint256 indexed decisionId,
        uint256 indexed agentId,
        address indexed targetUser,
        RiskLevel severity,
        bytes32 analysisHash
    );

    event RiskSnapshotUpdated(
        address indexed user,
        RiskLevel overallRisk,
        uint256 timestamp
    );

    event LoggerAuthorized(address indexed logger, bool authorized);

    // ═══════════════════════════════════════════════════════════════
    //                      MODIFIERS
    // ═══════════════════════════════════════════════════════════════

    modifier onlyAuthorizedLogger() {
        require(authorizedLoggers[msg.sender], "Not authorized logger");
        _;
    }

    // ═══════════════════════════════════════════════════════════════
    //                    CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════

    constructor() Ownable(msg.sender) {}

    // ═══════════════════════════════════════════════════════════════
    //                   CORE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Log an AI agent decision
     * @param agentId Agent that made the decision
     * @param targetUser User the decision concerns
     * @param decisionType Type of decision
     * @param riskLevel Assessed risk level
     * @param confidence AI confidence score (0-10000)
     * @param analysisHash IPFS hash of full analysis
     * @param dataHash Hash of input data
     * @param actionTaken Whether an action followed
     * @param actionId Action ID if action was taken
     * @return decisionId The logged decision ID
     */
    function logDecision(
        uint256 agentId,
        address targetUser,
        DecisionType decisionType,
        RiskLevel riskLevel,
        uint256 confidence,
        bytes32 analysisHash,
        bytes32 dataHash,
        bool actionTaken,
        uint256 actionId
    ) external onlyAuthorizedLogger returns (uint256 decisionId) {
        require(confidence <= 10000, "Confidence out of range");

        decisionId = decisions.length;

        decisions.push(Decision({
            agentId: agentId,
            targetUser: targetUser,
            decisionType: decisionType,
            riskLevel: riskLevel,
            confidence: confidence,
            analysisHash: analysisHash,
            dataHash: dataHash,
            timestamp: block.timestamp,
            actionTaken: actionTaken,
            actionId: actionId
        }));

        agentDecisions[agentId].push(decisionId);
        userDecisions[targetUser].push(decisionId);

        // Track threat and protection counts
        if (decisionType == DecisionType.ThreatDetected) {
            totalThreatsDetected++;
            emit ThreatDetected(decisionId, agentId, targetUser, riskLevel, analysisHash);
        }
        if (decisionType == DecisionType.ProtectionTriggered) {
            totalProtectionsTriggered++;
        }

        emit DecisionLogged(
            decisionId,
            agentId,
            targetUser,
            decisionType,
            riskLevel,
            confidence,
            block.timestamp
        );
    }

    /**
     * @notice Update risk snapshot for a user
     * @param user User address
     * @param overallRisk Overall risk level
     * @param liquidationRisk Liquidation risk score
     * @param volatilityScore Volatility score
     * @param protocolRisk Protocol risk score
     * @param smartContractRisk Smart contract risk score
     * @param detailsHash IPFS hash of detailed analysis
     */
    function updateRiskSnapshot(
        address user,
        RiskLevel overallRisk,
        uint256 liquidationRisk,
        uint256 volatilityScore,
        uint256 protocolRisk,
        uint256 smartContractRisk,
        bytes32 detailsHash
    ) external onlyAuthorizedLogger {
        require(liquidationRisk <= 10000, "Invalid liquidation risk");
        require(volatilityScore <= 10000, "Invalid volatility score");
        require(protocolRisk <= 10000, "Invalid protocol risk");
        require(smartContractRisk <= 10000, "Invalid smart contract risk");

        RiskSnapshot memory snapshot = RiskSnapshot({
            timestamp: block.timestamp,
            overallRisk: overallRisk,
            liquidationRisk: liquidationRisk,
            volatilityScore: volatilityScore,
            protocolRisk: protocolRisk,
            smartContractRisk: smartContractRisk,
            detailsHash: detailsHash
        });

        latestRiskSnapshot[user] = snapshot;
        riskHistory[user].push(snapshot);

        emit RiskSnapshotUpdated(user, overallRisk, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════
    //                   VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Get total number of decisions logged
     */
    function getDecisionCount() external view returns (uint256) {
        return decisions.length;
    }

    /**
     * @notice Get a specific decision
     */
    function getDecision(uint256 decisionId) external view returns (Decision memory) {
        require(decisionId < decisions.length, "Decision does not exist");
        return decisions[decisionId];
    }

    /**
     * @notice Get all decision IDs for an agent
     */
    function getAgentDecisions(uint256 agentId) external view returns (uint256[] memory) {
        return agentDecisions[agentId];
    }

    /**
     * @notice Get all decision IDs concerning a user
     */
    function getUserDecisions(address user) external view returns (uint256[] memory) {
        return userDecisions[user];
    }

    /**
     * @notice Get latest risk snapshot for a user
     */
    function getLatestRisk(address user) external view returns (RiskSnapshot memory) {
        return latestRiskSnapshot[user];
    }

    /**
     * @notice Get risk history for a user
     */
    function getRiskHistory(address user) external view returns (RiskSnapshot[] memory) {
        return riskHistory[user];
    }

    /**
     * @notice Get risk history count for a user
     */
    function getRiskHistoryCount(address user) external view returns (uint256) {
        return riskHistory[user].length;
    }

    /**
     * @notice Get aggregate statistics
     */
    function getStats() external view returns (
        uint256 _totalDecisions,
        uint256 _totalThreats,
        uint256 _totalProtections
    ) {
        return (decisions.length, totalThreatsDetected, totalProtectionsTriggered);
    }

    /**
     * @notice Get recent decisions (last N)
     * @param count Number of recent decisions to return
     */
    function getRecentDecisions(uint256 count) external view returns (Decision[] memory) {
        uint256 total = decisions.length;
        uint256 resultCount = count > total ? total : count;
        Decision[] memory result = new Decision[](resultCount);

        for (uint256 i = 0; i < resultCount; i++) {
            result[i] = decisions[total - resultCount + i];
        }
        return result;
    }

    // ═══════════════════════════════════════════════════════════════
    //                   ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Authorize or revoke a logger
     */
    function setLoggerAuthorization(address logger, bool authorized) external onlyOwner {
        require(logger != address(0), "Invalid logger");
        authorizedLoggers[logger] = authorized;
        emit LoggerAuthorized(logger, authorized);
    }
}
