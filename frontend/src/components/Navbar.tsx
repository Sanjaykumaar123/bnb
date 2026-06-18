"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useWalletContext } from "../lib/WalletContext";
import { usePublicContractData } from "../lib/useContracts";
import {
  Wallet, Search, Menu, X, Eye, Lock, BarChart3,
} from "lucide-react";
import { useState, useEffect } from "react";

const NAV_LINKS = [
  { href: "/scanner", label: "Scanner", icon: Search },
  { href: "/guardian", label: "Guardian Shield", icon: Eye },
  { href: "/vault", label: "Vault", icon: Lock },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export default function Navbar() {
  const pathname = usePathname();
  const { address, isConnected, connect, disconnect, isConnecting, switchToBsc, chainId } = useWalletContext();
  const publicData = usePublicContractData();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const dataSource = isConnected ? "wallet" : publicData.isLive ? "public-rpc" : "demo";

  return (
    <nav className="sticky top-0 z-50 border-b backdrop-blur-xl" style={{ borderColor: "var(--border-subtle)", background: "rgba(9,9,11,0.85)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Image src="/logo.png" alt="Aegis Protocol" width={36} height={36} className="h-8 w-8 object-contain" priority />
            <div className="leading-tight">
              <span className="text-base font-semibold tracking-tight text-white">Aegis</span>
              <span className="text-base font-light tracking-tight text-white ml-0.5">Protocol</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1 ml-8">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-link flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                    isActive ? "nav-link-active" : ""
                  }`}
                >
                  <link.icon className="w-3.5 h-3.5" />
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2.5">
            {/* Data source */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium" style={{
              background: dataSource === "wallet" ? "rgba(52,211,153,0.08)" : dataSource === "public-rpc" ? "var(--accent-muted)" : "rgba(251,191,36,0.08)",
              color: dataSource === "wallet" ? "var(--green)" : dataSource === "public-rpc" ? "var(--accent)" : "var(--yellow)",
            }}>
              <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{
                background: dataSource === "wallet" ? "var(--green)" : dataSource === "public-rpc" ? "var(--accent)" : "var(--yellow)",
              }} />
              {dataSource === "wallet" ? "Live" : dataSource === "public-rpc" ? "Read-Only" : "Demo"}
            </div>

            {/* Wallet */}
            {isConnected ? (
              <div className="flex items-center gap-2">
                {chainId !== 97 && (
                  <button onClick={switchToBsc} className="text-[11px] font-medium px-2 py-1 rounded-md" style={{ color: "var(--yellow)", background: "rgba(251,191,36,0.08)" }}>
                    Switch to BSC
                  </button>
                )}
                <span className="text-[11px] font-mono px-2.5 py-1.5 rounded-lg" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
                <button onClick={disconnect} className="text-[11px] transition-colors hover:text-white" style={{ color: "var(--text-muted)" }}>
                  Disconnect
                </button>
              </div>
            ) : (
              <button onClick={connect} disabled={isConnecting} className="btn-primary flex items-center gap-1.5 text-xs !px-4 !py-2">
                <Wallet className="w-3.5 h-3.5" />
                {isConnecting ? "Connecting..." : "Connect"}
              </button>
            )}

            {/* Mobile menu toggle */}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-1.5 rounded-md" style={{ color: "var(--text-muted)" }}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden border-t px-4 pb-4 pt-2" style={{ borderColor: "var(--border-subtle)", background: "rgba(9,9,11,0.95)" }}>
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? "nav-link-active" : ""
                  }`}
                  style={!isActive ? { color: "var(--text-muted)" } : undefined}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
