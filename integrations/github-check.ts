/**
 * Framework-neutral GitHub Check adapter.
 *
 * An authenticated GitHub App can POST the returned object to the Checks API.
 * This repository deliberately does not include credentials or network calls.
 */
export type PatchProofSummary = {
  verdict: "accept" | "request_changes" | "inconclusive";
  evidence_coverage: {
    executable_checks: string[];
    fixture_checks: string[];
    properties_exercised: string[];
    explicit_gaps: string[];
    counterexample_reproduced: boolean;
    regression_test_generated: boolean;
  };
  recommendation: string;
  verified_properties: string[];
  unverified_behavior: string[];
  generated_tests: string[];
  counterexamples: Array<{ minimized: [string, string]; property_name: string }>;
  performance: {
    delta_percent: number;
    status: "improved" | "regressed" | "neutral";
    note: string;
  };
  api_compatibility: {
    compatible: boolean;
    changed_exports: string[];
    note: string;
  };
};

export function toGitHubCheck(report: PatchProofSummary) {
  const failed = report.verdict === "request_changes";
  const counterexamples = report.counterexamples
    .map((item) => `- \`${JSON.stringify(item.minimized)}\` violates **${item.property_name}**`)
    .join("\n");
  const bullets = (items: string[], empty: string) =>
    items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : `- ${empty}`;
  const generatedTests = report.generated_tests
    .map((test) => `\`\`\`python\n${test}\n\`\`\``)
    .join("\n\n");
  const compatibility = report.api_compatibility.compatible
    ? "Compatible"
    : `Incompatible (${report.api_compatibility.changed_exports.join(", ") || "contract changed"})`;
  const text = [
    "## Executable counterexamples",
    counterexamples || "No executable counterexample was produced within this run's budget.",
    "## Verified properties",
    bullets(report.verified_properties, "None"),
    "## Unverified behavior",
    bullets(report.unverified_behavior, "None reported"),
    "## Evidence coverage",
    bullets([
      `Executable checks: ${report.evidence_coverage.executable_checks.join(", ")}`,
      `Fixture checks: ${report.evidence_coverage.fixture_checks.join(", ")}`,
      `Properties exercised: ${report.evidence_coverage.properties_exercised.join(", ")}`,
      `Counterexample reproduced: ${report.evidence_coverage.counterexample_reproduced}`,
      `Regression test generated: ${report.evidence_coverage.regression_test_generated}`,
    ], "None reported"),
    "## Generated tests",
    generatedTests || "No regression test was generated.",
    "## Performance",
    `${report.performance.status}: ${report.performance.delta_percent}% — ${report.performance.note}`,
    "## API compatibility",
    `${compatibility} — ${report.api_compatibility.note}`,
  ].join("\n\n");

  return {
    name: "PatchProof",
    status: "completed",
    conclusion: failed ? "failure" : report.verdict === "accept" ? "success" : "neutral",
    output: {
      title: failed ? "Executable counterexample found" : "No counterexample found in budget",
      summary: `Executable checks: ${report.evidence_coverage.executable_checks.length} · fixture checks: ${report.evidence_coverage.fixture_checks.length}\n\n${report.recommendation}`,
      text,
    },
  } as const;
}
