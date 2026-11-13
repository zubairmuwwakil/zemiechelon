import type { MetadataRoute } from "next";

// Required for Next.js static export (GitHub Pages).
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://zemiechelon.com/",
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://zemiechelon.com/about/",
      changeFrequency: "monthly",
      priority: 0.9,
    },
  ];
}
