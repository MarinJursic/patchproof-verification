"use client";

import { useEffect, useMemo, useState } from "react";
import { scenarioById, scenarios } from "./data/scenarios";

type Theme = "light" | "dark";
type LedgerTab = "finding" | "test" | "scope" | "provenance";
type CopyState = "idle" | "copied" | "failed";
type ExportState = "idle" | "downloaded";

const LEDGER_TABS: LedgerTab[] = ["finding", "test", "scope", "provenance"];

function ledgerTabLabel(tab: LedgerTab) {
  return tab === "finding"
    ? "Finding"
    : tab === "test"
      ? "Regression test"
      : tab === "scope"
        ? "Verified scope"
        : "Run details";
}

function stateSymbol(state: "pass" | "warn" | "fail" | "unverified") {
  return state === "pass"
    ? "✓"
    : state === "fail"
      ? "×"
      : state === "warn"
        ? "!"
        : "·";
}

function traceTimestamp(stages: { duration: string }[], endIndex: number) {
  const elapsedMs = stages
    .slice(0, endIndex)
    .reduce(
      (total, stage) =>
        total + Math.round(Number.parseFloat(stage.duration) * 1000),
      0,
    );
  return (
    new Date(Date.UTC(2026, 6, 25, 14, 34, 25, 42) + elapsedMs)
      .toISOString()
      .slice(11, 23) + "Z"
  );
}

export default function Home() {
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const scenario = scenarioById[scenarioId];
  const [position, setPosition] = useState(scenario.stages.length);
  const [selectedStageId, setSelectedStageId] = useState(
    scenario.stages.at(-1)?.id ?? "",
  );
  const [running, setRunning] = useState(false);
  const [ledgerTab, setLedgerTab] = useState<LedgerTab>("finding");
  const [traceOpen, setTraceOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [exportState, setExportState] = useState<ExportState>("idle");

  const selectedStage =
    scenario.stages.find((stage) => stage.id === selectedStageId) ??
    scenario.stages[0];
  const selectedStageIndex = scenario.stages.findIndex(
    (stage) => stage.id === selectedStage.id,
  );
  const selectedStageComplete =
    selectedStageIndex >= 0 && selectedStageIndex < position;
  const runComplete = position >= scenario.stages.length;
  const replayStatus = runComplete
    ? "COMPLETE"
    : running
      ? "RUNNING"
      : "PAUSED";

  useEffect(() => {
    const saved =
      document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(saved);
  }, []);

  useEffect(() => {
    if (!running) return;
    if (position >= scenario.stages.length) {
      setRunning(false);
      return;
    }
    const timer = window.setTimeout(() => {
      const next = position + 1;
      setPosition(next);
      setSelectedStageId(scenario.stages[Math.max(0, next - 1)].id);
    }, 720);
    return () => window.clearTimeout(timer);
  }, [position, running, scenario]);

  const completedStages = useMemo(
    () => scenario.stages.slice(0, position),
    [position, scenario],
  );

  function chooseScenario(id: string) {
    const next = scenarioById[id];
    setScenarioId(id);
    setPosition(next.stages.length);
    setSelectedStageId(next.stages.at(-1)?.id ?? "");
    setRunning(false);
    setLedgerTab("finding");
    setCopyState("idle");
    setExportState("idle");
  }

  function replay() {
    setPosition(0);
    setSelectedStageId(scenario.stages[0].id);
    setRunning(true);
    setExportState("idle");
  }

  function continueReplay() {
    if (running) {
      setRunning(false);
      return;
    }
    if (runComplete) {
      setPosition(0);
      setSelectedStageId(scenario.stages[0].id);
      setExportState("idle");
    }
    setRunning(true);
  }

  function step() {
    setRunning(false);
    const next = position >= scenario.stages.length ? 1 : position + 1;
    setPosition(next);
    setSelectedStageId(scenario.stages[Math.max(0, next - 1)].id);
  }

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    window.localStorage.setItem("patchproof-theme", next);
    setTheme(next);
  }

  async function copyTest() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(scenario.generatedTest);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 1600);
  }

  function exportEvidence() {
    if (!runComplete) return;
    const payload = JSON.stringify(
      { scenario, selectedStage, replayPosition: position },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([payload], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `patchproof-${scenario.id}-evidence.json`;
    anchor.click();
    setExportState("downloaded");
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <main className="workbench">
      <header className="command-bar">
        <a className="wordmark" href="#workspace" aria-label="PatchProof workbench">
          <span aria-hidden="true">P</span>
          <strong>PatchProof</strong>
        </a>
        <div className="crumbs" aria-label="Current patch">
          <span>{scenario.repository}</span>
          <b>/</b>
          <span>{scenario.patchRef}</span>
          <b>/</b>
          <strong>{scenario.sourceFile}</strong>
        </div>
        <div className="command-actions">
          <span
            className="recorded-badge"
            aria-label={`Evidence source: ${
              scenario.provenance.classification === "EXECUTABLE ENGINE RUN"
                ? "executed engine run"
                : "recorded executable fixture"
            }. This describes provenance, not the patch verdict.`}
            title="Evidence provenance, not the patch verdict"
          >
            <i aria-hidden="true" />
            <span>Evidence source</span>
            <b aria-hidden="true">·</b>
            {scenario.provenance.classification === "EXECUTABLE ENGINE RUN"
              ? "Engine run"
              : "Recorded fixture"}
          </span>
          <button
            type="button"
            onClick={exportEvidence}
            disabled={!runComplete}
            aria-describedby="export-availability"
            title={
              runComplete
                ? "Download the complete evidence bundle"
                : "Complete the replay before exporting final evidence"
            }
          >
            Export JSON
          </button>
          <span id="export-availability" className="visually-hidden">
            {runComplete
              ? "Complete evidence bundle ready to download."
              : "Available after the replay completes."}
          </span>
          <span
            className="visually-hidden"
            role="status"
            aria-live="polite"
          >
            {exportState === "downloaded"
              ? "Evidence JSON download started."
              : ""}
          </span>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          >
            {theme === "light" ? "Dark" : "Light"}
          </button>
        </div>
      </header>

      <nav className="case-switcher" aria-label="Verification scenarios">
        <span>Choose a review</span>
        <div>
          {scenarios.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={item.id === scenarioId ? "active" : ""}
              aria-pressed={item.id === scenarioId}
              onClick={() => chooseScenario(item.id)}
            >
              <small>0{index + 1}</small>
              <strong>{item.shortLabel}</strong>
              <em>{item.repository}</em>
            </button>
          ))}
        </div>
      </nav>

      <section
        className="review-shell"
        id="workspace"
        aria-label="Patch evidence workspace"
      >
        <section className="review-heading">
          <div>
            <span className="eyebrow">PATCH REVIEW · {scenario.id}</span>
            <h1>{scenario.title}</h1>
            <p>{scenario.question}</p>
          </div>
          <div className="review-actions" role="toolbar" aria-label="Verification replay">
            <button
              className="primary-action"
              type="button"
              onClick={replay}
              disabled={running}
            >
              ↻ Replay verification
            </button>
            <details>
              <summary>Replay options</summary>
              <div>
                <button
                  type="button"
                  onClick={continueReplay}
                  aria-pressed={running}
                >
                  {running ? "Ⅱ Pause" : "▶ Continue"}
                </button>
                <button type="button" onClick={step}>
                  Step →
                </button>
              </div>
            </details>
          </div>
        </section>

        <section
          className={`verdict-hero ${runComplete ? "failed" : "running"}`}
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="verdict-icon" aria-hidden="true">
            {runComplete ? "×" : completedStages.length}
          </div>
          <div className="verdict-copy">
            <span>
              {runComplete
                ? "ACTION REQUIRED"
                : running
                  ? "VERIFICATION RUNNING"
                  : "VERIFICATION PAUSED"}
            </span>
            <h2>
              {runComplete
                ? "Request changes"
                : running
                  ? "Review in progress"
                  : "Review paused"}
            </h2>
            <p>
              {runComplete
                ? "The patch changes executable behavior on a minimized input. Review the counterexample before approving."
                : running
                  ? "Evidence is revealed in order. The final finding remains gated until all six stages complete."
                  : "Continue the replay or inspect the completed steps. Final evidence remains gated until all six stages complete."}
            </p>
          </div>
          <dl className="verdict-summary">
            <div>
              <dt>Stages</dt>
              <dd>
                {completedStages.length}/{scenario.stages.length}
              </dd>
            </div>
            <div>
              <dt>Patch verdict</dt>
              <dd>{runComplete ? scenario.verdict : "PENDING"}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{scenario.provenance.classification}</dd>
            </div>
          </dl>
        </section>

        <div className="evidence-grid">
          <section
            className="diff-sheet"
            aria-label={`Patch in ${scenario.sourceFile}`}
          >
            <div className="sheet-bar">
              <div>
                <span>Changed code</span>
                <strong>{scenario.sourceFile}</strong>
              </div>
              <span>
                <b className="add-text">+1</b>
                <b className="fail-text">
                  −
                  {
                    scenario.diff.filter((line) => line.kind === "remove")
                      .length
                  }
                </b>
              </span>
            </div>
            <pre className="code-diff">
              {scenario.diff.map((line, index) => (
                <span className={line.kind} key={`${line.number}-${index}`}>
                  <i>{line.number}</i>
                  <b>
                    {line.kind === "add"
                      ? "+"
                      : line.kind === "remove"
                        ? "−"
                        : " "}
                  </b>
                  <code>{line.text}</code>
                </span>
              ))}
            </pre>
          </section>

          <section className="finding-preview" aria-label="Primary finding">
            <header>
              <span>Why this fails</span>
              <strong>{scenario.counterexample.property}</strong>
            </header>
            {runComplete ? (
              <>
                <code className="counterexample">
                  {scenario.counterexample.minimized}
                </code>
                <div className="behavior-compare">
                  <div>
                    <span>Expected</span>
                    <strong>{scenario.counterexample.reference}</strong>
                  </div>
                  <div>
                    <span>Patched result</span>
                    <strong>{scenario.counterexample.patched}</strong>
                  </div>
                </div>
              </>
            ) : (
              <div className="finding-locked">
                <span>Evidence locked</span>
                <p>Complete the replay to reveal the minimized counterexample.</p>
              </div>
            )}
          </section>
        </div>

        <section className="evidence-pipeline" aria-labelledby="pipeline-title">
          <div className="subhead">
            <div>
              <span id="pipeline-title">How the result was established</span>
              <small>Select any completed step to inspect its evidence.</small>
            </div>
            <strong>
              {replayStatus} · {position}/
              {scenario.stages.length}
            </strong>
            <span
              className="visually-hidden"
              role="status"
              aria-live="polite"
            >
              Replay {replayStatus.toLowerCase()}. {position} of{" "}
              {scenario.stages.length} stages complete.
            </span>
          </div>
          <div className="stage-list">
            {scenario.stages.map((stage, index) => {
              const complete = index < position;
              const selected = stage.id === selectedStage.id;
              return (
                <button
                  type="button"
                  key={stage.id}
                  className={`${complete ? stage.state : "pending"} ${selected ? "selected" : ""}`}
                  onClick={() => {
                    if (complete) setSelectedStageId(stage.id);
                  }}
                  disabled={!complete}
                  aria-current={selected ? "step" : undefined}
                >
                  <span className="stage-state">
                    {complete ? stateSymbol(stage.state) : "·"}
                    <span className="visually-hidden">
                      {complete
                        ? stage.state === "pass"
                          ? "Passed"
                          : stage.state === "warn"
                            ? "Warning"
                            : "Failed"
                        : "Pending"}
                    </span>
                  </span>
                  <span className="stage-copy">
                    <small>STEP 0{index + 1}</small>
                    <strong>{stage.label}</strong>
                    <em>{complete ? stage.summary : "waiting"}</em>
                  </span>
                  <time>{complete ? stage.duration : "—"}</time>
                </button>
              );
            })}
          </div>
          <div className="stage-detail" aria-label="Selected stage evidence">
            <div>
              <span>Command</span>
              <code>
                {selectedStageComplete
                  ? selectedStage.command
                  : "Gated until this replay step completes"}
              </code>
            </div>
            <div>
              <span>Observed output</span>
              <code>
                {selectedStageComplete
                  ? selectedStage.output
                  : "No output disclosed yet"}
              </code>
            </div>
            <div>
              <span>Scope</span>
              <p>
                {selectedStageComplete
                  ? selectedStage.scope
                  : "Pending execution-ledger replay"}
              </p>
            </div>
          </div>
        </section>

        <section className="analysis-card" aria-label="Evidence ledger">
          <div className="ledger-tabs" role="tablist" aria-label="Evidence views">
            {LEDGER_TABS.map((tab) => (
              <button
                type="button"
                role="tab"
                id={`tab-${tab}`}
                aria-controls={`panel-${tab}`}
                aria-selected={ledgerTab === tab}
                tabIndex={ledgerTab === tab ? 0 : -1}
                key={tab}
                onClick={() => setLedgerTab(tab)}
                onKeyDown={(event) => {
                  if (
                    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  ) {
                    return;
                  }
                  event.preventDefault();
                  const direction = event.key === "ArrowRight" ? 1 : -1;
                  const next =
                    event.key === "Home"
                      ? LEDGER_TABS[0]
                      : event.key === "End"
                        ? LEDGER_TABS.at(-1)!
                        : LEDGER_TABS[
                            (LEDGER_TABS.indexOf(tab) +
                              direction +
                              LEDGER_TABS.length) %
                              LEDGER_TABS.length
                          ];
                  setLedgerTab(next);
                  const target =
                    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
                      `button[role="tab"]:nth-child(${LEDGER_TABS.indexOf(next) + 1})`,
                    );
                  window.setTimeout(() => target?.focus(), 0);
                }}
              >
                {ledgerTabLabel(tab)}
              </button>
            ))}
          </div>

          {!runComplete && ledgerTab !== "provenance" && (
            <div
              className="ledger-panel evidence-gated"
              role="tabpanel"
              id={`panel-${ledgerTab}`}
              aria-labelledby={`tab-${ledgerTab}`}
            >
              <span className="panel-label">FINAL EVIDENCE GATED</span>
              <p>
                Complete all six replay stages to disclose the counterexample,
                regression, and established scope.
              </p>
            </div>
          )}

          {runComplete && ledgerTab === "finding" && (
            <div
              className="ledger-panel finding-panel"
              role="tabpanel"
              id="panel-finding"
              aria-labelledby="tab-finding"
            >
              <div>
                <span className="panel-label">MINIMIZED COUNTEREXAMPLE</span>
                <p>{scenario.counterexample.property}</p>
                <ol className="shrink-trace">
                  {scenario.counterexample.shrinkTrace.map((frame, index) => (
                    <li key={frame}>
                      <span>0{index + 1}</span>
                      <code>{frame}</code>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="review-guidance">
                <span>Recommended next step</span>
                <strong>Restore the reference behavior, then keep the generated regression.</strong>
                <p>
                  The minimized case reproduces under the same engine, seed, and
                  process.
                </p>
              </div>
            </div>
          )}

          {runComplete && ledgerTab === "test" && (
            <div
              className="ledger-panel"
              role="tabpanel"
              id="panel-test"
              aria-labelledby="tab-test"
            >
              <div className="panel-row">
                <span className="panel-label">GENERATED REGRESSION</span>
                <button type="button" onClick={() => void copyTest()}>
                  {copyState === "copied"
                    ? "Copied"
                    : copyState === "failed"
                      ? "Copy failed"
                      : "Copy"}
                </button>
                <span
                  className="visually-hidden"
                  role="status"
                  aria-live="polite"
                >
                  {copyState === "copied"
                    ? "Regression test copied to the clipboard."
                    : copyState === "failed"
                      ? "Regression test could not be copied."
                      : ""}
                </span>
              </div>
              <pre className="generated-test">
                <code>{scenario.generatedTest}</code>
              </pre>
              <p>
                Commit this test with the fix so the minimized behavior becomes
                part of the repository contract.
              </p>
            </div>
          )}

          {runComplete && ledgerTab === "scope" && (
            <div
              className="ledger-panel scope-columns"
              role="tabpanel"
              id="panel-scope"
              aria-labelledby="tab-scope"
            >
              <div>
                <span className="panel-label">ESTABLISHED IN THIS RUN</span>
                <ul className="scope-list verified">
                  {scenario.verified.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="panel-label">NOT ESTABLISHED</span>
                <ul className="scope-list unverified">
                  {scenario.unverified.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p>No correctness probability is inferred from this evidence.</p>
              </div>
            </div>
          )}

          {ledgerTab === "provenance" && (
            <div
              className="ledger-panel"
              role="tabpanel"
              id="panel-provenance"
              aria-labelledby="tab-provenance"
            >
              <span className="panel-label">SOURCE MANIFEST</span>
              <dl className="provenance">
                <div>
                  <dt>Classification</dt>
                  <dd>{scenario.provenance.classification}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>
                    <a
                      href={scenario.provenance.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {scenario.provenance.source}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Version</dt>
                  <dd>{scenario.provenance.version}</dd>
                </div>
                <div>
                  <dt>License</dt>
                  <dd>{scenario.provenance.license}</dd>
                </div>
                <div>
                  <dt>Digest input</dt>
                  <dd>
                    <code>{scenario.provenance.digestInput}</code>
                  </dd>
                </div>
                <div>
                  <dt>Digest</dt>
                  <dd>
                    <code>{scenario.provenance.digest}</code>
                  </dd>
                </div>
                <div>
                  <dt>Generated</dt>
                  <dd>{scenario.provenance.generatedAt}</dd>
                </div>
              </dl>
              <p>{scenario.provenance.note}</p>
            </div>
          )}
        </section>

        <section className="trace-drawer" aria-label="Execution trace">
          <button
            className="trace-toggle"
            type="button"
            onClick={() => setTraceOpen((value) => !value)}
            aria-expanded={traceOpen}
          >
            <span>EXECUTION TRACE · {selectedStage.label}</span>
            <span>{traceOpen ? "Hide details ↑" : "Show details ↓"}</span>
          </button>
          {traceOpen && (
            <div className="trace-body">
              <span>
                {traceTimestamp(scenario.stages, selectedStageIndex)}
              </span>
              <b
                className={
                  selectedStageComplete ? selectedStage.state : "unverified"
                }
              >
                ●
              </b>
              <code>
                {selectedStageComplete
                  ? `$ ${selectedStage.command}`
                  : "$ pending replay step"}
              </code>
              <span>
                {selectedStageComplete
                  ? traceTimestamp(scenario.stages, selectedStageIndex + 1)
                  : "—"}
              </span>
              <b>↳</b>
              <code>
                {selectedStageComplete
                  ? selectedStage.output
                  : "No observed output yet"}
              </code>
              <span>artifact</span>
              <b>◇</b>
              <code>
                {runComplete
                  ? scenario.provenance.digest
                  : "Digest disclosed after complete replay"}
              </code>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
