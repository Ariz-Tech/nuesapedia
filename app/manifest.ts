import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The NUESA Library — Digital Faculty Library",
    short_name: "NUESA Library",
    description:
      "Access engineering course materials, lecture handouts, textbooks, past questions, and offline downloaded documents.",
    start_url: "/resources",
    scope: "/",
    display: "standalone",
    background_color: "#FAFAFA",
    theme_color: "#0C3B2E",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}

