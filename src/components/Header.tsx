import Link from "next/link";
import { ArrowUpRight, Shield, Sparkles } from "lucide-react";
import { ZemiMark } from "./icons/ZemiMark";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[#08080a]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex size-9 items-center justify-center rounded-xl bg-zinc-950 border border-white/[0.1] p-1 transition-all group-hover:border-emerald-500/50">
            <ZemiMark className="size-full" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-white group-hover:text-white/90">
              ZEMI ECHELON
            </span>
            <span className="text-[10px] font-mono tracking-wider text-zinc-400">
              VENTURES &amp; LABS
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-400">
          <a href="#fintech" className="transition-colors hover:text-white">
            Fintech Suite
          </a>
          <a href="#intelligence" className="transition-colors hover:text-white">
            Autonomous Systems
          </a>
          <a href="#sports" className="transition-colors hover:text-white">
            Sports Platforms
          </a>
          <a href="#principles" className="transition-colors hover:text-white">
            Engineering Tenets
          </a>
          <a href="#founder" className="transition-colors hover:text-white">
            Founder
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/zubairmuwwakil"
            target="_blank"
            rel="noreferrer"
            className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-400 transition-colors hover:border-white/20 hover:text-white"
            aria-label="GitHub Profile"
          >
            <svg className="size-4 fill-current" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>
          <a
            href="https://inunity.ca"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-black shadow-xs transition-all hover:bg-zinc-200"
          >
            <span>Inunity Hub</span>
            <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </div>
    </header>
  );
}
