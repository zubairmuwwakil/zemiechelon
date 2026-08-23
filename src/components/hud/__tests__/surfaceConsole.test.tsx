// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SurfaceConsolePanel } from "../SurfaceConsolePanel";

describe("switching the console on", () => {
  it("shows nothing until something is switched on", () => {
    const { container } = render(
      <SurfaceConsolePanel consoleId={null} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the engine's own console, not a mockup of one", () => {
    render(<SurfaceConsolePanel consoleId="pickme" onClose={vi.fn()} />);
    // PickMeConsole seeds itself from the engine's fixture cases (§3.7), so a
    // scenario control on screen means the real thing mounted.
    expect(screen.getByRole("dialog", { name: "Console" })).toBeInTheDocument();
    expect(screen.getByLabelText(/switch off the console/i)).toBeInTheDocument();
  });

  it("ignores a console with no engine behind it", () => {
    const { container } = render(
      <SurfaceConsolePanel consoleId="inunity" onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("moves focus to the panel, so a keyboard visitor is inside it", () => {
    render(<SurfaceConsolePanel consoleId="pickme" onClose={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByLabelText(/switch off the console/i));
  });

  it("switches off on Escape", async () => {
    const onClose = vi.fn();
    render(<SurfaceConsolePanel consoleId="pickme" onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("switches off from its own control", async () => {
    const onClose = vi.fn();
    render(<SurfaceConsolePanel consoleId="pickme" onClose={onClose} />);
    await userEvent.click(screen.getByLabelText(/switch off the console/i));
    expect(onClose).toHaveBeenCalled();
  });
});
