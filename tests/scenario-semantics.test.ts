import { describe, expect, it } from "vitest";

import { scenarioById } from "../app/data/scenarios";

describe("displayed regression semantics", () => {
  it.each([
    ["unicode-turkish-fold", "equal_folded("],
    ["tzdb-ambiguous-fold", "display_time("],
    ["quixbugs-shortest-path", "shortest_path_lengths("],
  ])("calls the changed function for %s", (scenarioId, changedFunction) => {
    expect(scenarioById[scenarioId].generatedTest).toContain(changedFunction);
  });

  it("preserves both UTC instants and PEP 495 folds in the DST regression", () => {
    const regression =
      scenarioById["tzdb-ambiguous-fold"].generatedTest;

    expect(regression).toContain("first_utc");
    expect(regression).toContain("second_utc");
    expect(regression).toContain("== [0, 1]");
    expect(regression).toContain("value.astimezone(UTC)");
  });
});
