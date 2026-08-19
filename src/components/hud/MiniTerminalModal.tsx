"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { sound } from "@/lib/audio";

interface MiniTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandOutput {
  id: string;
  command: string;
  response: string;
  isError?: boolean;
}

export function MiniTerminalModal({ isOpen, onClose }: MiniTerminalModalProps) {
  const [inputVal, setInputVal] = useState("");
  const [history, setHistory] = useState<CommandOutput[]>([
    {
      id: "welcome",
      command: "init",
      response:
        "ZEMI ECHELON OS [v2.6.4-prod]\nType 'help' to inspect available system commands.",
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  if (!isOpen) return null;

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = inputVal.trim().toLowerCase();
    if (!cmd) return;

    sound.playTerminalKey();
    setInputVal("");

    if (cmd === "clear") {
      setHistory([]);
      return;
    }

    let res = "";
    let isErr = false;

    switch (cmd) {
      case "help":
        res = `AVAILABLE COMMANDS:
  • bio         - Founder & Principal Architect summary
  • inunity     - Zero-bank-login personal finance engine
  • pickme      - Native Swift 6 credit card copilot
  • marketlens  - Enterprise Java 21 market data pipeline
  • skills      - Core programming languages & infrastructure
  • contact     - Official email, LinkedIn & portfolio links
  • date        - Current system timestamp
  • clear       - Wipe terminal output`;
        break;
      case "bio":
        res = `Zubair Muwwakil — Founder & Principal Architect
Location: Brooklyn, NY / Toronto, ON
Domain: Full-Stack, High-Concurrency Systems, Autonomous AI Runtimes, iOS Swift.`;
        break;
      case "inunity":
        res = `INUNITY (inunity.ca):
- Zero-Bank-Login Apple Pay capture via iOS Wallet Shortcuts
- Multi-currency ledger (CAD/USD/JMD) & forward cashflow forecasting
- 24 statutory tax compliance engines (FBAR, T1135, RDSP, FHSA).`;
        break;
      case "pickme":
        res = `PICKME — CANADIAN CARD COPILOT:
- 100% offline native iOS 18 app (Swift 6 / SwiftUI / SwiftData)
- Point-of-sale earn optimizer & merchant category geofencing.`;
        break;
      case "marketlens":
        res = `MARKETLENS:
- High-resilience market pipeline (Java 21 · Spring Boot 4 · Postgres 16)
- Idempotent runs, row-level quarantine & BYOK routing.`;
        break;
      case "skills":
        res = `SYSTEM CAPABILITIES:
Languages: Java 21, TypeScript, Swift 6, SQL, Python, Go
Frameworks: Spring Boot, Next.js 16, React 19, SwiftUI, Prisma, Tailwind
Infrastructure: PostgreSQL, Neon, Vercel, Docker, Flyway, Prometheus.`;
        break;
      case "contact":
        res = `CONTACT DIRECTORY:
• Portfolio: https://zubairmuwwakil.com
• GitHub:    https://github.com/zubairmuwwakil
• LinkedIn:  https://linkedin.com/in/zubairmuwwakil
• Email:     zmuwwakil1@gmail.com`;
        break;
      case "date":
        res = new Date().toUTCString();
        break;
      default:
        res = `Command not recognized: '${cmd}'. Type 'help' for valid commands.`;
        isErr = true;
    }

    setHistory((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        command: cmd,
        response: res,
        isError: isErr,
      },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex h-[480px] w-full max-w-2xl flex-col rounded-2xl border border-zinc-700 bg-[#0d1117] p-4 text-emerald-400 font-mono shadow-2xl">
        {/* Terminal Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-3 rounded-full bg-red-500/80" />
            <div className="flex size-3 rounded-full bg-yellow-500/80" />
            <div className="flex size-3 rounded-full bg-green-500/80" />
            <span className="ml-2 text-xs text-zinc-400">
              command-quest@zemi-echelon: ~
            </span>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Terminal Body */}
        <div className="flex-1 overflow-y-auto py-3 text-xs leading-relaxed space-y-3 select-text">
          {history.map((h) => (
            <div key={h.id} className="space-y-1">
              <div className="flex items-center gap-2 text-zinc-300">
                <span className="text-emerald-400">guest@zemi:~$</span>
                <span>{h.command}</span>
              </div>
              <pre
                className={`whitespace-pre-wrap font-mono ${
                  h.isError ? "text-amber-400" : "text-emerald-400/90"
                }`}
              >
                {h.response}
              </pre>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Terminal Input */}
        <form
          onSubmit={handleCommand}
          className="flex items-center gap-2 border-t border-zinc-800 pt-3"
        >
          <span className="text-xs text-emerald-400">guest@zemi:~$</span>
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => {
              setInputVal(e.target.value);
              sound.playTerminalKey();
            }}
            placeholder="type 'help', 'bio', 'inunity', 'skills'..."
            className="flex-1 bg-transparent text-xs text-emerald-200 outline-none placeholder:text-zinc-600"
          />
        </form>
      </div>
    </div>
  );
}
