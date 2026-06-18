import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics Dashboard — Token Scan Statistics | JarvisBNB",
  description:
    "Explore aggregated token scan analytics on JarvisBNB. View risk trends, most-scanned tokens, honeypot detection rates, and community scanning activity on BNB Chain.",
  openGraph: {
    title: "Analytics Dashboard | JarvisBNB",
    description:
      "Live analytics from thousands of token scans on BNB Chain.",
    url: "https://jarvisbnb.xyz/analytics",
  },
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
