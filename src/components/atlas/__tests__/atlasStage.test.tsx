// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AtlasStage } from "../AtlasStage";

// The Field owns WebGL, which jsdom has no canvas for. Stub it and drive the
// Chart directly — this test is about wiring, not rendering.
vi.mock("../Field", () => ({
  Field: ({ onProject }: { onProject: (p: unknown[]) => void }) => {
    // Report every body as visible at a fixed point on first paint.
    return <div data-testid="field-stub" ref={() => onProject([])} />;
  },
}));

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", window.location.pathname);
});

describe("AtlasStage", () => {
  it("mounts without a WebGL context", () => {
    render(<AtlasStage />);
    expect(screen.getByTestId("field-stub")).toBeTruthy();
  });

  it("opens a card from a deep link on load", async () => {
    window.location.hash = "#/MoneyTalks";
    render(<AtlasStage />);
    await waitFor(() => expect(screen.getByText("Inunity")).toBeTruthy());
  });

  it("ignores a deep link to an anonymous body", async () => {
    window.location.hash = "#/Obsidian";
    render(<AtlasStage />);
    await waitFor(() => expect(screen.queryByText("Private repository")).toBeNull());
  });

  it("clears the hash when the card closes", async () => {
    window.location.hash = "#/PickMe";
    render(<AtlasStage />);
    await waitFor(() => expect(screen.getByText("PickMe")).toBeTruthy());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(window.location.hash).toBe(""));
  });

  it("follows a hash change after mount, so the browser's back button works", async () => {
    render(<AtlasStage />);
    window.location.hash = "#/marketdata";
    await waitFor(() => expect(screen.getByText("MarketLens")).toBeTruthy());
  });

  it("keeps a deep link open across the first render", async () => {
    window.location.hash = "#/PickMe";
    const { rerender } = render(<AtlasStage resetToken={0} />);
    await waitFor(() => expect(screen.getByText("PickMe")).toBeTruthy());
    rerender(<AtlasStage resetToken={0} />);
    expect(screen.getByText("PickMe")).toBeTruthy();
  });

  it("closes the card and clears the hash when the view is reset", async () => {
    window.location.hash = "#/PickMe";
    const { rerender } = render(<AtlasStage resetToken={0} />);
    await waitFor(() => expect(screen.getByText("PickMe")).toBeTruthy());
    rerender(<AtlasStage resetToken={1} />);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(window.location.hash).toBe("");
    });
  });
});
