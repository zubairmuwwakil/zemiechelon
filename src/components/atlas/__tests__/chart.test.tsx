// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadBodies } from "@/lib/atlas/bodies";
import type { ScreenPoint } from "@/lib/atlas/types";
import { Chart } from "../Chart";

afterEach(() => {
  cleanup();
});

const bodies = loadBodies();
const allVisible: ScreenPoint[] = bodies.map((b, i) => ({
  id: b.id,
  x: (i % 8) * 100 + 50,
  y: Math.floor(i / 8) * 100 + 50,
  depth: 0.5,
  visible: true,
}));

describe("Chart", () => {
  it("renders a hit target for every labelled body and none for anonymous ones", () => {
    render(<Chart bodies={bodies} points={allVisible} cameraDistance={20} selectedId={null} onSelect={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(39);
  });

  it("never renders an anonymous body's id", () => {
    render(<Chart bodies={bodies} points={allVisible} cameraDistance={20} selectedId={null} onSelect={() => {}} />);
    for (const b of bodies.filter((x) => x.anonymous)) {
      expect(screen.queryByText(b.id), `${b.id} leaked into the DOM`).toBeNull();
    }
  });

  it("labels each hit target with the body's display name", () => {
    render(<Chart bodies={bodies} points={allVisible} cameraDistance={20} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /Inunity/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /MarketLens/ })).toBeTruthy();
  });

  it("calls onSelect with the body id when clicked", async () => {
    const onSelect = vi.fn();
    render(<Chart bodies={bodies} points={allVisible} cameraDistance={20} selectedId={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: /Inunity/ }));
    expect(onSelect).toHaveBeenCalledWith("MoneyTalks");
  });

  it("is keyboard reachable and activates on Enter", async () => {
    const onSelect = vi.fn();
    render(<Chart bodies={bodies} points={allVisible} cameraDistance={20} selectedId={null} onSelect={onSelect} />);
    await userEvent.tab();
    expect(document.activeElement?.tagName).toBe("BUTTON");
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalled();
  });

  it("omits hit targets for points that are off screen or behind the camera", () => {
    const points = allVisible.map((p, i) => (i < 10 ? { ...p, visible: false } : p));
    render(<Chart bodies={bodies} points={points} cameraDistance={20} selectedId={null} onSelect={() => {}} />);
    expect(screen.getAllByRole("button").length).toBeLessThan(39);
  });

  it("marks the selected body pressed for assistive technology", () => {
    render(<Chart bodies={bodies} points={allVisible} cameraDistance={20} selectedId="MoneyTalks" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /Inunity/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("distinguishes systems from stars for assistive technology", () => {
    render(<Chart bodies={bodies} points={allVisible} cameraDistance={20} selectedId={null} onSelect={() => {}} />);
    const inunity = screen.getByRole("button", { name: /Inunity/ });
    expect(inunity.getAttribute("aria-description") ?? inunity.getAttribute("aria-label"))
      .toMatch(/system/i);
  });

  it("labels fewer bodies when zoomed out than when zoomed in", () => {
    const far = render(
      <Chart bodies={bodies} points={allVisible} cameraDistance={300} selectedId={null} onSelect={() => {}} />
    );
    const farCount = far.container.querySelectorAll("button").length;
    far.unmount();
    const near = render(
      <Chart bodies={bodies} points={allVisible} cameraDistance={20} selectedId={null} onSelect={() => {}} />
    );
    expect(near.container.querySelectorAll("button").length).toBeGreaterThan(farCount);
  });

  it("always keeps systems labelled, even zoomed all the way out", () => {
    render(
      <Chart bodies={bodies} points={allVisible} cameraDistance={400} selectedId={null} onSelect={() => {}} />
    );
    for (const b of bodies.filter((x) => x.kind === "system")) {
      expect(screen.getByRole("button", { name: new RegExp(b.label) }), `${b.id} dropped`).toBeTruthy();
    }
  });

  it("drops the lower-magnitude label when two collide", () => {
    const collided = allVisible.map((p) => ({ ...p, x: 500, y: 500 }));
    render(
      <Chart bodies={bodies} points={collided} cameraDistance={20} selectedId={null} onSelect={() => {}} />
    );
    expect(screen.getAllByRole("button").length).toBeLessThan(5);
  });
});
