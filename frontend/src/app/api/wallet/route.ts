import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

// ─── BSC Mainnet token list (top tokens + Aegis project tokens) ────

const KNOWN_TOKENS: { address: string; symbol: string; decimals: number }[] = [
  // ── Aegis project token ──
  { address: "0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777", symbol: "UNIQ",  decimals: 18 },
  // ── Stablecoins ──
  { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT",  decimals: 18 },
  { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC",  decimals: 18 },
  { address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", symbol: "BUSD",  decimals: 18 },
  { address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", symbol: "DAI",   decimals: 18 },
  { address: "0x14016E85a25aeb13065688cAFB43044C2ef86784", symbol: "TUSD",  decimals: 18 },
  // ── Wrapped / bridged majors ──
  { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", symbol: "WBNB",  decimals: 18 },
  { address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", symbol: "ETH",   decimals: 18 },
  { address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", symbol: "BTCB",  decimals: 18 },
  // ── BSC DeFi blue chips ──
  { address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", symbol: "CAKE",  decimals: 18 },
  { address: "0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63", symbol: "XVS",   decimals: 18 },
  { address: "0xa184088a740c695E156F91f5cC086a06bb78b827", symbol: "AUTO",  decimals: 18 },
  { address: "0xfb6115445Bff7b52FeB98650C87f44907E58f802", symbol: "AAVE",  decimals: 18 },
  // ── POSI & other BSC tokens user may hold ──
  { address: "0x5CA42204cDaa70d5c773946e69dE942b85CA6706", symbol: "POSI",  decimals: 18 },
  { address: "0x5FbDB2315678afecb367f032d93F642f64180aa3", symbol: "TANGYUAN", decimals: 18 },
  // ── Popular BSC tokens ──
  { address: "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE", symbol: "XRP",   decimals: 18 },
  { address: "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47", symbol: "ADA",   decimals: 18 },
  { address: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43", symbol: "DOGE",  decimals: 8  },
  { address: "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD", symbol: "LINK",  decimals: 18 },
  { address: "0x1CE0c2827e2eF14D5C4f29a091d735A204794041", symbol: "AVAX",  decimals: 18 },
  { address: "0xBf5140A22578168FD562DCcF235E5D43A02ce9B1", symbol: "UNI",   decimals: 18 },
  { address: "0x4338665CBB7B2485A8855A139b75D5e34AB0DB94", symbol: "LTC",   decimals: 18 },
  { address: "0x8fF795a6F4D97E7887C79beA79aba5cc76444aDf", symbol: "BCH",   decimals: 18 },
  { address: "0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402", symbol: "DOT",   decimals: 18 },
  { address: "0x85EAC5Ac2F758618dFa09bDbe0cf174e7d574D5B", symbol: "TRX",   decimals: 18 },
  { address: "0x715D400F88C167884bbCc41C5FeA407ed4D2f8A0", symbol: "SXP",   decimals: 18 },
  { address: "0x947950BcC74888a40Ffa2593C5798F11Fc9124C4", symbol: "SUSHI", decimals: 18 },
  { address: "0x52CE071Bd9b1C4B00A0b92D298c512478CaD67e8", symbol: "COMP",  decimals: 18 },
  { address: "0x3d6545b08693daE087E957cb1180ee38B9e3c25E", symbol: "ETC",   decimals: 18 },
  { address: "0x250632378E573c6Be1AC2f97Fcdf00515d0Aa91B", symbol: "BETH",  decimals: 18 },
  { address: "0xAD6cAEb32CD2c308980a548bD0Bc5AA4306c6c18", symbol: "BAND",  decimals: 18 },
  { address: "0x56b6fB708fC5732DEC1Afc8D8556423A2EDcCbD6", symbol: "EOS",   decimals: 18 },
  { address: "0x16939ef78684453bfDFb47825F8a5F714f12623a", symbol: "XTZ",   decimals: 18 },
  { address: "0x88f1A5ae2A3BF98AEAF342D26B30a79438c9142e", symbol: "YFI",   decimals: 18 },
  { address: "0xE02dF9e3e622DeBdD69fb838bB799E3F168902c5", symbol: "BAKE",  decimals: 18 },
  { address: "0xAe9269f27437f0fcBC232d39Ec814844a51d6b8f", symbol: "BURGER",decimals: 18 },
  { address: "0x603c7f932ED1fc6575303D8Fb018fDCBb0f39a95", symbol: "BANANA",decimals: 18 },
  { address: "0x4BD17003473389A42DAF6a0a729f6Fdb328BbBd7", symbol: "VAI",   decimals: 18 },
  { address: "0x12BB890508c125661E03b09EC06E404bc9289040", symbol: "RACA",  decimals: 18 },
  { address: "0xc748673057861a797275CD8A068AbB95A902e8de", symbol: "BabyDoge", decimals: 9 },
  { address: "0x0Eb3a705fc54725037CC9e008bDede697f62F335", symbol: "ATOM",  decimals: 18 },
  { address: "0x8595F9dA7b868b1822194fAEd312235E43007b49", symbol: "BTT",   decimals: 18 },
  { address: "0xCC42724C6683B7E57334c4E856f4c9965ED682bD", symbol: "MATIC", decimals: 18 },
  { address: "0x0D8Ce2A99Bb6e3B7Db580eD848240e4a0F9aE153", symbol: "FIL",   decimals: 18 },
  { address: "0x0112e557d400474717056C4e6D40eDD846F38351", symbol: "SFP",   decimals: 18 },
  { address: "0xfe56d5892BDffC7BF58f2E84BE1b2C32D21C308b", symbol: "KNC",   decimals: 18 },
  { address: "0x965F527D9159dCe6288a2219DB51fc6Eef120dD1", symbol: "BSW",   decimals: 18 },
  { address: "0x352Cb5E19b12FC216548a2677bD0fce83BaE434B", symbol: "BTT2",  decimals: 18 },
  { address: "0xc2E9d07F66A89c44062459A47a0D2Dc038E4fb16", symbol: "FLOKI", decimals: 9  },
  { address: "0x2859e4544C4bB03966803b044A93563Bd2D0DD4D", symbol: "SHIB",  decimals: 18 },
  { address: "0x570A5D26f7765Ecb712C0924E4De545B89fD43dF", symbol: "SOL",   decimals: 18 },
];

// ── Multicall3 on BSC (deployed at same address on all EVM chains) ──
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const MULTICALL3_ABI = [
  "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[])",
];

const ERC20_IFACE = new ethers.Interface([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
]);

// Wallet scanning always uses BSC Mainnet (where real tokens live)
// Override with BSC_RPC env var if needed
const BSC_RPC = process.env.BSC_RPC || "https://bsc-dataseed1.binance.org";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// ─── Discover extra tokens via recent Transfer event logs ────
async function discoverTokensFromLogs(
  provider: ethers.JsonRpcProvider,
  wallet: string,
  knownSet: Set<string>,
): Promise<string[]> {
  try {
    const latest = await provider.getBlockNumber();
    // Scan last ~200k blocks (~7 days on BSC at 3s/block)
    const fromBlock = Math.max(0, latest - 200_000);
    const paddedAddr = "0x" + wallet.slice(2).toLowerCase().padStart(64, "0");

    // Incoming transfers (topic[2] = recipient)
    const logs = await provider.send("eth_getLogs", [{
      fromBlock: "0x" + fromBlock.toString(16),
      toBlock: "latest",
      topics: [TRANSFER_TOPIC, null, paddedAddr],
    }]);

    const discovered = new Set<string>();
    for (const log of logs || []) {
      const addr = (log.address || "").toLowerCase();
      if (addr && !knownSet.has(addr)) discovered.add(addr);
    }
    return Array.from(discovered).slice(0, 50);
  } catch {
    return []; // RPC log query failed (limit exceeded) — not critical
  }
}

// ─── Batch-check balances via Multicall3 ─────────────────────
async function batchBalances(
  provider: ethers.JsonRpcProvider,
  wallet: string,
  tokenAddresses: string[],
): Promise<Map<string, bigint>> {
  const balanceCalldata = ERC20_IFACE.encodeFunctionData("balanceOf", [wallet]);
  const calls = tokenAddresses.map((addr) => ({
    target: addr,
    allowFailure: true,
    callData: balanceCalldata,
  }));

  const mc = new ethers.Contract(MULTICALL3, MULTICALL3_ABI, provider);
  const results: Map<string, bigint> = new Map();

  // Process in chunks of 80 to avoid RPC size limits
  for (let i = 0; i < calls.length; i += 80) {
    const chunk = calls.slice(i, i + 80);
    const returnData: { success: boolean; returnData: string }[] = await mc.aggregate3(chunk);

    for (let j = 0; j < returnData.length; j++) {
      const { success, returnData: data } = returnData[j];
      if (success && data && data !== "0x") {
        try {
          const balance = BigInt(data);
          if (balance > 0n) {
            results.set(tokenAddresses[i + j].toLowerCase(), balance);
          }
        } catch { /* bad data */ }
      }
    }
  }
  return results;
}

// ─── Fetch token metadata (name, symbol, decimals) ──────────
async function fetchTokenMeta(
  provider: ethers.JsonRpcProvider,
  addr: string,
  fallbackSymbol?: string,
  fallbackDecimals?: number,
): Promise<{ name: string; symbol: string; decimals: number }> {
  const calls = [
    { target: addr, allowFailure: true, callData: ERC20_IFACE.encodeFunctionData("name", []) },
    { target: addr, allowFailure: true, callData: ERC20_IFACE.encodeFunctionData("symbol", []) },
    { target: addr, allowFailure: true, callData: ERC20_IFACE.encodeFunctionData("decimals", []) },
  ];
  const mc = new ethers.Contract(MULTICALL3, MULTICALL3_ABI, provider);
  const res: { success: boolean; returnData: string }[] = await mc.aggregate3(calls);

  let name = fallbackSymbol || "Unknown";
  let symbol = fallbackSymbol || "???";
  let decimals = fallbackDecimals ?? 18;

  if (res[0].success && res[0].returnData !== "0x") {
    try { name = ERC20_IFACE.decodeFunctionResult("name", res[0].returnData)[0]; } catch {}
  }
  if (res[1].success && res[1].returnData !== "0x") {
    try { symbol = ERC20_IFACE.decodeFunctionResult("symbol", res[1].returnData)[0]; } catch {}
  }
  if (res[2].success && res[2].returnData !== "0x") {
    try { decimals = Number(ERC20_IFACE.decodeFunctionResult("decimals", res[2].returnData)[0]); } catch {}
  }
  return { name, symbol, decimals };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get("address");

  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  try {
    const provider = new ethers.JsonRpcProvider(BSC_RPC);

    // 1. BNB balance
    const bnbBalance = await provider.getBalance(walletAddress);

    // 2. Build the set of token addresses to check
    const knownSet = new Set(KNOWN_TOKENS.map((t) => t.address.toLowerCase()));
    const knownMap = new Map(KNOWN_TOKENS.map((t) => [t.address.toLowerCase(), t]));

    // 3. Discover additional tokens from recent Transfer logs
    const extraAddresses = await discoverTokensFromLogs(provider, walletAddress, knownSet);

    // 4. Combine all addresses and batch-check balances via Multicall3
    const allAddresses = [...KNOWN_TOKENS.map((t) => t.address), ...extraAddresses];
    const balances = await batchBalances(provider, walletAddress, allAddresses);

    // 5. Build token list from non-zero balances
    const tokens: { address: string; symbol: string; name: string; balance: string; decimals: number; isKnownSafe: boolean }[] = [];

    for (const [addr, rawBalance] of balances) {
      const known = knownMap.get(addr);
      if (known) {
        const meta = await fetchTokenMeta(provider, addr, known.symbol, known.decimals);
        tokens.push({
          address: addr,
          symbol: meta.symbol,
          name: meta.name,
          balance: ethers.formatUnits(rawBalance, meta.decimals),
          decimals: meta.decimals,
          isKnownSafe: true,
        });
      } else {
        // Discovered via logs — fetch metadata
        const meta = await fetchTokenMeta(provider, addr);
        tokens.push({
          address: addr,
          symbol: meta.symbol,
          name: meta.name,
          balance: ethers.formatUnits(rawBalance, meta.decimals),
          decimals: meta.decimals,
          isKnownSafe: false,
        });
      }
    }

    // Sort: highest balance first (by raw string length as proxy, then alpha)
    tokens.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));

    return NextResponse.json({
      address: walletAddress,
      bnbBalance: ethers.formatEther(bnbBalance),
      tokens,
      tokenCount: tokens.length,
      scannedAt: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Wallet scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
