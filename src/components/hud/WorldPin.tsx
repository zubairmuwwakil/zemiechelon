"use client";

import { Coins, Cpu, ShieldCheck, Trophy, User } from "lucide-react";
import { SECTORS, SectorData } from "../data/ecosystem";
import { ScreenPinPosition } from "../world/types";

interface WorldPinProps {
  pins: ScreenPinPosition[];
  selectedSectorId: string | null;
  onSelectSector: (sectorId: string) => void;
}

const ICONS_MAP: Record<string, React.ElementType> = {
  Coins,
  Cpu,
  Trophy,
  ShieldCheck,
  User,
};

export function WorldPinsOverlay({
  pins,
  selectedSectorId,
  onSelectSector,
}: WorldPinProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pins.map((pin) => {
        if (!pin.visible) return null;
        const sector = SECTORS.find((s) => s.id === pin.sectorId);
        if (!sector) return null;

        const isSelected = selectedSectorId === sector.id;
        const IconComponent = ICONS_MAP[sector.icon] || Coins;

        return (
          <div
            key={sector.id}
            style={{
              transform: `translate3d(${pin.x}px, ${pin.y}px, 0) translate(-50%, -100%)`,
            }}
            className="pointer-events-auto absolute transition-transform duration-75 ease-out"
          >
            <button
              onClick={() => onSelectSector(sector.id)}
              className={`group flex items-center gap-2 rounded-full px-3 py-1.5 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 ${
                isSelected
                  ? "bg-zinc-900 text-white shadow-xl ring-2 ring-zinc-900 ring-offset-2"
                  : "border border-zinc-200/80 bg-white/90 text-zinc-800 hover:bg-white hover:shadow-xl"
              }`}
            >
              <div
                className="flex size-5 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: isSelected ? "rgba(255,255,255,0.2)" : `${sector.themeColor}15`,
                  color: isSelected ? "#ffffff" : sector.themeColor,
                }}
              >
                <IconComponent className="size-3" />
              </div>
              <span className="text-xs font-semibold tracking-tight whitespace-nowrap">
                {sector.shortName}
              </span>
              <span className="text-[10px] font-mono opacity-60">
                {sector.projects.length}
              </span>
            </button>

            {/* Pin pointer triangle */}
            <div
              className={`mx-auto size-0 border-x-4 border-x-transparent border-t-4 ${
                isSelected ? "border-t-zinc-900" : "border-t-white/90"
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}
