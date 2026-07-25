import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);

async function importTypeScript(relativePath) {
  const source = await readFile(new URL(relativePath, root), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

const report = {
  verdict: "request_changes",
  confidence: 82,
  recommendation: "Restore locale-aware folding.",
  verified_properties: ["ASCII behavior"],
  unverified_behavior: ["concurrent schedules"],
  generated_tests: ["def test_regression():\n    assert True"],
  counterexamples: [
    {
      minimized: ["İ", "i"],
      property_name: "locale-aware case equivalence",
    },
  ],
  performance: {
    delta_percent: -3.1,
    status: "improved",
    note: "Fixture only.",
  },
  api_compatibility: {
    compatible: true,
    changed_exports: [],
    note: "Signature unchanged.",
  },
};

test("GitHub adapter publishes the complete review packet", async () => {
  const { toGitHubCheck } = await importTypeScript("integrations/github-check.ts");
  const check = toGitHubCheck(report);

  assert.equal(check.status, "completed");
  assert.equal(check.conclusion, "failure");
  assert.match(check.output.summary, /82\/100/);
  assert.match(check.output.text, /Executable counterexamples/);
  assert.match(check.output.text, /Verified properties/);
  assert.match(check.output.text, /Unverified behavior/);
  assert.match(check.output.text, /Generated tests/);
  assert.match(check.output.text, /Performance/);
  assert.match(check.output.text, /API compatibility/);
  assert.match(check.output.text, /İ/);
});

test("GitHub adapter preserves inconclusive semantics", async () => {
  const { toGitHubCheck } = await importTypeScript("integrations/github-check.ts");
  const check = toGitHubCheck({
    ...report,
    verdict: "inconclusive",
    counterexamples: [],
    generated_tests: [],
  });

  assert.equal(check.conclusion, "neutral");
  assert.match(check.output.text, /within this run's budget/);
});

test("VS Code seam converts findings and drives its host boundary", async () => {
  const { publishFindings, toVsCodeFindings } = await importTypeScript(
    "integrations/vscode-adapter.ts",
  );
  const findings = toVsCodeFindings(
    { job_id: "pp_TEST", counterexamples: report.counterexamples },
    "src/search.ts",
    4,
  );
  const calls = [];
  const sink = {
    replace(value) {
      calls.push(["replace", value]);
    },
    showReport(value) {
      calls.push(["showReport", value]);
    },
  };

  publishFindings(sink, "pp_TEST", findings);
  assert.deepEqual(findings, [
    {
      file: "src/search.ts",
      line: 4,
      severity: "error",
      message: "locale-aware case equivalence fails for [\"İ\",\"i\"]",
    },
  ]);
  assert.deepEqual(calls, [["replace", findings], ["showReport", "pp_TEST"]]);
});
