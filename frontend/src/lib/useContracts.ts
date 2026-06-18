"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CONTRACTS, CHAIN_CONFIG } from "./constants";
import { VAULT_ABI, REGISTRY_ABI } from "./abis";

const PUBLIC_RPC = process.env.NEXT_PUBLIC_CHAIN_ID === "56"
  ? CHAIN_CONFIG.bscMainnet.rpcUrls[0]
  : CHAIN_CONFIG.bscTestnet.rpcUrls[0];

interface PublicContractData {
  isLive: boolean;
  totalBnbDeposited: string;
  totalActionsExecuted: number;
  agentCount: number;
}

export function usePublicContractData(): PublicContractData {
  const [data, setData] = useState<PublicContractData>({
    isLive: false,
    totalBnbDeposited: "0",
    totalActionsExecuted: 0,
    agentCount: 0,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const provider = new ethers.JsonRpcProvider(PUBLIC_RPC);
        const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, provider);
        const registry = new ethers.Contract(CONTRACTS.REGISTRY, REGISTRY_ABI, provider);
        const [bnb, actions, agents] = await Promise.all([
          vault.totalBnbDeposited().catch(() => BigInt(0)),
          vault.totalActionsExecuted().catch(() => BigInt(0)),
          registry.getAgentCount().catch(() => BigInt(0)),
        ]);
        if (!cancelled) {
          setData({
            isLive: true,
            totalBnbDeposited: ethers.formatEther(bnb),
            totalActionsExecuted: Number(actions),
            agentCount: Number(agents),
          });
        }
      } catch {
        if (!cancelled) setData((d) => ({ ...d, isLive: false }));
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return data;
}
