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
  metadataBase: new URL("https://aegisguardian.xyz"),
  title: "Aegis Protocol — AI-Powered DeFi Guardian on BNB Chain",
  description:
    "Autonomous AI agent that monitors your DeFi positions on BNB Chain 24/7, detects risks in real-time using LLM reasoning + PancakeSwap DEX verification, and executes protective on-chain transactions.",
  keywords: ["DeFi", "AI Agent", "BNB Chain", "PancakeSwap", "DeFi Guardian", "Autonomous Agent", "Smart Contract", "Risk Management"],
  authors: [{ name: "Uniq Minds" }],
  openGraph: {
    title: "Aegis Protocol by Uniq Minds — AI-Powered DeFi Guardian",
    description: "Autonomous AI agent protecting your DeFi positions on BNB Chain 24/7. LLM reasoning + PancakeSwap DEX verification + on-chain execution.",
    url: "https://aegisguardian.xyz",
    siteName: "Aegis Protocol",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "Aegis Protocol — AI-Powered DeFi Guardian" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aegis Protocol by Uniq Minds — AI-Powered DeFi Guardian",
    description: "Autonomous AI agent protecting your DeFi positions on BNB Chain 24/7. $UNIQ token utility. LLM reasoning + PancakeSwap DEX verification.",
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
