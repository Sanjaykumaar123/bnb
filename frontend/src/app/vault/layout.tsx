import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Vault — Earn Venus Yield with AI Protection | JarvisBNB",
  description:
    "Deposit BNB into the JarvisBNB Vault. Earn yield from Venus Protocol while AI agents protect your position 24/7 with automated stop-loss and emergency withdrawal.",
  openGraph: {
    title: "AI Vault — Venus Yield + AI Protection | JarvisBNB",
    description:
      "Deposit BNB, earn Venus yield, and let AI agents guard your DeFi position on BNB Chain.",
    url: "https://jarvisbnb.xyz/vault",
  },
};

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return children;
}
