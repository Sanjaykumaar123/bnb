"use client";

import { useState, useCallback, useEffect } from "react";
import { useWalletContext } from "../../lib/WalletContext";
import { CONTRACTS } from "../../lib/constants";
import { VAULT_ABI } from "../../lib/abis";
import { ethers } from "ethers";
import {
  Shield, Wallet, TrendingUp, Lock, RefreshCw,
  AlertTriangle, CheckCircle, Loader2, Activity, Eye,
  ChevronDown, ChevronUp, ArrowDown, ArrowUp,
  Bot, Layers, DollarSign, ShieldCheck,
  ShieldAlert, BarChart3, History, Settings,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Types ───────────────────────────────────────────────────

interface VaultData {
  global: {
    totalBnbDeposited: string;
    totalActionsExecuted: number;
    totalValueProtected: string;
    agentCount: number;
    protocolFeeBps: number;
    performanceFeeBps: number;
    minDepositBnb: string;
    depositsPaused: boolean;
    totalYieldDistributed: string;
    totalDecisions: number;
    totalThreats: number;
    totalProtections: number;
    venus: {
      deployed: string;
      currentValue: string;
      pendingYield: string;
      allocationPct: number;
      enabled: boolean;
    };
  };
  position: {
    bnbBalance: string;
    depositTimestamp: number;
    lastActionTimestamp: number;
    isActive: boolean;
    authorizedAgentId: number;
    agentAuthorized: boolean;
    agentName?: string;
    agentTier?: string;
    agentSuccessRate?: string;
    stablecoinBalance?: string;
    riskProfile: {
      maxSlippage: number;
      stopLossThreshold: number;
      maxSingleActionValue: string;
      allowAutoWithdraw: boolean;
      allowAutoSwap: boolean;
    };
  } | null;
  yield: {
    grossYieldEarned: string;
    netYieldEarned: string;
    pendingInPosition: string;
    performanceFeeBps: number;
    performanceFeePct: string;
    daysSinceDeposit: number;
    strategy: string;
  } | null;
  actions: {
    id: number;
    agentId: number;
    actionType: string;
    value: string;
    timestamp: number;
    successful: boolean;
  }[];
  risk: {
    timestamp: number;
    overallRisk: string;
    liquidationRisk: number;
    volatilityScore: number;
    protocolRisk: number;
    smartContractRisk: number;
  } | null;
  tier: {
    tier: number;
    tierName: string;
    feeDiscountBps: number;
    effectiveFeeBps: number;
  } | null;
  decisions: {
    id: number;
    agentId: number;
    decisionType: string;
    riskLevel: string;
    confidence: string;
    timestamp: number;
    actionTaken: boolean;
  }[];
}

// ─── Helpers ─────────────────────────────────────────────────

function tierColor(tier: number) {
  return ["#6b7280", "#cd7f32", "#c0c0c0", "#ffd700"][tier] || "#6b7280";
}

function riskColor(risk: string) {
  const map: Record<string, string> = {
    None: "#22c55e", Low: "#22c55e", Medium: "#eab308",
    High: "#f97316", Critical: "#ef4444",
  };
  return map[risk] || "#6b7280";
}

function timeAgo(ts: number) {
  if (!ts) return "Never";
  const sec = Math.floor(Date.now() / 1000 - ts);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function formatBnb(v: string | number) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n) || n === 0) return "0";
  if (n >= 1000) return n.toFixed(2);
  if (n >= 1) return n.toFixed(4);
  return n.toPrecision(4);
}

// ─── Tabs ────────────────────────────────────────────────────

type Tab = "overview" | "deposit" | "activity" | "settings";

// ─── Main Component ──────────────────────────────────────────

export default function VaultPage() {
  const { address, isConnected, connect, isConnecting, signer, chainId, switchToBsc } = useWalletContext();
  const [data, setData] = useState<VaultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [txPending, setTxPending] = useState(false);
  const [showDecisions, setShowDecisions] = useState(false);

  const expectedChainId = 56;

  const getTxErrorMessage = (err: unknown, fallback: string) => {
    const raw = err instanceof Error ? err.message : String(err || "");
    const msg = raw.toLowerCase();
    if (msg.includes("belowmindeposit") || msg.includes("below min deposit")) {
      return `Deposit is below minimum (${gl?.minDepositBnb || "0.01"} BNB)`;
    }
    if (msg.includes("depositspaused") || msg.includes("deposits paused")) {
      return "Vault deposits are temporarily paused";
    }
    if (msg.includes("insufficient funds")) {
      return "Insufficient BNB for deposit + gas";
    }
    if (msg.includes("user rejected") || msg.includes("rejected")) {
      return "Transaction rejected in wallet";
    }
    if (msg.includes("estimateGas") || msg.includes("missing revert data")) {
      return "Transaction simulation failed. Ensure you are on BNB Smart Chain mainnet and amount is valid.";
    }
    return fallback;
  };

  // Risk profile form state
  const [riskSlippage, setRiskSlippage] = useState("1.0");
  const [riskStopLoss, setRiskStopLoss] = useState("10.0");
  const [riskMaxAction, setRiskMaxAction] = useState("0.0005");
  const [riskAutoWithdraw, setRiskAutoWithdraw] = useState(true);
  const [riskAutoSwap, setRiskAutoSwap] = useState(false);

  // Fetch vault data
  const fetchData = useCallback(async (addr?: string) => {
    setLoading(true);
    try {
      const url = addr
        ? `/api/vault?address=${encodeURIComponent(addr)}`
        : "/api/vault";
      const res = await fetch(url);
      if (res.ok) {
        setData(await res.json());
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData(address || undefined);
  }, [address, fetchData]);

  // ─── Deposit BNB ───
  const handleDeposit = async () => {
    if (!signer || !depositAmt || txPending) return;
    if (chainId !== expectedChainId) {
      toast.error("Switch wallet to BNB Smart Chain mainnet (Chain ID 56)");
      await switchToBsc();
      return;
    }
    const amt = parseFloat(depositAmt);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const minDeposit = parseFloat(gl?.minDepositBnb || "0.01");
    if (amt < minDeposit) {
      toast.error(`Minimum deposit is ${minDeposit} BNB`);
      return;
    }
    setTxPending(true);
    try {
      const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
      const tx = await vault.deposit({ value: ethers.parseEther(depositAmt) });
      toast.loading("Depositing...", { id: "vault-tx" });
      await tx.wait();
      toast.success(`Deposited ${depositAmt} BNB`, { id: "vault-tx" });
      setDepositAmt("");
      fetchData(address || undefined);
    } catch (err: unknown) {
      toast.error(getTxErrorMessage(err, "Deposit failed"), { id: "vault-tx" });
    }
    setTxPending(false);
  };

  // ─── Withdraw BNB ───
  const handleWithdraw = async () => {
    if (!signer || txPending) return;
    if (chainId !== expectedChainId) {
      toast.error("Switch wallet to BNB Smart Chain mainnet (Chain ID 56)");
      await switchToBsc();
      return;
    }
    setTxPending(true);
    try {
      const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
      const amount = withdrawAmt
        ? ethers.parseEther(withdrawAmt)
        : BigInt(0); // 0 = withdraw all
      const tx = await vault.withdraw(amount);
      toast.loading("Withdrawing...", { id: "vault-tx" });
      await tx.wait();
      toast.success("Withdrawal complete", { id: "vault-tx" });
      setWithdrawAmt("");
      fetchData(address || undefined);
    } catch (err: unknown) {
      toast.error(getTxErrorMessage(err, "Withdrawal failed"), { id: "vault-tx" });
    }
    setTxPending(false);
  };

  // ─── Emergency Withdraw ───
  const handleEmergencyWithdraw = async () => {
    if (!signer || txPending) return;
    if (chainId !== expectedChainId) {
      toast.error("Switch wallet to BNB Smart Chain mainnet (Chain ID 56)");
      await switchToBsc();
      return;
    }
    if (!confirm("Emergency withdraw ALL funds? This closes your position.")) return;
    setTxPending(true);
    try {
      const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
      const tx = await vault.emergencyWithdraw();
      toast.loading("Emergency withdrawing...", { id: "vault-tx" });
      await tx.wait();
      toast.success("Emergency withdrawal complete", { id: "vault-tx" });
      fetchData(address || undefined);
    } catch (err: unknown) {
      toast.error(getTxErrorMessage(err, "Emergency withdrawal failed"), { id: "vault-tx" });
    }
    setTxPending(false);
  };

  // Sync risk profile form when data loads
  useEffect(() => {
    if (data?.position?.riskProfile) {
      const rp = data.position.riskProfile;
      setRiskSlippage((rp.maxSlippage / 100).toString());
      setRiskStopLoss((rp.stopLossThreshold / 100).toString());
      setRiskMaxAction(rp.maxSingleActionValue);
      setRiskAutoWithdraw(rp.allowAutoWithdraw);
      setRiskAutoSwap(rp.allowAutoSwap);
    }
  }, [data]);

  // ─── Update Risk Profile ───
  const handleUpdateRiskProfile = async () => {
    if (!signer || txPending) return;
    if (chainId !== expectedChainId) {
      toast.error("Switch wallet to BNB Smart Chain mainnet (Chain ID 56)");
      await switchToBsc();
      return;
    }
    const slippage = parseFloat(riskSlippage);
    const stopLoss = parseFloat(riskStopLoss);
    const maxAction = parseFloat(riskMaxAction);
    if (isNaN(slippage) || slippage <= 0 || slippage > 50) {
      toast.error("Max slippage must be between 0.1% and 50%");
      return;
    }
    if (isNaN(stopLoss) || stopLoss <= 0 || stopLoss > 100) {
      toast.error("Stop loss must be between 0.1% and 100%");
      return;
    }
    if (isNaN(maxAction) || maxAction <= 0) {
      toast.error("Max action value must be greater than 0");
      return;
    }
    setTxPending(true);
    try {
      const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
      const tx = await vault.updateRiskProfile(
        Math.round(slippage * 100),
        Math.round(stopLoss * 100),
        ethers.parseEther(riskMaxAction),
        riskAutoWithdraw,
        riskAutoSwap
      );
      toast.loading("Updating risk profile...", { id: "vault-tx" });
      await tx.wait();
      toast.success("Risk profile updated!", { id: "vault-tx" });
      fetchData(address || undefined);
    } catch (err: unknown) {
      toast.error(getTxErrorMessage(err, "Update failed"), { id: "vault-tx" });
    }
    setTxPending(false);
  };

  // ─── Authorize Agent ───
  const handleAuthorizeAgent = async () => {
    if (!signer || txPending) return;
    if (chainId !== expectedChainId) {
      toast.error("Switch wallet to BNB Smart Chain mainnet (Chain ID 56)");
      await switchToBsc();
      return;
    }
    setTxPending(true);
    try {
      const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
      const tx = await vault.authorizeAgent(0);
      toast.loading("Authorizing AI agent...", { id: "vault-tx" });
      await tx.wait();
      toast.success("Aegis Guardian Alpha authorized! AI protection is now active.", { id: "vault-tx" });
      fetchData(address || undefined);
    } catch (err: unknown) {
      toast.error(getTxErrorMessage(err, "Authorization failed"), { id: "vault-tx" });
    }
    setTxPending(false);
  };

  // ─── Revoke Agent ───
  const handleRevokeAgent = async () => {
    if (!signer || txPending) return;
    if (chainId !== expectedChainId) {
      toast.error("Switch wallet to BNB Smart Chain mainnet (Chain ID 56)");
      await switchToBsc();
      return;
    }
    if (!confirm("Revoke AI agent? Your position will no longer be auto-protected.")) return;
    setTxPending(true);
    try {
      const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
      const tx = await vault.revokeAgent();
      toast.loading("Revoking agent...", { id: "vault-tx" });
      await tx.wait();
      toast.success("Agent revoked", { id: "vault-tx" });
      fetchData(address || undefined);
    } catch (err: unknown) {
      toast.error(getTxErrorMessage(err, "Revoke failed"), { id: "vault-tx" });
    }
    setTxPending(false);
  };

  const pos = data?.position;
  const yld = data?.yield;
  const gl = data?.global;
  const isBsc = chainId === expectedChainId;
  const hasYield = yld && parseFloat(yld.grossYieldEarned) > 0;

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-4" style={{ background: "rgba(240, 185, 11, 0.1)", color: "var(--bnb)" }}>
            <Lock className="w-3.5 h-3.5" />Protected Vault
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
            Deposit. Earn. Stay Protected.
          </h1>
          <p className="text-sm sm:text-base max-w-xl mx-auto" style={{ color: "var(--text-muted)" }}>
            Deposit BNB to earn yield via Venus Protocol. AI agents monitor
            your position 24/7 — auto-protecting against liquidations, exploits, and crashes.
          </p>
        </div>

        {/* Testnet Beta Banner — only shown on testnet */}
        {process.env.NEXT_PUBLIC_CHAIN_ID !== "56" && (
        <div className="mb-6 p-4 rounded-xl text-center" style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(240,185,11,0.06))", border: "1px solid rgba(251,191,36,0.25)" }}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2" style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
            <AlertTriangle className="w-3 h-3" /> Testnet Beta
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            The vault is live on <span className="font-medium text-white">BSC Testnet</span> for testing.
            Mainnet deployment with real Venus yield is coming soon.
            All balances shown are testnet BNB with no real value.
          </p>
        </div>
        )}

        {/* Network Warning */}
        {isConnected && !isBsc && (
          <div className="mb-6 p-4 rounded-xl flex items-center justify-between gap-3" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: "var(--yellow)" }} />
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--yellow)" }}>
                  Wrong network detected
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  You&apos;re on chain ID {chainId}. The vault runs on BNB Smart Chain (56).
                </div>
              </div>
            </div>
            <button
              onClick={switchToBsc}
              className="btn-primary text-xs px-4 py-2 shrink-0"
            >
              Switch to BNB Chain
            </button>
          </div>
        )}

        {/* ── Global Stats Banner ── */}
        {gl && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: "Total Deposited", value: `${formatBnb(gl.totalBnbDeposited)} BNB`, icon: Layers, color: "var(--bnb)" },
              { label: "Yield Distributed", value: `${formatBnb(gl.totalYieldDistributed)} BNB`, icon: TrendingUp, color: "var(--green)" },
              { label: "Value Protected", value: `${formatBnb(gl.totalValueProtected)} BNB`, icon: ShieldCheck, color: "var(--accent)" },
              { label: "AI Agents", value: String(gl.agentCount), icon: Bot, color: "var(--purple)" },
            ].map((s) => (
              <div key={s.label} className="card p-4 text-center">
                <s.icon className="w-4 h-4 mx-auto mb-1.5" style={{ color: s.color }} />
                <div className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</div>
                <div className="text-sm font-bold text-white">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Venus Protocol Status ── */}
        {gl?.venus?.enabled && (
          <div className="card p-5 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(34, 197, 94, 0.1)" }}>
                <TrendingUp className="w-4 h-4" style={{ color: "var(--green)" }} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Venus Protocol — Live Yield</div>
                <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {gl.venus.allocationPct}% of vault auto-deployed to Venus lending
                </div>
              </div>
              <div className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: "rgba(34, 197, 94, 0.1)", color: "var(--green)" }}>
                ● Active
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
                <div className="text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>Working in Venus ({gl.venus.allocationPct}%)</div>
                <div className="text-sm font-bold" style={{ color: "var(--bnb)" }}>{formatBnb(gl.venus.deployed)} BNB</div>
              </div>
              <div className="p-3 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
                <div className="text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>Current Venus Value</div>
                <div className="text-sm font-bold" style={{ color: "var(--green)" }}>{formatBnb(gl.venus.currentValue)} BNB</div>
              </div>
              <div className="p-3 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
                <div className="text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>Pending Yield</div>
                <div className="text-sm font-bold" style={{ color: "#a78bfa" }}>{formatBnb(gl.venus.pendingYield)} BNB</div>
              </div>
            </div>
            <div className="mt-3 p-3 rounded-xl flex items-start gap-2" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
              <div className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                <span className="font-semibold" style={{ color: "#60a5fa" }}>Why is only {gl.venus.allocationPct}% in Venus?</span> The other {100 - gl.venus.allocationPct}% stays in the vault as an instant-withdrawal buffer so you don&apos;t need to unwind from Venus on small withdrawals.
                Your <span className="font-semibold text-white">total position</span> is shown below — nothing is missing.
                Yield accrues per block (~3s) and grows continuously; small deposits show ~0 yield at first because Venus APY compounds in tiny increments.
              </div>
            </div>
          </div>
        )}

        {/* ── Not connected ── */}
        {!isConnected && (
          <div className="card p-8 sm:p-12 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "rgba(240, 185, 11, 0.1)" }}>
              <Wallet className="w-8 h-8" style={{ color: "var(--bnb)" }} />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Connect to Access Vault</h2>
            <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
              Deposit BNB to start earning yield with AI-powered protection.
              Your funds are secured by on-chain smart contracts.
            </p>
            <button onClick={connect} disabled={isConnecting} className="btn-primary inline-flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>

            {/* How it works */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              {[
                { icon: ArrowDown, title: "1. Deposit BNB", desc: "Send BNB to the vault. Min deposit 0.001 BNB. Withdraw anytime." },
                { icon: TrendingUp, title: "2. Earn Yield", desc: "80% auto-deployed to Venus Protocol lending. ~2-4% APY from real borrower interest." },
                { icon: ShieldCheck, title: "3. AI Protects", desc: "AI agents monitor 24/7. Stop-loss auto-swaps BNB → USDT via PancakeSwap on crashes." },
              ].map((step) => (
                <div key={step.title} className="p-5 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
                  <step.icon className="w-5 h-5 mb-3" style={{ color: "var(--accent)" }} />
                  <div className="text-sm font-semibold text-white mb-1">{step.title}</div>
                  <div className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{step.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Connected Dashboard ── */}
        {isConnected && data && (
          <>
            {/* Tabs */}
            <div className="flex items-center gap-1 mb-6 p-1 rounded-xl" style={{ background: "var(--bg-raised)" }}>
              {([
                { key: "overview", label: "Overview", icon: Eye },
                { key: "deposit", label: "Deposit / Withdraw", icon: DollarSign },
                { key: "activity", label: "Activity", icon: History },
                { key: "settings", label: "Protection", icon: Settings },
              ] as { key: Tab; label: string; icon: typeof Eye }[]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: tab === t.key ? "var(--bg-elevated)" : "transparent",
                    color: tab === t.key ? "var(--accent)" : "var(--text-muted)",
                    borderWidth: tab === t.key ? 1 : 0,
                    borderColor: "var(--accent-border)",
                  }}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>

            {/* ═══ OVERVIEW TAB ═══ */}
            {tab === "overview" && (
              <div className="space-y-6">
                {/* Position Card */}
                <div className="card p-6">
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <div className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Your Position</div>
                      <div className="text-3xl font-bold text-white">
                        {pos?.isActive ? `${formatBnb(pos.bnbBalance)} BNB` : "No Active Position"}
                      </div>
                      {pos?.isActive && pos.depositTimestamp > 0 && (
                        <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                          Deposited {timeAgo(pos.depositTimestamp)}
                        </div>
                      )}
                    </div>
                    <button onClick={() => fetchData(address || undefined)} className="p-2 rounded-lg transition-colors" style={{ background: "var(--bg-elevated)" }}>
                      <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} style={{ color: "var(--text-muted)" }} />
                    </button>
                  </div>

                  {/* Yield Info */}
                  {hasYield && yld && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                      {[
                        { label: "Yield Earned (gross)", value: `${formatBnb(yld.grossYieldEarned)} BNB`, color: "var(--bnb)" },
                        { label: "Net Yield (after fee)", value: `${formatBnb(yld.netYieldEarned)} BNB`, color: "var(--green)" },
                        { label: "Performance Fee", value: `${yld.performanceFeePct}%`, color: "var(--text-secondary)" },
                      ].map((s) => (
                        <div key={s.label} className="p-3 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
                          <div className="text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</div>
                          <div className="text-sm font-bold" style={{ color: s.color }}>{s.value}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {pos?.isActive && !hasYield && (
                    <div className="grid grid-cols-1 gap-3 mb-5">
                      <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: "rgba(0, 212, 245, 0.04)", border: "1px solid rgba(0, 212, 245, 0.1)" }}>
                        <TrendingUp className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
                        <div>
                          <div className="text-sm font-medium mb-1" style={{ color: "var(--accent)" }}>
                            Your BNB is being deployed to Venus Protocol
                          </div>
                          <div className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                            80% of your deposit is auto-deployed to Venus lending for real yield.
                            Yield is harvested and distributed on-chain by the Aegis agent.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stablecoin Balance (from stop-loss) */}
                  {pos?.isActive && pos.stablecoinBalance && parseFloat(pos.stablecoinBalance) > 0 && (
                    <div className="p-3 rounded-xl mb-5 flex items-center justify-between" style={{ background: "rgba(34, 197, 94, 0.06)", border: "1px solid rgba(34, 197, 94, 0.12)" }}>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" style={{ color: "var(--green)" }} />
                        <div>
                          <div className="text-xs font-medium" style={{ color: "var(--green)" }}>Stablecoin Balance (from Stop-Loss)</div>
                          <div className="text-sm font-bold text-white">{formatBnb(pos.stablecoinBalance)} USDT</div>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          if (!signer) return;
                          try {
                            const c = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
                            const tx = await c.withdrawStablecoin(0);
                            toast.loading("Withdrawing stablecoin...", { id: "stb" });
                            await tx.wait();
                            toast.success("Stablecoin withdrawn!", { id: "stb" });
                            fetchData(address || undefined);
                          } catch (e: unknown) {
                            const msg = e instanceof Error ? e.message : "Failed";
                            toast.error(msg, { id: "stb" });
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg"
                        style={{ background: "rgba(34, 197, 94, 0.15)", color: "var(--green)" }}
                      >
                        Withdraw USDT
                      </button>
                    </div>
                  )}

                  {!pos?.isActive && (
                    <button onClick={() => setTab("deposit")} className="btn-primary flex items-center gap-2 w-full justify-center">
                      <ArrowDown className="w-4 h-4" />Deposit BNB to Start Earning
                    </button>
                  )}

                  {hasYield && yld && (
                    <div className="text-[10px] flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                      <Activity className="w-3 h-3" />
                      Strategy: {yld.strategy} &middot; Performance fee: {yld.performanceFeePct}%
                      {data.tier && data.tier.tier > 0 && (
                        <span style={{ color: tierColor(data.tier.tier) }}>
                          &middot; {data.tier.tierName} discount applied
                        </span>
                      )}
                    </div>
                  )}

                  {pos?.isActive && !hasYield && (
                    <div className="text-[10px] flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                      <Activity className="w-3 h-3" />
                      Strategy: Venus Protocol Lending &middot; Yield accruing
                    </div>
                  )}
                </div>

                {/* AI Protection Status */}
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Bot className="w-4 h-4" style={{ color: "var(--accent)" }} />
                    <span className="text-sm font-medium text-white">AI Protection</span>
                  </div>

                  {pos?.agentAuthorized ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(34, 197, 94, 0.06)", border: "1px solid rgba(34, 197, 94, 0.15)" }}>
                        <div className="flex items-center gap-3">
                          <ShieldCheck className="w-5 h-5" style={{ color: "var(--green)" }} />
                          <div>
                            <div className="text-sm font-medium text-white">
                              {pos.agentName || `Agent #${pos.authorizedAgentId}`}
                            </div>
                            <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {pos.agentTier || "Guardian"} tier{pos.agentSuccessRate && pos.agentSuccessRate !== "N/A" ? ` · ${pos.agentSuccessRate}% success rate` : " · Monitoring 24/7"}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs px-2 py-1 rounded-md" style={{ background: "rgba(34, 197, 94, 0.1)", color: "var(--green)" }}>
                          Active
                        </div>
                      </div>
                      {pos.lastActionTimestamp > 0 && (
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          Last action: {timeAgo(pos.lastActionTimestamp)}
                        </div>
                      )}
                    </div>
                  ) : pos?.isActive ? (
                    <div className="p-4 rounded-xl text-center" style={{ background: "var(--bg-elevated)" }}>
                      <ShieldAlert className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--yellow)" }} />
                      <p className="text-xs mb-2 font-medium text-white">
                        Your position is unprotected
                      </p>
                      <p className="text-[10px] mb-4" style={{ color: "var(--text-muted)" }}>
                        Enable 24/7 AI monitoring, auto-exit on threats, and stop-loss protection.
                      </p>
                      <button
                        onClick={handleAuthorizeAgent}
                        disabled={txPending || !isBsc}
                        className="btn-primary inline-flex items-center gap-2 text-xs !px-4 !py-2"
                      >
                        {txPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                        Activate AI Protection
                      </button>
                      <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
                        Aegis Guardian Alpha · Archon tier · 24/7 monitoring
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl text-center" style={{ background: "var(--bg-elevated)" }}>
                      <Bot className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Deposit BNB to enable AI protection.
                      </p>
                    </div>
                  )}
                </div>

                {/* Risk Assessment */}
                {data.risk && (
                  <div className="card p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className="w-4 h-4" style={{ color: "var(--purple)" }} />
                      <span className="text-sm font-medium text-white">Risk Assessment</span>
                      <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>
                        {timeAgo(data.risk.timestamp)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Overall", value: data.risk.overallRisk, color: riskColor(data.risk.overallRisk) },
                        { label: "Liquidation", value: `${data.risk.liquidationRisk.toFixed(1)}%`, color: data.risk.liquidationRisk > 50 ? "#ef4444" : "var(--green)" },
                        { label: "Volatility", value: `${data.risk.volatilityScore.toFixed(1)}%`, color: data.risk.volatilityScore > 50 ? "#f97316" : "var(--green)" },
                        { label: "Protocol", value: `${data.risk.protocolRisk.toFixed(1)}%`, color: data.risk.protocolRisk > 50 ? "#f97316" : "var(--green)" },
                      ].map((r) => (
                        <div key={r.label} className="p-3 rounded-xl text-center" style={{ background: "var(--bg-elevated)" }}>
                          <div className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>{r.label}</div>
                          <div className="text-sm font-bold" style={{ color: r.color }}>{r.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* $UNIQ Tier */}
                {data.tier && data.tier.tier > 0 && (
                  <div className="card p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${tierColor(data.tier.tier)}15` }}>
                          <Shield className="w-5 h-5" style={{ color: tierColor(data.tier.tier) }} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">
                            $UNIQ {data.tier.tierName} Tier
                          </div>
                          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {data.tier.feeDiscountBps > 0
                              ? `${(data.tier.feeDiscountBps / 100).toFixed(2)}% fee discount active`
                              : "Hold $UNIQ to reduce vault fees"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                          Fee: {(data.tier.effectiveFeeBps / 100).toFixed(2)}%
                        </div>
                        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          Base: {((data.global?.protocolFeeBps || 50) / 100).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ DEPOSIT/WITHDRAW TAB ═══ */}
            {tab === "deposit" && (
              <div className="space-y-6">
                {/* Deposit Card */}
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <ArrowDown className="w-4 h-4" style={{ color: "var(--green)" }} />
                    <span className="text-sm font-medium text-white">Deposit BNB</span>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={depositAmt}
                        onChange={(e) => setDepositAmt(e.target.value)}
                        placeholder={`Min: ${data?.global?.minDepositBnb || "0.001"} BNB`}
                        className="w-full px-4 py-3 rounded-xl text-sm font-mono text-white placeholder:text-zinc-600 outline-none"
                        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{ color: "var(--bnb)" }}>BNB</span>
                    </div>
                    <button
                      onClick={handleDeposit}
                      disabled={txPending || !depositAmt || !isBsc}
                      className="btn-primary flex items-center gap-2 !px-6"
                    >
                      {txPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDown className="w-4 h-4" />}
                      Deposit
                    </button>
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    <p>Deposits earn yield via Venus Protocol lending, distributed on-chain by the protocol.</p>
                    <p>Performance fee: {gl?.performanceFeeBps ? (gl.performanceFeeBps / 100).toFixed(1) : "15.0"}% of yield earned. $UNIQ holders get reduced fees.</p>
                  </div>
                </div>

                {/* Withdraw Card */}
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <ArrowUp className="w-4 h-4" style={{ color: "var(--accent)" }} />
                    <span className="text-sm font-medium text-white">Withdraw BNB</span>
                  </div>
                  {pos?.isActive ? (
                    <>
                      <div className="flex gap-3 mb-3">
                        <div className="flex-1 relative">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={withdrawAmt}
                            onChange={(e) => setWithdrawAmt(e.target.value)}
                            placeholder="Amount (leave empty = withdraw all)"
                            className="w-full px-4 py-3 rounded-xl text-sm font-mono text-white placeholder:text-zinc-600 outline-none"
                            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{ color: "var(--bnb)" }}>BNB</span>
                        </div>
                        <button
                          onClick={handleWithdraw}
                          disabled={txPending || !isBsc}
                          className="btn-secondary flex items-center gap-2 !px-6"
                        >
                          {txPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                          Withdraw
                        </button>
                      </div>
                      <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        Available: {formatBnb(pos.bnbBalance)} BNB &middot; Withdraw anytime, no lock-up.
                      </div>

                      {/* Emergency Withdraw */}
                      <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                        <button
                          onClick={handleEmergencyWithdraw}
                          disabled={txPending || !isBsc}
                          className="text-xs flex items-center gap-1.5 transition-colors"
                          style={{ color: "#ef4444" }}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Emergency Withdraw All
                        </button>
                        <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                          Instantly withdraws all BNB and tokens. Closes your position.
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 rounded-xl text-center" style={{ background: "var(--bg-elevated)" }}>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        No active position. Deposit BNB first.
                      </p>
                    </div>
                  )}
                </div>

                {/* Yield Strategy Info */}
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4" style={{ color: "var(--green)" }} />
                    <span className="text-sm font-medium text-white">Yield Strategy</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      { name: "Venus Protocol", desc: "BNB lending market. Earn supply APY from borrowers. 80% of deposits auto-deployed.", apy: "2-4%", risk: "Low" },
                      { name: "PancakeSwap", desc: "Used for stop-loss swaps — auto-converts BNB to USDT when risk is detected.", apy: "N/A", risk: "Low" },
                    ].map((s) => (
                      <div key={s.name} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
                        <div>
                          <div className="text-xs font-medium text-white">{s.name}</div>
                          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{s.desc}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold" style={{ color: "var(--green)" }}>{s.apy}</div>
                          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>Risk: {s.risk}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ ACTIVITY TAB ═══ */}
            {tab === "activity" && (
              <div className="space-y-6">
                {/* User Actions */}
                <div className="card overflow-hidden">
                  <div className="p-4 flex items-center gap-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                    <History className="w-4 h-4" style={{ color: "var(--accent)" }} />
                    <span className="text-sm font-medium text-white">Your Protection History</span>
                    <span className="text-[10px] ml-auto font-mono" style={{ color: "var(--text-muted)" }}>
                      {data.actions.length} actions
                    </span>
                  </div>
                  {data.actions.length > 0 ? (
                    <div>
                      {data.actions.map((action) => (
                        <div key={action.id} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0" style={{ borderColor: "var(--border-subtle)" }}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
                              background: action.successful ? "rgba(34, 197, 94, 0.08)" : "rgba(239, 68, 68, 0.08)",
                            }}>
                              {action.successful ? (
                                <CheckCircle className="w-4 h-4" style={{ color: "var(--green)" }} />
                              ) : (
                                <AlertTriangle className="w-4 h-4" style={{ color: "#ef4444" }} />
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-medium text-white">{action.actionType}</div>
                              <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                Agent #{action.agentId} &middot; {timeAgo(action.timestamp)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-mono text-white">{formatBnb(action.value)} BNB</div>
                            <div className="text-[10px]" style={{ color: action.successful ? "var(--green)" : "#ef4444" }}>
                              {action.successful ? "Success" : "Failed"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--green)" }} />
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        No protection actions yet. AI agents will log actions here.
                      </p>
                    </div>
                  )}
                </div>

                {/* Global Decision Log */}
                <div className="card overflow-hidden">
                  <button
                    onClick={() => setShowDecisions(!showDecisions)}
                    className="w-full p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4" style={{ color: "var(--purple)" }} />
                      <span className="text-sm font-medium text-white">AI Decision Log (On-Chain)</span>
                    </div>
                    {showDecisions ? (
                      <ChevronUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                    ) : (
                      <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                    )}
                  </button>
                  {showDecisions && (
                    <div className="border-t" style={{ borderColor: "var(--border-subtle)" }}>
                      {data.decisions.length > 0 ? (
                        data.decisions.map((d) => (
                          <div key={d.id} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0" style={{ borderColor: "var(--border-subtle)" }}>
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full" style={{ background: riskColor(d.riskLevel) }} />
                              <div>
                                <div className="text-xs font-medium text-white">{d.decisionType}</div>
                                <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                  Agent #{d.agentId} &middot; {d.confidence}% confidence &middot; {timeAgo(d.timestamp)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-medium" style={{ color: riskColor(d.riskLevel) }}>
                                {d.riskLevel}
                              </span>
                              {d.actionTaken && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(34, 197, 94, 0.08)", color: "var(--green)" }}>
                                  Action
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center">
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>No decisions logged yet.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══ SETTINGS/PROTECTION TAB ═══ */}
            {tab === "settings" && pos?.isActive && (
              <div className="space-y-6">
                {/* Risk Profile */}
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings className="w-4 h-4" style={{ color: "var(--accent)" }} />
                    <span className="text-sm font-medium text-white">Risk Profile</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>Max Slippage (%)</label>
                      <input
                        type="number" step="0.1" min="0.1" max="50"
                        value={riskSlippage}
                        onChange={(e) => setRiskSlippage(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-sm font-mono text-white outline-none"
                        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
                      />
                      <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Maximum acceptable slippage per trade</p>
                    </div>
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>Stop Loss (%)</label>
                      <input
                        type="number" step="0.5" min="1" max="100"
                        value={riskStopLoss}
                        onChange={(e) => setRiskStopLoss(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-sm font-mono text-white outline-none"
                        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
                      />
                      <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Auto-exit if portfolio loss exceeds this</p>
                    </div>
                    <div>
                      <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>Max Action Value (BNB)</label>
                      <input
                        type="number" step="0.0001" min="0.0001"
                        value={riskMaxAction}
                        onChange={(e) => setRiskMaxAction(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-sm font-mono text-white outline-none"
                        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
                      />
                      <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Maximum BNB the agent can use per action</p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>Auto-Withdraw on Threats</label>
                        <button
                          onClick={() => setRiskAutoWithdraw(!riskAutoWithdraw)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm w-full transition-colors"
                          style={{
                            background: riskAutoWithdraw ? "rgba(34, 197, 94, 0.08)" : "var(--bg-elevated)",
                            border: `1px solid ${riskAutoWithdraw ? "rgba(34, 197, 94, 0.2)" : "var(--border-subtle)"}`,
                            color: riskAutoWithdraw ? "var(--green)" : "var(--text-muted)",
                          }}
                        >
                          {riskAutoWithdraw ? <CheckCircle className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          {riskAutoWithdraw ? "Enabled" : "Disabled"}
                        </button>
                      </div>
                      <div>
                        <label className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>Auto-Swap on Threats</label>
                        <button
                          onClick={() => setRiskAutoSwap(!riskAutoSwap)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm w-full transition-colors"
                          style={{
                            background: riskAutoSwap ? "rgba(34, 197, 94, 0.08)" : "var(--bg-elevated)",
                            border: `1px solid ${riskAutoSwap ? "rgba(34, 197, 94, 0.2)" : "var(--border-subtle)"}`,
                            color: riskAutoSwap ? "var(--green)" : "var(--text-muted)",
                          }}
                        >
                          {riskAutoSwap ? <CheckCircle className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          {riskAutoSwap ? "Enabled" : "Disabled"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleUpdateRiskProfile}
                    disabled={txPending || !isBsc}
                    className="btn-primary flex items-center gap-2 mt-5 w-full justify-center"
                  >
                    {txPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                    Save Risk Profile
                  </button>
                </div>

                {/* Agent Authorization */}
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Bot className="w-4 h-4" style={{ color: "var(--purple)" }} />
                    <span className="text-sm font-medium text-white">AI Agent Authorization</span>
                  </div>
                  {pos.agentAuthorized ? (
                    <div>
                      <div className="p-4 rounded-xl mb-3" style={{ background: "rgba(34, 197, 94, 0.06)", border: "1px solid rgba(34, 197, 94, 0.15)" }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-white">
                              {pos.agentName || `Agent #${pos.authorizedAgentId}`}
                            </div>
                            <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {pos.agentTier} tier &middot; Monitoring 24/7
                            </div>
                          </div>
                          <CheckCircle className="w-5 h-5" style={{ color: "var(--green)" }} />
                        </div>
                      </div>
                      <button
                        onClick={handleRevokeAgent}
                        disabled={txPending || !isBsc}
                        className="text-xs flex items-center gap-1.5 transition-colors hover:opacity-80"
                        style={{ color: "#ef4444" }}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Revoke Agent Authorization
                      </button>
                      <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                        This will disable AI auto-protection on your position.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl text-center" style={{ background: "var(--bg-elevated)" }}>
                      <ShieldAlert className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--yellow)" }} />
                      <p className="text-xs mb-1 font-medium text-white">No Agent Authorized</p>
                      <p className="text-[10px] mb-4" style={{ color: "var(--text-muted)" }}>
                        Authorize an AI agent to enable 24/7 auto-protection: threat detection,
                        stop-loss, exploit monitoring, and whale alerts.
                      </p>
                      <button
                        onClick={handleAuthorizeAgent}
                        disabled={txPending || !isBsc}
                        className="btn-primary inline-flex items-center gap-2 text-xs"
                      >
                        {txPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                        Activate AI Protection (Aegis Guardian Alpha)
                      </button>
                    </div>
                  )}
                </div>

                {/* AI Protection Features */}
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck className="w-4 h-4" style={{ color: "var(--green)" }} />
                    <span className="text-sm font-medium text-white">AI Protection Features</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { title: "Liquidation Guard", desc: "If Venus utilization spikes, auto-withdraw before liquidation.", active: true },
                      { title: "Exploit Shield", desc: "If PancakeSwap pool gets exploited, emergency exit immediately.", active: true },
                      { title: "Stop-Loss", desc: "If BNB drops below your threshold, auto-convert to USDT.", active: pos.riskProfile.allowAutoWithdraw },
                      { title: "Whale Alert", desc: "If large wallets dump, alert and optionally exit position.", active: true },
                      { title: "Smart Contract Monitor", desc: "Track contract upgrades and admin actions on yield protocols.", active: true },
                    ].map((f) => (
                      <div key={f.title} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{
                            background: f.active ? "rgba(34, 197, 94, 0.1)" : "rgba(107, 114, 128, 0.1)",
                          }}>
                            {f.active ? (
                              <CheckCircle className="w-3.5 h-3.5" style={{ color: "var(--green)" }} />
                            ) : (
                              <Lock className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-white">{f.title}</div>
                            <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{f.desc}</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-medium" style={{ color: f.active ? "var(--green)" : "var(--text-muted)" }}>
                          {f.active ? "Active" : "Off"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === "settings" && !pos?.isActive && (
              <div className="card p-8 text-center">
                <Settings className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm text-white mb-2">No active position</p>
                <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                  Deposit BNB to configure protection settings.
                </p>
                <button onClick={() => setTab("deposit")} className="btn-primary inline-flex items-center gap-2">
                  <ArrowDown className="w-4 h-4" />Deposit BNB
                </button>
              </div>
            )}
          </>
        )}

        {/* Loading */}
        {isConnected && !data && loading && (
          <div className="card p-12 text-center">
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: "var(--accent)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading vault data...</p>
          </div>
        )}
      </div>
    </div>
  );
}
