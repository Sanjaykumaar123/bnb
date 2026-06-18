"use client";

import Link from "next/link";
import Image from "next/image";
import { CONTRACTS } from "../lib/constants";

export default function Footer() {
  return (
    <footer className="border-t mt-auto" style={{ borderColor: "var(--border-subtle)", background: "rgba(9,9,11,0.6)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <Image src="/logo.png" alt="Aegis Protocol" width={24} height={24} className="h-6 w-6 object-contain" />
              <span className="text-sm font-semibold text-white">Aegis Protocol</span>
            </div>
            <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--text-muted)" }}>
              AI-powered DeFi guardian on BNB Chain. Scan tokens, monitor wallets, and earn protected yield.
            </p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} />
              <span className="text-[10px] font-medium" style={{ color: "var(--green)" }}>Built on BNB Chain</span>
            </div>
          </div>

          {/* Products */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>Products</p>
            <div className="space-y-2">
              {[
                { href: "/scanner", label: "Token Scanner" },
                { href: "/guardian", label: "Guardian Shield" },
                { href: "/vault", label: "Protected Vault" },
                { href: "/analytics", label: "Analytics" },
              ].map((link) => (
                <Link key={link.href} href={link.href}
                  className="block text-xs transition-colors hover:text-white" style={{ color: "var(--text-muted)" }}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>Resources</p>
            <div className="space-y-2">
              {[
                { href: "/whitepaper", label: "Whitepaper", ext: false },
                { href: "https://github.com/Tonyflam/aegis-protocol", label: "GitHub", ext: true },
                { href: `https://bscscan.com/token/${CONTRACTS.UNIQ_TOKEN}`, label: "$UNIQ on BSCScan", ext: true },
                { href: `https://flap.sh/bnb/${CONTRACTS.UNIQ_TOKEN}`, label: "Buy $UNIQ", ext: true },
              ].map((link) => (
                <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                  className="block text-xs transition-colors hover:text-white" style={{ color: "var(--text-muted)" }}>
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Community */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>Community</p>
            <div className="space-y-2">
              {[
                { href: "https://x.com/uniq_minds", label: "Twitter / X" },
                { href: "https://t.me/aegis_protocol_bot", label: "Telegram Bot" },
                { href: "https://github.com/Tonyflam/aegis-protocol", label: "Contribute" },
              ].map((link) => (
                <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                  className="block text-xs transition-colors hover:text-white" style={{ color: "var(--text-muted)" }}>
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderColor: "var(--border-subtle)" }}>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            &copy; {new Date().getFullYear()} Uniq Minds. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: "rgba(240, 185, 11, 0.08)", color: "var(--bnb)" }}>
              BNB Chain Hackathon #6 of 200
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
