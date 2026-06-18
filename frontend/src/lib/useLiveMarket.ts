"use client";

import { useState, useEffect, useCallback } from "react";

interface MarketData {
  bnbPriceCoinGecko: number;
  priceChange24h: number;
  volume24h: number;
  bscTvl: number;
  oracleStatus: "consistent" | "warning" | "critical";
  isLoading: boolean;
}

const INITIAL: MarketData = {
  bnbPriceCoinGecko: 0,
  priceChange24h: 0,
  volume24h: 0,
  bscTvl: 0,
  oracleStatus: "consistent",
  isLoading: true,
};

export function useLiveMarketData(intervalMs = 30000): MarketData {
  const [data, setData] = useState<MarketData>(INITIAL);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true",
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) return;
      const json = await res.json();
      const bnb = json.binancecoin;
      setData((prev) => ({
        ...prev,
        bnbPriceCoinGecko: bnb?.usd ?? prev.bnbPriceCoinGecko,
        priceChange24h: bnb?.usd_24h_change ?? prev.priceChange24h,
        volume24h: bnb?.usd_24h_vol ?? prev.volume24h,
        bscTvl: prev.bscTvl || 5_200_000_000,
        oracleStatus: "consistent",
        isLoading: false,
      }));
    } catch {
      setData((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, intervalMs);
    return () => clearInterval(id);
  }, [fetchData, intervalMs]);

  return data;
}
