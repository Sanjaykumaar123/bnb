import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guardian Shield — AI Wallet Monitoring | Aegis Protocol",
  description:
    "Connect your wallet and let Aegis Guardian AI monitor your holdings 24/7. Get real-time risk alerts, honeypot detection, and Telegram notifications for your BNB Chain portfolio.",
  openGraph: {
    title: "Guardian Shield — AI Wallet Monitoring | Aegis Protocol",
    description:
      "AI-powered 24/7 wallet monitoring with real-time risk alerts on BNB Chain.",
    url: "https://aegisguardian.xyz/guardian",
  },
};

export default function GuardianLayout({ children }: { children: React.ReactNode }) {
  return children;
}
