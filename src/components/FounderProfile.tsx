import { ArrowUpRight, Code2, Globe2, Layers, Mail, MapPin, Terminal } from "lucide-react";

export function FounderProfile() {
  return (
    <section id="founder" className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
      <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#0e0e14] to-[#0a0a0e] p-8 sm:p-12 shadow-2xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-mono text-zinc-300">
              <Code2 className="size-3.5 text-cyan-400" />
              <span>FOUNDER &amp; PRINCIPAL ARCHITECT</span>
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
              Zubair Muwwakil
            </h2>

            <p className="text-sm text-zinc-300 leading-relaxed">
              Full-stack / systems software engineer building high-concurrency Java/Spring Boot pipelines, Next.js web applications, native Swift iOS systems, and autonomous agent infrastructure. Founder of Zemi Echelon and creator of the Inunity financial continuum.
            </p>

            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 pt-2 text-xs font-mono text-zinc-400">
              <div className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-zinc-300" />
                <span>Brooklyn, NY / Toronto, ON</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Layers className="size-3.5 text-zinc-300" />
                <span>Java 21 · TypeScript · Swift · Postgres</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 w-full lg:w-auto shrink-0">
            <a
              href="https://zubairmuwwakil.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-6 text-xs font-semibold text-black shadow-md transition-all hover:bg-zinc-200"
            >
              <span>Visit zubairmuwwakil.com</span>
              <ArrowUpRight className="size-4" />
            </a>
            <div className="flex items-center gap-3">
              <a
                href="https://www.linkedin.com/in/zubairmuwwakil/"
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <svg className="size-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
                <span>LinkedIn</span>
              </a>
              <a
                href="mailto:zmuwwakil1@gmail.com"
                className="flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <Mail className="size-3.5" />
                <span>Email</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
