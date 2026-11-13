import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://zemiechelon.com"),
  title: "Zemi Echelon — Software Ventures & Engineering",
  description:
    "Zemi Echelon is a software business founded by Zubair Muwwakil. Explore PB Social, Inunity, PickMe, and the engineering atlas.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Zemi Echelon — Software Ventures & Engineering",
    description: "Software products and engineering systems by Zubair Muwwakil.",
    url: "/",
    siteName: "Zemi Echelon",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Zemi Echelon — Software Ventures & Engineering",
    description: "Software products and engineering systems by Zubair Muwwakil.",
  },
  icons: {
    icon: [
      { url: "/favicon-light.png", media: "(prefers-color-scheme: light)" },
      { url: "/favicon-dark.png", media: "(prefers-color-scheme: dark)" },
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen w-full bg-[#f7f6f2] text-zinc-900 antialiased selection:bg-amber-200 selection:text-zinc-950">
        {children}
      </body>
    </html>
  );
}
