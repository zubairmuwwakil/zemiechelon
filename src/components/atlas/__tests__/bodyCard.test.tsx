// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadBodies } from "@/lib/atlas/bodies";
import { BodyCard } from "../BodyCard";

afterEach(() => {
  cleanup();
});

const bodies = loadBodies();
const byId = (id: string) => bodies.find((b) => b.id === id)!;

describe("BodyCard", () => {
  it("shows the label, blurb and github link", () => {
    render(<BodyCard body={byId("MoneyTalks")} onClose={() => {}} />);
    expect(screen.getByText("Inunity")).toBeTruthy();
    expect(screen.getByRole("link", { name: /github/i }).getAttribute("href"))
      .toBe("https://github.com/zubairmuwwakil/MoneyTalks");
  });

  it("lists satellites for a system", () => {
    render(<BodyCard body={byId("MoneyTalks")} onClose={() => {}} />);
    expect(screen.getByText("Apple Pay capture")).toBeTruthy();
    expect(screen.getByText("Compliance engines")).toBeTruthy();
  });

  it("shows no satellite list for a plain star", () => {
    render(<BodyCard body={byId("Coin_Flipper")} onClose={() => {}} />);
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("shows when the body was created and last touched", () => {
    render(<BodyCard body={byId("marketdata")} onClose={() => {}} />);
    expect(screen.getByText(/2026-01-03/)).toBeTruthy();
    expect(screen.getByText(/2026-08-19/)).toBeTruthy();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<BodyCard body={byId("PickMe")} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on backdrop click", async () => {
    const onClose = vi.fn();
    render(<BodyCard body={byId("PickMe")} onClose={onClose} />);
    const backdrop = screen.getByTestId("body-card-backdrop");
    await userEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("does not close when clicking inside the card content", async () => {
    const onClose = vi.fn();
    render(<BodyCard body={byId("PickMe")} onClose={onClose} />);
    await userEvent.click(screen.getByText("PickMe"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders a disabled console affordance when consoleId is set", () => {
    render(<BodyCard body={byId("PickMe")} onClose={() => {}} />);
    const consoleBtn = screen.getByRole("button", { name: /console/i }) as HTMLButtonElement;
    expect(consoleBtn).toBeTruthy();
    expect(consoleBtn.disabled).toBe(true);
  });

  it("manages focus on open and restore on close", () => {
    const invokingButton = document.createElement("button");
    document.body.appendChild(invokingButton);
    invokingButton.focus();
    expect(document.activeElement).toBe(invokingButton);

    const { unmount } = render(<BodyCard body={byId("PickMe")} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(document.activeElement).toBe(dialog);

    unmount();
    expect(document.activeElement).toBe(invokingButton);
    document.body.removeChild(invokingButton);
  });
});
