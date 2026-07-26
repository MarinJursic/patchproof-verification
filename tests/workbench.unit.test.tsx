import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Home from "../app/page";

describe("PatchProof forensic workbench", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = "light";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("switches between all three sourced evidence cases", async () => {
    const user = userEvent.setup();
    render(<Home />);

    expect(screen.getByText("Turkish case folding")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /DST fold/ }));
    expect(screen.getByText("Ambiguous local time")).toBeTruthy();
    expect(screen.getByText(/IANA tzdb 2026c/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Shortest path/ }));
    expect(screen.getByText("Disconnected graph path")).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: "provenance" }));
    expect(screen.getByText(/QuixBugs benchmark shape/)).toBeTruthy();
  });

  it("replays and steps through the six-stage evidence ledger", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: /Replay/ }));
    expect(screen.getByText("RUNNING · 0/6")).toBeTruthy();
    expect(screen.getAllByText("waiting")).toHaveLength(6);

    await user.click(screen.getByRole("button", { name: /Pause/ }));
    await user.click(screen.getByRole("button", { name: "Step →" }));
    expect(screen.getByText("COMPLETE · 1/6")).toBeTruthy();
    expect(screen.getByText(/214 \/ 214 passed/)).toBeTruthy();
  });

  it("restarts meaningfully when Continue is pressed from an initially complete run", async () => {
    const user = userEvent.setup();
    render(<Home />);

    expect(screen.getByText("COMPLETE · 6/6")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.getByText("RUNNING · 0/6")).toBeTruthy();
    expect(screen.getByText("FINAL EVIDENCE GATED")).toBeTruthy();
    expect(screen.queryByText("MINIMIZED COUNTEREXAMPLE")).toBeNull();
    expect(screen.getByRole("tab", { name: "finding" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Gated until this replay step completes")).toBeTruthy();
  });

  it("navigates the evidence ledger and copies the generated regression", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<Home />);

    await user.click(screen.getByRole("tab", { name: "test" }));
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("test_equal_folded_tr_tr_counterexample"),
    );

    await user.click(screen.getByRole("tab", { name: "scope" }));
    expect(screen.getByText("NOT ESTABLISHED")).toBeTruthy();
    expect(screen.getByText(/No correctness probability/)).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "provenance" }));
    expect(screen.getByText("Unicode 17.0.0 · seed 20260725")).toBeTruthy();
  });

  it("reports clipboard failures instead of claiming a successful copy", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("denied"));
    render(<Home />);

    await user.click(screen.getByRole("tab", { name: "test" }));
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(screen.getByRole("button", { name: "Copy failed" })).toBeTruthy();
  });

  it("persists the complete theme and exposes the trace drawer state", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: "Switch to dark theme" }));
    expect(window.localStorage.getItem("patchproof-theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    const traceToggle = screen.getByRole("button", { name: /EXECUTION TRACE/ });
    expect(traceToggle.getAttribute("aria-expanded")).toBe("true");
    await user.click(traceToggle);
    expect(traceToggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps stage selection keyboard-operable", () => {
    render(<Home />);
    const mutation = screen.getByRole("button", { name: /Mutation probe/ });
    fireEvent.keyDown(mutation, { key: "Enter" });
    fireEvent.click(mutation);
    expect(mutation.getAttribute("aria-current")).toBe("step");
    expect(screen.getAllByText("SURVIVED replace locale-aware fold with str.lower()")).toHaveLength(2);
  });
});
