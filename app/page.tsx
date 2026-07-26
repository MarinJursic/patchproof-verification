"use client";

import { useEffect, useMemo, useState } from "react";
import { scenarioById, scenarios } from "./data/scenarios";

type Theme = "light" | "dark";
type LedgerTab = "finding" | "test" | "scope" | "provenance";
type CopyState = "idle" | "copied" | "failed";

const LEDGER_TABS: LedgerTab[] = ["finding", "test", "scope", "provenance"];

function stateSymbol(state: "pass" | "warn" | "fail" | "unverified") {
  return state === "pass" ? "✓" : state === "fail" ? "×" : state === "warn" ? "!" : "·";
}

function traceTimestamp(stages: { duration: string }[], endIndex: number) {
  const elapsedMs = stages
    .slice(0, endIndex)
    .reduce((total, stage) => total + Math.round(Number.parseFloat(stage.duration) * 1000), 0);
  return new Date(Date.UTC(2026, 6, 25, 14, 34, 25, 42) + elapsedMs)
    .toISOString()
    .slice(11, 23) + "Z";
}

export default function Home() {
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const scenario = scenarioById[scenarioId];
  const [position, setPosition] = useState(scenario.stages.length);
  const [selectedStageId, setSelectedStageId] = useState(scenario.stages.at(-1)?.id ?? "");
  const [running, setRunning] = useState(false);
  const [ledgerTab, setLedgerTab] = useState<LedgerTab>("finding");
  const [traceOpen, setTraceOpen] = useState(true);
  const [theme, setTheme] = useState<Theme>("light");
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const selectedStage =
    scenario.stages.find((stage) => stage.id === selectedStageId) ?? scenario.stages[0];
  const selectedStageIndex = scenario.stages.findIndex((stage) => stage.id === selectedStage.id);
  const selectedStageComplete = selectedStageIndex >= 0 && selectedStageIndex < position;
  const runComplete = position >= scenario.stages.length;

  useEffect(() => {
    const saved = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
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
  }

  function replay() {
    setPosition(0);
    setSelectedStageId(scenario.stages[0].id);
    setRunning(true);
  }

  function continueReplay() {
    if (running) {
      setRunning(false);
      return;
    }
    if (runComplete) {
      setPosition(0);
      setSelectedStageId(scenario.stages[0].id);
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
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(scenario.generatedTest);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 1600);
  }

  function exportEvidence() {
    const payload = JSON.stringify({ scenario, selectedStage, replayPosition: position }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `patchproof-${scenario.id}-evidence.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className={`workbench ${traceOpen ? "trace-is-open" : ""}`}>
      <header className="command-bar">
        <a className="wordmark" href="#workspace" aria-label="PatchProof workbench">
          <span aria-hidden="true">P/</span> PATCHPROOF
        </a>
        <div className="crumbs" aria-label="Current patch">
          <span>{scenario.repository}</span><b>/</b><span>{scenario.patchRef}</span><b>/</b><strong>{scenario.sourceFile}</strong>
        </div>
        <div className="command-actions">
          <span className="recorded-badge"><i /> {scenario.provenance.classification}</span>
          <button type="button" onClick={exportEvidence}>Export JSON</button>
          <button type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}>
            {theme === "light" ? "Dark" : "Light"}
          </button>
        </div>
      </header>

      <aside className="run-rail" aria-label="Verification scenarios">
        <div className="rail-heading">
          <span>Evidence cases</span>
          <strong>03</strong>
        </div>
        <div className="scenario-list">
          {scenarios.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={item.id === scenarioId ? "active" : ""}
              aria-pressed={item.id === scenarioId}
              onClick={() => chooseScenario(item.id)}
            >
              <small>0{index + 1}</small>
              <span><strong>{item.shortLabel}</strong><em>{item.repository}</em></span>
              <b>×</b>
            </button>
          ))}
        </div>
        <div className="run-manifest">
          <span>RUN MANIFEST</span>
          <dl>
            <div><dt>Verdict</dt><dd className={runComplete ? "fail-text" : ""}>{runComplete ? scenario.verdict : "PENDING"}</dd></div>
            <div><dt>Completed</dt><dd>{completedStages.length}/{scenario.stages.length}</dd></div>
            <div><dt>Seed</dt><dd>20260725</dd></div>
            <div><dt>Bundle</dt><dd>{scenario.provenance.digest.slice(7, 17)}</dd></div>
          </dl>
        </div>
        <p className="rail-note">Pages replays a report generated by the Python verifier. Arbitrary code is not executed in this browser.</p>
      </aside>

      <section className="workspace" id="workspace" aria-label="Patch evidence workspace">
        <div className="case-heading">
          <div>
            <span>CASE / {scenario.id}</span>
            <h1>{scenario.title}</h1>
            <p>{scenario.question}</p>
          </div>
          <div className="transport" role="toolbar" aria-label="Verification replay">
            <button type="button" onClick={replay} disabled={running}>↻ Replay</button>
            <button type="button" onClick={continueReplay} aria-pressed={running}>
              {running ? "Ⅱ Pause" : "▶ Continue"}
            </button>
            <button type="button" onClick={step}>Step →</button>
          </div>
        </div>

        <section className="diff-sheet" aria-label={`Patch in ${scenario.sourceFile}`}>
          <div className="sheet-bar">
            <span>{scenario.sourceFile}</span>
            <span><b className="add-text">+1</b><b className="fail-text">−{scenario.diff.filter((line) => line.kind === "remove").length}</b></span>
          </div>
          <pre className="code-diff">
            {scenario.diff.map((line, index) => (
              <span className={line.kind} key={`${line.number}-${index}`}>
                <i>{line.number}</i><b>{line.kind === "add" ? "+" : line.kind === "remove" ? "−" : " "}</b><code>{line.text}</code>
              </span>
            ))}
          </pre>
        </section>

        <section className="evidence-pipeline" aria-labelledby="pipeline-title">
          <div className="subhead"><span id="pipeline-title">EXECUTION LEDGER</span><span>{running ? "RUNNING" : "COMPLETE"} · {position}/{scenario.stages.length}</span></div>
          <div className="stage-list" aria-live="polite">
            {scenario.stages.map((stage, index) => {
              const complete = index < position;
              const selected = stage.id === selectedStage.id;
              return (
                <button
                  type="button"
                  key={stage.id}
                  className={`${complete ? stage.state : "pending"} ${selected ? "selected" : ""}`}
                  onClick={() => { if (complete) setSelectedStageId(stage.id); }}
                  disabled={!complete}
                  aria-current={selected ? "step" : undefined}
                >
                  <span className="stage-index">0{index + 1}</span>
                  <span className="stage-state">{complete ? stateSymbol(stage.state) : "·"}</span>
                  <span className="stage-copy"><strong>{stage.label}</strong><small>{complete ? stage.summary : "waiting"}</small></span>
                  <code>{stage.engine}</code>
                  <time>{complete ? stage.duration : "—"}</time>
                </button>
              );
            })}
          </div>
        </section>

        <section className="stage-detail" aria-label="Selected stage evidence">
          <div><span>COMMAND</span><code>{selectedStageComplete ? selectedStage.command : "Gated until this replay step completes"}</code></div>
          <div><span>OBSERVED OUTPUT</span><code>{selectedStageComplete ? selectedStage.output : "No output disclosed yet"}</code></div>
          <div><span>SCOPE</span><p>{selectedStageComplete ? selectedStage.scope : "Pending execution-ledger replay"}</p></div>
        </section>
      </section>

      <aside className="evidence-ledger" aria-label="Evidence ledger">
        <div className="verdict-block">
          <span>PATCH DISPOSITION</span>
          <strong>{runComplete ? "Request changes" : "Replay in progress"}</strong>
          <p>{runComplete ? "Executable behavior diverges from the reference on a minimized input." : "Final evidence remains gated until all six recorded stages are replayed."}</p>
        </div>
        <div className="ledger-tabs" role="tablist" aria-label="Evidence views">
          {LEDGER_TABS.map((tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={ledgerTab === tab}
              key={tab}
              disabled={!runComplete && tab !== "provenance"}
              onClick={() => setLedgerTab(tab)}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
                event.preventDefault();
                const direction = event.key === "ArrowRight" ? 1 : -1;
                const enabled = LEDGER_TABS.filter((item) => runComplete || item === "provenance");
                const next = enabled[(enabled.indexOf(tab) + direction + enabled.length) % enabled.length];
                setLedgerTab(next);
                const target = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`button[role="tab"]:nth-child(${LEDGER_TABS.indexOf(next) + 1})`);
                window.setTimeout(() => target?.focus(), 0);
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {!runComplete && ledgerTab !== "provenance" && (
          <div className="ledger-panel evidence-gated" role="tabpanel">
            <span className="panel-label">FINAL EVIDENCE GATED</span>
            <p>Complete all six replay stages to disclose the counterexample, regression, and established scope.</p>
          </div>
        )}

        {runComplete && ledgerTab === "finding" && (
          <div className="ledger-panel" role="tabpanel">
            <span className="panel-label">MINIMIZED COUNTEREXAMPLE</span>
            <code className="counterexample">{scenario.counterexample.minimized}</code>
            <p>{scenario.counterexample.property}</p>
            <div className="behavior-compare">
              <div><span>REFERENCE</span><strong>{scenario.counterexample.reference}</strong></div>
              <div><span>PATCHED</span><strong>{scenario.counterexample.patched}</strong></div>
            </div>
            <span className="panel-label">SHRINK TRACE</span>
            <ol className="shrink-trace">
              {scenario.counterexample.shrinkTrace.map((frame, index) => <li key={frame}><span>0{index + 1}</span><code>{frame}</code></li>)}
            </ol>
          </div>
        )}

        {runComplete && ledgerTab === "test" && (
          <div className="ledger-panel" role="tabpanel">
            <div className="panel-row"><span className="panel-label">GENERATED REGRESSION</span><button type="button" onClick={() => void copyTest()}>{copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy"}</button></div>
            <pre className="generated-test"><code>{scenario.generatedTest}</code></pre>
            <p>Commit this test with the fix so the minimized behavior becomes part of the repository contract.</p>
          </div>
        )}

        {runComplete && ledgerTab === "scope" && (
          <div className="ledger-panel" role="tabpanel">
            <span className="panel-label">ESTABLISHED IN THIS RUN</span>
            <ul className="scope-list verified">{scenario.verified.map((item) => <li key={item}>{item}</li>)}</ul>
            <span className="panel-label">NOT ESTABLISHED</span>
            <ul className="scope-list unverified">{scenario.unverified.map((item) => <li key={item}>{item}</li>)}</ul>
            <p>No correctness probability is inferred from this evidence.</p>
          </div>
        )}

        {ledgerTab === "provenance" && (
          <div className="ledger-panel" role="tabpanel">
            <span className="panel-label">SOURCE MANIFEST</span>
            <dl className="provenance">
              <div><dt>Classification</dt><dd>{scenario.provenance.classification}</dd></div>
              <div><dt>Source</dt><dd><a href={scenario.provenance.sourceUrl}>{scenario.provenance.source}</a></dd></div>
              <div><dt>Version</dt><dd>{scenario.provenance.version}</dd></div>
              <div><dt>License</dt><dd>{scenario.provenance.license}</dd></div>
              <div><dt>Digest input</dt><dd><code>{scenario.provenance.digestInput}</code></dd></div>
              <div><dt>Digest</dt><dd><code>{scenario.provenance.digest}</code></dd></div>
              <div><dt>Generated</dt><dd>{scenario.provenance.generatedAt}</dd></div>
            </dl>
            <p>{scenario.provenance.note}</p>
          </div>
        )}
      </aside>

      <section className="trace-drawer" aria-label="Execution trace">
        <button className="trace-toggle" type="button" onClick={() => setTraceOpen((value) => !value)} aria-expanded={traceOpen}>
          <span>EXECUTION TRACE · {selectedStage.label}</span><span>{traceOpen ? "Hide ↓" : "Show ↑"}</span>
        </button>
        {traceOpen && (
          <div className="trace-body">
            <span>{traceTimestamp(scenario.stages, selectedStageIndex)}</span><b className={selectedStageComplete ? selectedStage.state : "unverified"}>●</b><code>{selectedStageComplete ? `$ ${selectedStage.command}` : "$ pending replay step"}</code>
            <span>{selectedStageComplete ? traceTimestamp(scenario.stages, selectedStageIndex + 1) : "—"}</span><b>↳</b><code>{selectedStageComplete ? selectedStage.output : "No observed output yet"}</code>
            <span>artifact</span><b>◇</b><code>{runComplete ? scenario.provenance.digest : "Digest disclosed after complete replay"}</code>
          </div>
        )}
      </section>
    </main>
  );
}
