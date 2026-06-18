import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientLayout from "../components/ClientLayout";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://jarvisbnb.xyz"),
  title: "JarvisBNB — Autonomous AI Portfolio Guardian & Trading Intelligence on BNB Chain",
  description:
    "JarvisBNB is an autonomous AI portfolio guardian and trading intelligence engine on BNB Chain. Monitor wallets 24/7, scan tokens for rug pulls, and earn protected Venus yield — all powered by multi-agent AI reasoning.",
  keywords: ["JarvisBNB", "DeFi", "AI Agent", "BNB Chain", "PancakeSwap", "DeFi Guardian", "Autonomous Agent", "Smart Contract", "Risk Management", "Portfolio Analytics"],
  authors: [{ name: "Uniq Minds" }],
  openGraph: {
    title: "JarvisBNB — Autonomous AI Portfolio Guardian on BNB Chain",
    description: "JarvisBNB: Autonomous AI portfolio guardian & trading intelligence on BNB Chain. LLM reasoning + PancakeSwap DEX verification + on-chain execution.",
    url: "https://jarvisbnb.xyz",
    siteName: "JarvisBNB",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "JarvisBNB — Autonomous AI Portfolio Guardian" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "JarvisBNB — Autonomous AI Portfolio Guardian on BNB Chain",
    description: "JarvisBNB: Autonomous AI guardian protecting your DeFi portfolio on BNB Chain 24/7. $UNIQ token utility. Multi-agent LLM reasoning + PancakeSwap verification.",
    images: ["/og-image.svg"],
  },
  icons: {
    icon: "/favicon.svg",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <head>
        <meta name="theme-color" content="#0a0e17" />
      </head>
      <body className={`${inter.className} bg-[#0a0e17] text-white antialiased min-h-screen`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
