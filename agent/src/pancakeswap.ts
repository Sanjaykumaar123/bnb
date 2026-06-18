// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — PancakeSwap V2 Integration
// Real on-chain DEX price feeds and token analysis for BSC
// ═══════════════════════════════════════════════════════════════

import { ethers } from "ethers";

// PancakeSwap V2 Router on BSC Mainnet & Testnet
const PANCAKE_ROUTER_MAINNET = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const PANCAKE_FACTORY_MAINNET = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";

// Common BSC Token Addresses
export const BSC_TOKENS = {
  WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  USDT: "0x55d398326f99059fF775485246999027B3197955",
  CAKE: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
  ETH:  "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
  BTCB: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
  USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  XRP:  "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE",
};

const ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
  "function factory() external view returns (address)",
];

const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)",
  "function allPairsLength() external view returns (uint)",
];

const PAIR_ABI = [
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function totalSupply() external view returns (uint256)",
];

const ERC20_ABI = [
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address) external view returns (uint256)",
];

export interface PairData {
  pairAddress: string;
  token0: string;
  token1: string;
  reserve0: bigint;
  reserve1: bigint;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  priceToken0InToken1: number;
  priceToken1InToken0: number;
  liquidityUSD: number;
}

export interface TokenPrice {
  symbol: string;
  address: string;
  priceUSD: number;
  liquidityUSD: number;
  pairAddress: string;
}

// ─── PancakeSwap Provider ─────────────────────────────────────

export class PancakeSwapProvider {
  private provider: ethers.JsonRpcProvider;
  private router: ethers.Contract;
  private factory: ethers.Contract;
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private cacheTTL = 30000; // 30s cache

  constructor(rpcUrl: string = "https://bsc-dataseed1.binance.org") {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.router = new ethers.Contract(PANCAKE_ROUTER_MAINNET, ROUTER_ABI, this.provider);
    this.factory = new ethers.Contract(PANCAKE_FACTORY_MAINNET, FACTORY_ABI, this.provider);
    console.log("[PancakeSwap] DEX provider initialized (BSC Mainnet)");
  }

  /**
   * Get token price in USD via PancakeSwap Router
   * Routes: TOKEN → WBNB → BUSD
   */
  async getTokenPriceUSD(tokenAddress: string): Promise<number> {
    // Check cache
    const cached = this.priceCache.get(tokenAddress.toLowerCase());
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.price;
    }

    try {
      const amountIn = ethers.parseEther("1");

      if (tokenAddress.toLowerCase() === BSC_TOKENS.WBNB.toLowerCase()) {
        // BNB → BUSD direct
        const amounts = await this.router.getAmountsOut(amountIn, [
          BSC_TOKENS.WBNB,
          BSC_TOKENS.BUSD,
        ]);
        const price = parseFloat(ethers.formatEther(amounts[1]));
        this.priceCache.set(tokenAddress.toLowerCase(), { price, timestamp: Date.now() });
        return price;
      }

      // TOKEN → WBNB → BUSD
      const amounts = await this.router.getAmountsOut(amountIn, [
        tokenAddress,
        BSC_TOKENS.WBNB,
        BSC_TOKENS.BUSD,
      ]);
      const price = parseFloat(ethers.formatEther(amounts[2]));
      this.priceCache.set(tokenAddress.toLowerCase(), { price, timestamp: Date.now() });
      return price;
    } catch (error: any) {
      console.warn(`[PancakeSwap] Price fetch failed for ${tokenAddress}: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get BNB price in USD (most common query)
   */
  async getBNBPrice(): Promise<number> {
    return this.getTokenPriceUSD(BSC_TOKENS.WBNB);
  }

  /**
   * Get pair reserves and liquidity data
   */
  async getPairData(token0Address: string, token1Address: string): Promise<PairData | null> {
    try {
      const pairAddress = await this.factory.getPair(token0Address, token1Address);
      if (pairAddress === ethers.ZeroAddress) return null;

      const pair = new ethers.Contract(pairAddress, PAIR_ABI, this.provider);
      const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, this.provider);
      const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, this.provider);

      const [reserves, t0Symbol, t1Symbol, t0Decimals, t1Decimals] = await Promise.all([
        pair.getReserves(),
        token0Contract.symbol().catch(() => "???"),
        token1Contract.symbol().catch(() => "???"),
        token0Contract.decimals().catch(() => 18),
        token1Contract.decimals().catch(() => 18),
      ]);

      const reserve0 = reserves[0];
      const reserve1 = reserves[1];

      const r0Formatted = parseFloat(ethers.formatUnits(reserve0, t0Decimals));
      const r1Formatted = parseFloat(ethers.formatUnits(reserve1, t1Decimals));

      const priceToken0InToken1 = r0Formatted > 0 ? r1Formatted / r0Formatted : 0;
      const priceToken1InToken0 = r1Formatted > 0 ? r0Formatted / r1Formatted : 0;

      // Estimate USD liquidity (using BUSD/USDT reserves if one side is stablecoin)
      let liquidityUSD = 0;
      const stables = [BSC_TOKENS.BUSD.toLowerCase(), BSC_TOKENS.USDT.toLowerCase(), BSC_TOKENS.USDC.toLowerCase()];
      if (stables.includes(token0Address.toLowerCase())) {
        liquidityUSD = r0Formatted * 2;
      } else if (stables.includes(token1Address.toLowerCase())) {
        liquidityUSD = r1Formatted * 2;
      } else {
        // Estimate via BNB price
        const bnbPrice = await this.getBNBPrice();
        if (token0Address.toLowerCase() === BSC_TOKENS.WBNB.toLowerCase()) {
          liquidityUSD = r0Formatted * bnbPrice * 2;
        } else if (token1Address.toLowerCase() === BSC_TOKENS.WBNB.toLowerCase()) {
          liquidityUSD = r1Formatted * bnbPrice * 2;
        }
      }

      return {
        pairAddress,
        token0: token0Address,
        token1: token1Address,
        reserve0,
        reserve1,
        token0Symbol: t0Symbol,
        token1Symbol: t1Symbol,
        token0Decimals: Number(t0Decimals),
        token1Decimals: Number(t1Decimals),
        priceToken0InToken1,
        priceToken1InToken0,
        liquidityUSD,
      };
    } catch (error: any) {
      console.warn(`[PancakeSwap] Pair data failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Monitor multiple token prices for portfolio tracking
   */
  async getPortfolioPrices(tokens: string[]): Promise<TokenPrice[]> {
    const results: TokenPrice[] = [];
    
    for (const token of tokens) {
      try {
        const price = await this.getTokenPriceUSD(token);
        const pairAddr = await this.factory.getPair(token, BSC_TOKENS.WBNB).catch(() => ethers.ZeroAddress);
        
        // Get token symbol
        const tokenContract = new ethers.Contract(token, ERC20_ABI, this.provider);
        const symbol = await tokenContract.symbol().catch(() => "???");
        
        // Get pair liquidity
        let liquidityUSD = 0;
        if (pairAddr !== ethers.ZeroAddress) {
          const pair = new ethers.Contract(pairAddr, PAIR_ABI, this.provider);
          const reserves = await pair.getReserves();
          const bnbPrice = await this.getBNBPrice();
          // Assume token1 is WBNB (common on PancakeSwap)
          const bnbReserve = parseFloat(ethers.formatEther(reserves[1]));
          liquidityUSD = bnbReserve * bnbPrice * 2;
        }

        results.push({
          symbol,
          address: token,
          priceUSD: price,
          liquidityUSD,
          pairAddress: pairAddr,
        });
      } catch (error: any) {
        console.warn(`[PancakeSwap] Failed for ${token}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Get total pairs on PancakeSwap (shows DEX depth)
   */
  async getTotalPairs(): Promise<number> {
    try {
      const count = await this.factory.allPairsLength();
      return Number(count);
    } catch {
      return 0;
    }
  }

  /**
   * Analyze a token pair for DeFi risks
   */
  async analyzeTokenRisk(tokenAddress: string): Promise<{
    price: number;
    liquidity: number;
    isLowLiquidity: boolean;
    concentration: number;
    flags: string[];
  }> {
    const flags: string[] = [];
    const price = await this.getTokenPriceUSD(tokenAddress);
    
    const pairData = await this.getPairData(tokenAddress, BSC_TOKENS.WBNB);
    const liquidity = pairData?.liquidityUSD ?? 0;
    
    if (liquidity < 10000) flags.push("CRITICAL_LOW_LIQUIDITY");
    else if (liquidity < 100000) flags.push("LOW_LIQUIDITY");
    
    if (price === 0) flags.push("NO_PRICE_FEED");
    
    // Check token supply concentration
    let concentration = 0;
    try {
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const totalSupply = await token.totalSupply();
      // Check if pair contract holds a very small % (low liquidity lock)
      if (pairData) {
        const pairBalance = await token.balanceOf(pairData.pairAddress);
        const pairPct = Number(pairBalance * 10000n / totalSupply) / 100;
        if (pairPct < 1) flags.push("NEGLIGIBLE_LIQUIDITY_LOCK");
        concentration = 100 - pairPct;
      }
    } catch {
      flags.push("CONTRACT_READ_FAILED");
    }

    return {
      price,
      liquidity,
      isLowLiquidity: liquidity < 100000,
      concentration,
      flags,
    };
  }
}
