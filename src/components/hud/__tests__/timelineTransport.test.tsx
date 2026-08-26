// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadBodies } from "@/lib/atlas/bodies";
import { deriveDaySpan, deriveTimelineMilestones } from "@/lib/atlas/derivedFigures";
import { dateAtDay } from "@/lib/atlas/timeline";
import { SOLAR_SYSTEM_ZEMI } from "@/lib/atlas/scopes";
import { TimelineTransport } from "../TimelineTransport";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

const bodies = loadBodies();
const daySpan = deriveDaySpan(bodies);
const milestones = deriveTimelineMilestones(bodies);

describe("TimelineTransport", () => {
  it("exposes play, scrub and speed as keyboard-operable controls with accessible names", () => {
    stubReducedMotion(false);
    render(<TimelineTransport bodies={bodies} cosmicMode="day" onClockDayChange={vi.fn()} />);

    expect(screen.getByRole("slider", { name: /timeline/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /play/i })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: /speed/i })).toBeTruthy();
  });

  it("defaults the clock to the full span, so the map starts fully built", () => {
    stubReducedMotion(false);
    render(<TimelineTransport bodies={bodies} cosmicMode="day" onClockDayChange={vi.fn()} />);

    const slider = screen.getByRole("slider", { name: /timeline/i }) as HTMLInputElement;
    expect(Number(slider.max)).toBe(daySpan);
    expect(Number(slider.value)).toBe(daySpan);
  });

  it("reports every scrub to the caller, and shows the derived repository count", () => {
    stubReducedMotion(false);
    const onClockDayChange = vi.fn();
    render(<TimelineTransport bodies={bodies} cosmicMode="day" onClockDayChange={onClockDayChange} />);

    const slider = screen.getByRole("slider", { name: /timeline/i });
    fireEvent.change(slider, { target: { value: "0" } });

    expect(onClockDayChange).toHaveBeenCalledWith(dateAtDay(0, SOLAR_SYSTEM_ZEMI.epoch));
    const dayZeroCount = bodies.filter((b) => b.bornAt === bodies
      .map((x) => x.bornAt)
      .sort()[0]).length;
    // At day zero only the epoch's own bodies exist — the count on screen is derived, never typed.
    expect(screen.getByTestId("timeline-visible-count").textContent).toBe(String(dayZeroCount));
  });

  it("names each milestone from the body's own editorial caption, never a typed date", () => {
    stubReducedMotion(false);
    render(<TimelineTransport bodies={bodies} cosmicMode="day" onClockDayChange={vi.fn()} />);
    for (const milestone of milestones) {
      expect(screen.getByTitle(new RegExp(milestone.title))).toBeTruthy();
    }
  });

  it("toggles to a pause control once play starts", async () => {
    stubReducedMotion(false);
    render(<TimelineTransport bodies={bodies} cosmicMode="day" onClockDayChange={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /play/i }));
    expect(screen.getByRole("button", { name: /pause/i })).toBeTruthy();
  });

  it("under reduced motion, play jumps straight to the end instead of animating", async () => {
    stubReducedMotion(true);
    const onClockDayChange = vi.fn();
    render(<TimelineTransport bodies={bodies} cosmicMode="day" onClockDayChange={onClockDayChange} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /play/i }));

    expect(onClockDayChange).toHaveBeenCalledWith(dateAtDay(daySpan, SOLAR_SYSTEM_ZEMI.epoch));
    // Never enters a playing state — there is nothing to pause.
    expect(screen.queryByRole("button", { name: /pause/i })).toBeNull();
  });

  it("still allows scrubbing under reduced motion", () => {
    stubReducedMotion(true);
    const onClockDayChange = vi.fn();
    render(<TimelineTransport bodies={bodies} cosmicMode="day" onClockDayChange={onClockDayChange} />);

    const slider = screen.getByRole("slider", { name: /timeline/i });
    fireEvent.change(slider, { target: { value: "0" } });
    expect(onClockDayChange).toHaveBeenCalledWith(dateAtDay(0, SOLAR_SYSTEM_ZEMI.epoch));
  });
});
