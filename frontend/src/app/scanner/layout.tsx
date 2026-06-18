import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Token Scanner — Instant Rug Pull Detection | Aegis Protocol",
  description:
    "Scan any BNB Chain token instantly. Detect honeypots, hidden mints, liquidity locks, ownership renouncement, and smart contract risks before you buy.",
  openGraph: {
    title: "Token Scanner — Instant Rug Pull Detection | Aegis Protocol",
    description:
      "Scan any BSC token for honeypots, hidden owners, and contract risks. Free and instant.",
    url: "https://aegisguardian.xyz/scanner",
  },
};

export default function ScannerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
