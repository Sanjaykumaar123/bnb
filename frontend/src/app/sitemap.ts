import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://aegisguardian.xyz";
  return [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/scanner`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/guardian`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/vault`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/analytics`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/whitepaper`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  ];
}
