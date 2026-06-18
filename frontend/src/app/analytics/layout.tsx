import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics Dashboard — Token Scan Statistics | Aegis Protocol",
  description:
    "Explore aggregated token scan analytics. View risk trends, most-scanned tokens, honeypot detection rates, and community scanning activity on BNB Chain.",
  openGraph: {
    title: "Analytics Dashboard | Aegis Protocol",
    description:
      "Live analytics from thousands of token scans on BNB Chain.",
    url: "https://aegisguardian.xyz/analytics",
  },
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
