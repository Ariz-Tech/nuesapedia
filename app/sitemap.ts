import type { MetadataRoute } from "next";
import { getApprovedResourcesForSitemap } from "@/lib/db";

export const revalidate = 3600;

function resolveBaseUrl(): string {
  const raw = process.env.APP_URL?.trim();
  if (raw && /^https?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, "");
  }
  return "https://nuesalibrary.fuoye.edu.ng";
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = resolveBaseUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/resources`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    },
  ];

  try {
    const approved = await getApprovedResourcesForSitemap(5000);
    const resourceEntries: MetadataRoute.Sitemap = approved.map((item) => ({
      url: `${baseUrl}/resources/${encodeURIComponent(item.id)}`,
      lastModified: item.createdAt ? new Date(item.createdAt) : now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
    return [...staticEntries, ...resourceEntries];
  } catch (err) {
    console.warn("[sitemap] Falling back to static entries:", err);
    return staticEntries;
  }
}
