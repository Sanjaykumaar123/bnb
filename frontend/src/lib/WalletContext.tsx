"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import { CHAIN_CONFIG } from "./constants";

/* eslint-disable @typescript-eslint/no-explicit-any */

const IS_MAINNET = process.env.NEXT_PUBLIC_CHAIN_ID === "56";
const TARGET_CHAIN = IS_MAINNET ? CHAIN_CONFIG.bscMainnet : CHAIN_CONFIG.bscTestnet;
const STORAGE_KEY = "aegis:wallet:connected";

interface WalletState {
  address: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
  chainId: number | null;
  isConnecting: boolean;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToBsc: () => Promise<void>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const listenersAttached = useRef(false);

  const attachListeners = useCallback((ethereum: any, onDisconnect: () => void) => {
    if (listenersAttached.current) return;
    listenersAttached.current = true;
    ethereum.on?.("accountsChanged", (accounts: string[]) => {
      if (accounts.length === 0) onDisconnect();
      else setAddress(accounts[0]);
    });
    ethereum.on?.("chainChanged", () => window.location.reload());
  }, []);

  const disconnect = useCallback(async () => {
    try {
      const ethereum = (window as any).ethereum;
      if (ethereum) {
        ethereum.removeAllListeners?.("accountsChanged");
        ethereum.removeAllListeners?.("chainChanged");
        await ethereum.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        }).catch(() => {});
      }
    } catch {}
    listenersAttached.current = false;
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setAddress(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    toast.success("Wallet disconnected");
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      toast.error("Please install MetaMask or a compatible wallet");
      return;
    }
    setIsConnecting(true);
    try {
      const ethereum = (window as any).ethereum;
      const prov = new ethers.BrowserProvider(ethereum);
      await prov.send("eth_requestAccounts", []);
      const sig = await prov.getSigner();
      const addr = await sig.getAddress();
      const network = await prov.getNetwork();
      setProvider(prov);
      setSigner(sig);
      setAddress(addr);
      setChainId(Number(network.chainId));
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
      toast.success(`Connected: ${addr.slice(0, 6)}...${addr.slice(-4)}`);
      attachListeners(ethereum, disconnect);
    } catch (error: any) {
      toast.error(error.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  }, [disconnect, attachListeners]);

  // Auto-reconnect on page load if previously connected
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;
    let wasConnected = false;
    try { wasConnected = localStorage.getItem(STORAGE_KEY) === "1"; } catch {}
    if (!wasConnected) return;

    (async () => {
      try {
        // Use eth_accounts (silent) instead of eth_requestAccounts (popup)
        const accounts: string[] = await ethereum.request({ method: "eth_accounts" });
        if (!accounts || accounts.length === 0) {
          try { localStorage.removeItem(STORAGE_KEY); } catch {}
          return;
        }
        const prov = new ethers.BrowserProvider(ethereum);
        const sig = await prov.getSigner();
        const addr = await sig.getAddress();
        const network = await prov.getNetwork();
        setProvider(prov);
        setSigner(sig);
        setAddress(addr);
        setChainId(Number(network.chainId));
        attachListeners(ethereum, disconnect);
      } catch {
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
      }
    })();
  }, [attachListeners, disconnect]);

  const switchToBsc = useCallback(async () => {
    if (!(window as any).ethereum) return;
    try {
      await (window as any).ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: TARGET_CHAIN.chainId }],
      });
    } catch (error: any) {
      if (error.code === 4902) {
        await (window as any).ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: TARGET_CHAIN.chainId,
            chainName: TARGET_CHAIN.chainName,
            nativeCurrency: TARGET_CHAIN.nativeCurrency,
            rpcUrls: TARGET_CHAIN.rpcUrls,
            blockExplorerUrls: TARGET_CHAIN.blockExplorerUrls,
          }],
        });
      }
    }
  }, []);

  return (
    <WalletContext.Provider value={{
      address, provider, signer, chainId, isConnecting,
      isConnected: !!address, connect, disconnect, switchToBsc,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWalletContext must be used within WalletProvider");
  return ctx;
}
