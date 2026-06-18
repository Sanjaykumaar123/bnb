import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guardian Shield — AI Wallet Monitoring | JarvisBNB",
  description:
    "Connect your wallet and let JarvisBNB's Guardian AI monitor your holdings 24/7. Get real-time risk alerts, honeypot detection, natural language policies, and Telegram notifications for your BNB Chain portfolio.",
  openGraph: {
    title: "Guardian Shield — AI Wallet Monitoring | JarvisBNB",
    description:
      "AI-powered 24/7 wallet monitoring with real-time risk alerts on BNB Chain.",
    url: "https://jarvisbnb.xyz/guardian",
  },
};

export default function GuardianLayout({ children }: { children: React.ReactNode }) {
  return children;
}
