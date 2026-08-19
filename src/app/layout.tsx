import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zemí Echelon — Atlas of Technology Holdings",
  description:
    "A navigable celestial atlas of 45 repositories in five arms: technology ventures, native iOS copilots, autonomous AI runtimes, and high-concurrency systems engineered by Zubair Muwwakil.",
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
      <body className="h-screen w-screen overflow-hidden bg-[#f7f6f2] text-zinc-900 antialiased selection:bg-zinc-900 selection:text-white">
        {children}
      </body>
    </html>
  );
}
