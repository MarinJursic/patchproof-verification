import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Home from "../app/page";

describe("PatchProof forensic workbench", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

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

    expect(
      screen.getByLabelText(
        "Evidence source: executed engine run. This describes provenance, not the patch verdict.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Patch verdict")).toBeTruthy();
    expect(screen.getByText("FALSIFIED")).toBeTruthy();
    expect(screen.queryByText("Reviewed evidence")).toBeNull();

    expect(screen.getByText("Turkish case folding")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /DST fold/ }));
    expect(screen.getByText("Ambiguous local time")).toBeTruthy();
    expect(screen.getByText(/IANA tzdb 2026c/)).toBeTruthy();
    expect(
      screen.getByLabelText(
        "Evidence source: recorded executable fixture. This describes provenance, not the patch verdict.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Recorded fixture")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Shortest path/ }));
    expect(screen.getByText("Disconnected graph path")).toBeTruthy();
    await user.click(screen.getByRole("tab", { name: "Run details" }));
    expect(screen.getByText(/QuixBugs benchmark shape/)).toBeTruthy();
  });

  it("replays and steps through the six-stage evidence ledger", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: /Replay/ }));
    expect(screen.getByText("RUNNING · 0/6")).toBeTruthy();
    expect(screen.getAllByText("waiting")).toHaveLength(6);
    expect(
      screen.getByRole("button", { name: "Export JSON" }).hasAttribute("disabled"),
    ).toBe(true);

    await user.click(screen.getByRole("button", { name: /Pause/ }));
    await user.click(screen.getByRole("button", { name: "Step →" }));
    expect(screen.getByText("PAUSED · 1/6")).toBeTruthy();
    expect(screen.getByText("Review paused")).toBeTruthy();
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
    expect(
      screen.getByRole("tab", { name: "Finding" }).hasAttribute("disabled"),
    ).toBe(false);
    expect(screen.getByText("Gated until this replay step completes")).toBeTruthy();
  });

  it("navigates the evidence ledger and copies the generated regression", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<Home />);

    await user.click(screen.getByRole("tab", { name: "Regression test" }));
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("test_equal_folded_tr_tr_counterexample"),
    );

    await user.click(screen.getByRole("tab", { name: "Verified scope" }));
    expect(screen.getByText("NOT ESTABLISHED")).toBeTruthy();
    expect(screen.getByText(/No correctness probability/)).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Run details" }));
    expect(screen.getByText("Unicode 17.0.0 · seed 20260725")).toBeTruthy();
  });

  it("reports clipboard failures instead of claiming a successful copy", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("denied"));
    render(<Home />);

    await user.click(screen.getByRole("tab", { name: "Regression test" }));
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(screen.getByRole("button", { name: "Copy failed" })).toBeTruthy();
  });

  it("exports the complete evidence bundle with a scenario-specific filename", async () => {
    const user = userEvent.setup();
    let downloadedFilename = "";
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadedFilename = this.download;
      });
    const createObjectURL = vi.fn(() => "blob:patchproof-evidence");
    const revokeObjectURL = vi.fn();
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectURL },
      revokeObjectURL: { configurable: true, value: revokeObjectURL },
    });
    render(<Home />);

    await user.click(screen.getByRole("button", { name: "Export JSON" }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(downloadedFilename).toBe(
      "patchproof-unicode-turkish-fold-evidence.json",
    );
  });

  it("persists the complete theme and exposes the trace drawer state", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: "Switch to dark theme" }));
    expect(window.localStorage.getItem("patchproof-theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    const traceToggle = screen.getByRole("button", { name: /EXECUTION TRACE/ });
    expect(traceToggle.getAttribute("aria-expanded")).toBe("false");
    await user.click(traceToggle);
    expect(traceToggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("keeps stage selection keyboard-operable", () => {
    render(<Home />);
    const mutation = screen.getByRole("button", { name: /Mutation probe/ });
    fireEvent.keyDown(mutation, { key: "Enter" });
    fireEvent.click(mutation);
    expect(mutation.getAttribute("aria-current")).toBe("step");
    expect(screen.getAllByText("SURVIVED replace locale-aware fold with str.lower()")).toHaveLength(1);
  });

  it("supports standard Home and End navigation across evidence tabs", async () => {
    const user = userEvent.setup();
    render(<Home />);

    const finding = screen.getByRole("tab", { name: "Finding" });
    await user.click(finding);
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(
      screen.getByRole("tab", { name: "Run details" }),
    );

    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(
      screen.getByRole("tab", { name: "Finding" }),
    );
  });
});
