import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Code2,
  HeartHandshake,
  Smartphone,
} from "lucide-react";
import { ZemiMark } from "@/components/icons/ZemiMark";

const SITE = "https://zemiechelon.com";

export const metadata: Metadata = {
  title: "About Zemi Echelon | Software Products & Founder",
  description:
    "Meet Zemi Echelon, the software business founded by Zubair Muwwakil. Explore PB Social, Inunity, PickMe, and its engineering work.",
  alternates: { canonical: "/about/" },
  openGraph: {
    title: "About Zemi Echelon | Software Products & Founder",
    description:
      "Meet Zemi Echelon, its software products, and founder Zubair Muwwakil.",
    url: "/about/",
    siteName: "Zemi Echelon",
    type: "website",
  },
};

const products = [
  {
    name: "PB Social",
    otherName: "The Pickleball Social",
    category: "Sports operations software",
    status: "Product",
    description:
      "Registration, scheduling, match operations, and tools for running organized pickleball programs. Built around the needs of real players and organizers.",
    href: "https://pbsocial.ca",
    linkText: "Visit PB Social",
    icon: Building2,
  },
  {
    name: "Inunity",
    otherName: "Financial organization platform",
    category: "Personal finance software",
    status: "Product",
    description:
      "Tools for organizing financial records and transactions, with a focus on clearer information and practical financial decisions.",
    href: "https://inunity.ca",
    linkText: "Explore Inunity",
    icon: Code2,
  },
  {
    name: "PickMe",
    otherName: "Offline iOS card copilot",
    category: "Native iOS engineering",
    status: "In development",
    description:
      "A privacy-first, on-device iOS project designed to compare credit card rewards at checkout. The project is not yet available as a public App Store release.",
    href: "https://github.com/zubairmuwwakil/PickMe",
    linkText: "View the development repository",
    icon: Smartphone,
  },
] as const;

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE}/#organization`,
  name: "Zemi Echelon",
  url: `${SITE}/`,
  description:
    "A software business connecting products for sports operations, financial organization, and software engineering.",
  founder: {
    "@type": "Person",
    "@id": "https://zubairmuwwakil.com/#person",
    name: "Zubair Muwwakil",
    url: "https://zubairmuwwakil.com/",
  },
};

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-zinc-950"
      >
        Skip to company information
      </a>
      <div className="min-h-screen bg-[#f7f6f2] text-[#1b1a17]">
        <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-[#f7f6f2]/95 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <Link href="/" className="flex min-w-0 items-center gap-3 font-semibold tracking-tight" aria-label="Zemi Echelon home">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 p-2 text-white">
                <ZemiMark className="size-full" />
              </span>
              <span className="text-sm sm:text-base">ZEMI ECHELON</span>
            </Link>
            <nav aria-label="Company navigation" className="flex shrink-0 items-center gap-3 sm:gap-6 text-sm font-medium">
              <a href="#products" className="hidden text-zinc-700 hover:text-zinc-950 sm:inline">Products</a>
              <a href="#founder" className="hidden text-zinc-700 hover:text-zinc-950 sm:inline">Founder</a>
              <Link href="/" className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold transition-colors hover:bg-zinc-100 sm:text-sm">
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                <span>Atlas</span>
              </Link>
            </nav>
          </div>
        </header>

        <main id="main">
          <section aria-labelledby="company-title" className="mx-auto max-w-6xl px-5 pt-12 pb-14 sm:px-8 sm:pt-20 sm:pb-20">
            <div className="relative overflow-hidden rounded-[2rem] bg-zinc-950 px-7 py-12 text-[#f7f6f2] sm:px-12 sm:py-16">
              <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full border border-amber-400/20 bg-amber-400/5 blur-3xl" />
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 right-20 size-72 rounded-full border border-white/10" />
              <div className="relative max-w-3xl">
                <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
                  Software ventures · Systems engineering
                </p>
                <h1 id="company-title" className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
                  Software with a job to do.
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-300 sm:text-lg">
                  Zemi Echelon is a software business founded by Zubair Muwwakil.
                  It connects independently branded products with the engineering
                  work behind them. We build tools for real workflows, from sports
                  programs to personal finance.
                </p>
                <div className="mt-9 flex flex-wrap gap-3">
                  <a href="#products" className="inline-flex items-center gap-2 rounded-full bg-[#f7f6f2] px-5 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-100">
                    Explore the products <ArrowRight className="size-4" aria-hidden="true" />
                  </a>
                  <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                    Open the interactive atlas <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
            <p className="mt-7 max-w-3xl text-sm leading-7 text-zinc-600">
              The atlas is an interactive map of the larger technical portfolio.
              This page is the plain-language guide to the company, its products,
              and the person behind them.
            </p>
          </section>

          <section id="products" aria-labelledby="products-title" className="border-t border-zinc-200 bg-white/50 py-16 scroll-mt-24">
            <div className="mx-auto max-w-6xl px-5 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">01 / Products</p>
              <h2 id="products-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Independent products. Shared engineering standards.</h2>
              <p className="mt-4 max-w-3xl leading-7 text-zinc-600">
                Each product has its own purpose and audience. These links lead to its
                website or development repository—not to a collection of SEO-only pages.
              </p>
              <div className="mt-9 grid gap-5 md:grid-cols-3">
                {products.map((product) => {
                  const Icon = product.icon;
                  return (
                    <article key={product.name} className="flex flex-col rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex size-12 items-center justify-center rounded-2xl bg-zinc-950 text-amber-200">
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                        <span className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-semibold text-zinc-600">
                          {product.status}
                        </span>
                      </div>
                      <p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">{product.category}</p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-tight">{product.name}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{product.otherName}</p>
                      <p className="mt-5 flex-1 text-sm leading-7 text-zinc-700">{product.description}</p>
                      <a href={product.href} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex w-fit items-center gap-2 border-b border-zinc-950 pb-1 text-sm font-semibold text-zinc-950 hover:text-amber-800">
                        {product.linkText} <ArrowUpRight className="size-4" aria-hidden="true" />
                      </a>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section aria-labelledby="engineering-title" className="mx-auto grid max-w-6xl gap-8 px-5 py-20 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">02 / Engineering</p>
              <h2 id="engineering-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Built, tested, and operated.</h2>
            </div>
            <div className="space-y-6 text-base leading-8 text-zinc-700">
              <p>
                Our work spans backend APIs, data systems, web applications,
                and native iOS development. The interactive atlas shows a broader
                history of technical projects, including tools that were experiments
                rather than commercial releases.
              </p>
              <p>
                For technical details, read the project case studies and inspect
                the public repositories. Product websites are for customers;
                the engineering portfolio is for anyone who wants to understand
                how the systems were made.
              </p>
              <div className="flex flex-wrap gap-4 text-sm font-semibold">
                <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 hover:bg-white">
                  Explore the atlas <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <a href="https://zubairmuwwakil.com/projects/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 hover:bg-white">
                  Engineering case studies <ArrowUpRight className="size-4" aria-hidden="true" />
                </a>
              </div>
            </div>
          </section>

          <section id="founder" aria-labelledby="founder-title" className="border-y border-zinc-200 bg-[#efece4] py-16 scroll-mt-24">
            <div className="mx-auto grid max-w-6xl gap-8 px-5 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">03 / Founder</p>
                <h2 id="founder-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Zubair Muwwakil</h2>
                <p className="mt-3 text-sm font-medium text-zinc-600">Software engineer &amp; founder</p>
              </div>
              <div>
                <p className="text-base leading-8 text-zinc-700">
                  I started Zemi Echelon to develop software that does useful work
                  outside a demo. My background connects hands-on software engineering
                  with the day-to-day reality of operating software products and
                  community programs.
                </p>
                <div className="mt-7 flex flex-wrap gap-4 text-sm font-semibold">
                  <a href="https://zubairmuwwakil.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border-b border-zinc-950 pb-1 hover:text-amber-800">
                    Personal website <ArrowUpRight className="size-4" aria-hidden="true" />
                  </a>
                  <a href="https://www.linkedin.com/in/zubairmuwwakil/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border-b border-zinc-950 pb-1 hover:text-amber-800">
                    LinkedIn <ArrowUpRight className="size-4" aria-hidden="true" />
                  </a>
                  <a href="https://github.com/zubairmuwwakil" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border-b border-zinc-950 pb-1 hover:text-amber-800">
                    GitHub <ArrowUpRight className="size-4" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          </section>

          <aside aria-labelledby="nonprofit-title" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
            <div className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-7 sm:flex-row sm:items-start sm:gap-6 sm:p-9">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-900">
                <HeartHandshake className="size-6" aria-hidden="true" />
              </span>
              <div>
                <h2 id="nonprofit-title" className="text-xl font-semibold tracking-tight">A separate community initiative</h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-700">
                  Echelon Community Athletics Inc. is a federally incorporated Canadian nonprofit
                  also founded by Zubair Muwwakil. It is legally independent from
                  Zemi Echelon—not a subsidiary, product, or division of this business.
                </p>
              </div>
            </div>
          </aside>
        </main>

        <footer className="border-t border-zinc-200 py-8">
          <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 px-5 text-xs text-zinc-600 sm:flex-row sm:items-center sm:px-8">
            <p>© {new Date().getFullYear()} Zemi Echelon. Software products &amp; engineering.</p>
            <div className="flex flex-wrap items-center gap-5">
              <Link href="/" className="hover:text-zinc-950">Interactive atlas</Link>
              <a href="https://zubairmuwwakil.com" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-950">
                Founder
              </a>
              <a href="mailto:zmuwwakil@gmail.com" className="hover:text-zinc-950">Contact</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
