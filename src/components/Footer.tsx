import Image from "next/image";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#050507] py-12 text-xs text-zinc-400">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex size-7 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.1] p-1">
              <Image src="/icon.svg" alt="Zemi Echelon" width={28} height={28} className="size-full object-contain" />
            </div>
            <div>
              <span className="font-bold text-white tracking-tight">ZEMI ECHELON</span>
              <span className="text-zinc-400 font-mono ml-2">© {new Date().getFullYear()}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <a
              href="https://inunity.ca"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              Inunity (inunity.ca)
            </a>
            <a
              href="https://zubairmuwwakil.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              zubairmuwwakil.com
            </a>
            <a
              href="https://github.com/zubairmuwwakil"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub Organization
            </a>
            <a
              href="mailto:zmuwwakil1@gmail.com"
              className="hover:text-white transition-colors"
            >
              Legal &amp; Inquiries
            </a>
          </div>
        </div>

        <div className="border-t border-white/[0.04] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-400">
          <p>
            Privacy by construction. Deterministic engineering. Zero unauthorized credential storage.
          </p>
          <p className="font-mono text-zinc-400">
            PIPEDA &amp; Law 25 Compliant Architecture
          </p>
        </div>
      </div>
    </footer>
  );
}
