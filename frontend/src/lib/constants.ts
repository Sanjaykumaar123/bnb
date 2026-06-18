// Real protocol addresses for mainnet deployment
export const MAINNET_PROTOCOLS = {
  VENUS_VBNB: "0xA07c5b74C9B40447a954e1466938b865b6BBea36",
  USDT: "0x55d398326f99059fF775485246999027B3197955",
  PANCAKE_ROUTER: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
  WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
};

// Contract addresses — env vars override defaults.
// On mainnet, missing env vars should fail safe instead of silently pointing to testnet.
const IS_MAINNET = process.env.NEXT_PUBLIC_CHAIN_ID === "56";

export const CONTRACTS = {
  REGISTRY: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || (IS_MAINNET ? "" : "0x806677bAb187157Ba567820e857e321c92E6C1EF"),
  VAULT: process.env.NEXT_PUBLIC_VAULT_ADDRESS || (IS_MAINNET ? "" : "0xfa80515136Fc8CB2db3b25C317A1c9a04bcD3536"),
  DECISION_LOGGER: process.env.NEXT_PUBLIC_LOGGER_ADDRESS || (IS_MAINNET ? "" : "0x978308DF80FE3AEDf228D58c3625db49e50FE51B"),
  TOKEN_GATE: process.env.NEXT_PUBLIC_TOKEN_GATE_ADDRESS || (IS_MAINNET ? "" : "0x0F998bb1B3866B73CAaBc54B7A84156b8F9f7543"),
  UNIQ_TOKEN: process.env.NEXT_PUBLIC_UNIQ_TOKEN_ADDRESS || "0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777",
  SCANNER: process.env.NEXT_PUBLIC_SCANNER_ADDRESS || (IS_MAINNET ? "" : "0x8fa659D8edeffF0bBdEC37cB2c16C2f85491C840"),
  VENUS_VBNB: process.env.NEXT_PUBLIC_VENUS_ADDRESS || (IS_MAINNET ? MAINNET_PROTOCOLS.VENUS_VBNB : "0xb3798541B08916528e37457259Eb723DB662d77E"),
  USDT: process.env.NEXT_PUBLIC_USDT_ADDRESS || (IS_MAINNET ? MAINNET_PROTOCOLS.USDT : "0x6a3654cb5ae1D1377831714aA2fBF30794e836BE"),
};

// $UNIQ Holder Tiers
export const HOLDER_TIERS = ["None", "Bronze", "Silver", "Gold"] as const;
export const HOLDER_TIER_COLORS = ["#6b7280", "#cd7f32", "#c0c0c0", "#ffd700"] as const;
export const HOLDER_TIER_THRESHOLDS = {
  Bronze: 10_000,
  Silver: 100_000,
  Gold:   1_000_000,
};
export const HOLDER_TIER_BENEFITS = {
  Free:   { features: "Basic token scanner, public whale alerts", feeDiscount: "0%" },
  Bronze: { features: "Wallet monitoring, personal whale alerts", feeDiscount: "10%" },
  Silver: { features: "Priority alerts, Telegram notifications", feeDiscount: "25%" },
  Gold:   { features: "AI risk explanations, custom stop-loss, early access", feeDiscount: "40%" },
} as const;

export const CHAIN_CONFIG = {
  bscTestnet: {
    chainId: "0x61",
    chainIdDecimal: 97,
    chainName: "BNB Smart Chain Testnet",
    nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
    rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545"],
    blockExplorerUrls: ["https://testnet.bscscan.com"],
  },
  bscMainnet: {
    chainId: "0x38",
    chainIdDecimal: 56,
    chainName: "BNB Smart Chain",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: ["https://bsc-dataseed1.binance.org"],
    blockExplorerUrls: ["https://bscscan.com"],
  },
};

export const RISK_LEVELS = ["None", "Low", "Medium", "High", "Critical"] as const;
export const RISK_COLORS = ["#6b7280", "#22c55e", "#eab308", "#f97316", "#ef4444"] as const;
export const ACTION_TYPES = ["Emergency Withdraw", "Rebalance", "Alert Only", "Stop Loss", "Take Profit"] as const;
export const AGENT_TIERS = ["Scout", "Guardian", "Sentinel", "Archon"] as const;
export const AGENT_STATUSES = ["Active", "Paused", "Decommissioned"] as const;

export const TESTNET_PROTOCOLS = {
  PANCAKE_ROUTER: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1",
  WBNB: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
};
