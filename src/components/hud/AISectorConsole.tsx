"use client";

import { useState } from "react";
import { Bot, Terminal, X, Play, CheckCircle2, ChevronRight, Cpu } from "lucide-react";
import { sound } from "@/lib/audio";

interface AISectorConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTerminal: () => void;
}

export function AISectorConsole({ isOpen, onClose, onOpenTerminal }: AISectorConsoleProps) {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  if (!isOpen) return null;

  const steps = [
    { title: "Planner Agent", desc: "Decomposes user requirement into deterministic state checkpoints." },
    { title: "Coder Agent", desc: "Generates pure TypeScript arithmetic engine and rule matchers." },
    { title: "Reviewer Agent", desc: "Runs 27 fixture parity test suite across full catalog." },
    { title: "Deployment Agent", desc: "Verifies idempotency and publishes versioned release." },
  ];

  const handleRunWorkflow = () => {
    setIsRunning(true);
    setActiveStep(1);
    sound.playTerminalKey();

    const t1 = setTimeout(() => {
      setActiveStep(2);
      sound.playClick(600, 0.05);
    }, 1200);

    const t2 = setTimeout(() => {
      setActiveStep(3);
      sound.playClick(750, 0.05);
    }, 2400);

    const t3 = setTimeout(() => {
      setActiveStep(4);
      setIsRunning(false);
      sound.playChime(880, 0.3);
    }, 3600);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-3xl border border-purple-200/80 bg-white/95 p-6 sm:p-7 shadow-2xl space-y-6 text-zinc-900 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-md">
              <Bot className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-mono font-bold text-purple-800 uppercase tracking-wider">
                  AUTONOMOUS SYSTEMS
                </span>
                <span className="text-xs font-mono text-zinc-600">Multi-Agent State Machine</span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-zinc-900">
                Agent Orchestrator &amp; Labs
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Description */}
        <p className="text-xs text-zinc-600 leading-relaxed">
          <strong>Agent Orchestrator</strong> is a distributed multi-agent runtime for autonomous coding workflows, hierarchical task delegation, deterministic state machine checkpoints, and tool execution.
        </p>

        {/* Live Multi-Agent Workflow Visualizer */}
        <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="size-4 text-purple-600" />
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-purple-950">
                Simulate Autonomous Coding Workflow
              </h3>
            </div>
            <button
              onClick={handleRunWorkflow}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-purple-700 disabled:opacity-50 transition-all"
            >
              <Play className="size-3.5 fill-current" />
              <span>{isRunning ? "Executing..." : "Dispatch Task"}</span>
            </button>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {steps.map((step, idx) => {
              const isPassed = activeStep > idx + 1;
              const isCurrent = activeStep === idx + 1;

              return (
                <div
                  key={idx}
                  className={`rounded-xl border p-3 flex items-start gap-3 transition-all ${
                    isCurrent
                      ? "border-purple-500 bg-white shadow-xs"
                      : isPassed
                      ? "border-emerald-200 bg-emerald-50/40 text-emerald-950"
                      : "border-zinc-200/80 bg-white/60 text-zinc-600"
                  }`}
                >
                  <div className="mt-0.5">
                    {isPassed ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : isCurrent ? (
                      <span className="flex size-3.5 relative">
                        <span className="animate-ping absolute inline-flex size-full rounded-full bg-purple-400 opacity-75" />
                        <span className="relative inline-flex rounded-full size-3.5 bg-purple-600" />
                      </span>
                    ) : (
                      <span className="flex size-3.5 rounded-full border border-zinc-300 bg-zinc-100" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-zinc-900">{step.title}</div>
                    <div className="text-[11px] text-zinc-600 mt-0.5">{step.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CRT Terminal Integration */}
        <div className="rounded-2xl border border-zinc-200 bg-zinc-900 text-zinc-200 p-4 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Terminal className="size-4 text-emerald-400" />
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                Command Quest Retro Terminal
              </h4>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono">
              Gamified interactive CLI terminal quest environment and shell learning platform.
            </p>
          </div>
          <button
            onClick={() => {
              onClose();
              onOpenTerminal();
            }}
            className="rounded-xl bg-white px-4 py-2 text-xs font-bold font-mono text-zinc-900 hover:bg-zinc-200 transition-colors shrink-0"
          >
            Launch Terminal
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs font-mono">
          <a
            href="https://github.com/zubairmuwwakil/agent-orchestrator"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-purple-700 hover:text-purple-900 font-semibold"
          >
            <span>github.com/zubairmuwwakil/agent-orchestrator</span>
            <ChevronRight className="size-3.5" />
          </a>
          <span className="text-zinc-600">Autonomous Infrastructure</span>
        </div>
      </div>
    </div>
  );
}
