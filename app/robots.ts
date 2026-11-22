import type { MetadataRoute } from "next";

function resolveBaseUrl(): string {
  const raw = process.env.APP_URL?.trim();
  if (raw && /^https?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, "");
  }
  return "https://nuesalibrary.fuoye.edu.ng";
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = resolveBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/resources", "/resources/"],
        disallow: [
          "/api/",
          "/moderation",
          "/profile",
          "/upload",
          "/saved",
          "/login",
          "/signup",
          "/forgot-password",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
