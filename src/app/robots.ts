import type { MetadataRoute } from "next";

// Required for Next.js static export (GitHub Pages).
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://zemiechelon.com/sitemap.xml",
  };
}
