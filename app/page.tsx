"use client";

import { useEffect, useMemo, useState } from "react";

type Stage = {
  id: string;
  label: string;
  detail: string;
  status: "pass" | "warn" | "fail" | "pending";
  worker: string;
  duration: string;
};

const stages: Stage[] = [
  { id: "tests", label: "Existing tests", detail: "214 / 214 passed", status: "pass", worker: "test-runner", duration: "1.2s" },
  { id: "types", label: "Type contracts", detail: "0 violations", status: "pass", worker: "pyright", duration: "0.4s" },
  { id: "mutation", label: "Mutation probe", detail: "locale branch survived", status: "warn", worker: "mutator", duration: "1.7s" },
  { id: "property", label: "Generated property", detail: "locale-aware case equivalence failed", status: "fail", worker: "property-engine", duration: "2.1s" },
  { id: "shrink", label: "Input minimized", detail: "30 code points → 2", status: "fail", worker: "shrinker", duration: "0.3s" },
  { id: "behavior", label: "Behavioral diff", detail: "old valid · patch violates", status: "fail", worker: "differential", duration: "0.1s" },
];

const diff = [
  { kind: "same", line: "export function equalFolded(a: string, b: string, locale: string) {" },
  { kind: "remove", line: "  return a.toLocaleLowerCase(locale)" },
  { kind: "remove", line: "    === b.toLocaleLowerCase(locale);" },
  { kind: "add", line: "  return a.toLowerCase()" },
  { kind: "add", line: "    === b.toLowerCase();" },
  { kind: "same", line: "}" },
] as const;

const shrinkFrames = [
  { label: "GENERATED · 30 code points", value: "[\"İSTANBUL PORTAL\", \"istanbul portal\"]", progress: "0 / 14 accepted reductions" },
  { label: "REDUCED · 16 code points", value: "[\"İSTANBUL\", \"istanbul\"]", progress: "7 / 14 accepted reductions" },
  { label: "1-MINIMAL · 2 code points", value: "[\"İ\", \"i\"]", progress: "14 / 14 accepted reductions" },
] as const;

export default function Home() {
  const [activeStage, setActiveStage] = useState(stages.length - 1);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<"evidence" | "report">("evidence");

  useEffect(() => {
    if (!running) return;
    if (activeStage >= stages.length - 1) {
      const finishTimer = window.setTimeout(() => setRunning(false), 160);
      return () => window.clearTimeout(finishTimer);
    }
    const timer = window.setTimeout(() => setActiveStage((value) => value + 1), 620);
    return () => window.clearTimeout(timer);
  }, [running, activeStage]);

  const completed = useMemo(() => stages.slice(0, activeStage + 1), [activeStage]);
  const shrinkFrame = shrinkFrames[activeStage < 4 ? 0 : activeStage === 4 ? 1 : 2];

  function replay() {
    setActiveStage(-1);
    setRunning(true);
    window.setTimeout(() => setActiveStage(0), 180);
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="PatchProof home">
          <span className="brand-mark" aria-hidden="true">P</span>
          <span>PatchProof</span>
          <span className="version">v0.1</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#proof">Proof</a>
          <a href="#evidence">Evidence</a>
          <a href="#architecture">Architecture</a>
        </nav>
        <a className="ghost-button" href="#integration-seams">Integration seams ↓</a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="pulse" /> Adversarial verification · deterministic demo</div>
          <h1>Your tests passed.<br /><span>Your patch didn’t.</span></h1>
          <p className="lede">
            PatchProof tries to disprove a code change with executable evidence—then shrinks the failure
            to the smallest counterexample a reviewer can act on.
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={replay} disabled={running}>
              <span aria-hidden="true">{running ? "···" : "▶"}</span>
              {running ? "Verification running" : "Replay verification"}
            </button>
            <code>patchproof demo</code>
          </div>
          <div className="signal-row" aria-label="Verification summary">
            <div><strong>82%</strong><span>confidence</span></div>
            <div><strong>2</strong><span>properties verified</span></div>
            <div><strong>1</strong><span>counterexample</span></div>
          </div>
        </div>

        <div className="patch-window" aria-label="Code patch">
          <div className="window-bar">
            <span><i className="dot red" /><i className="dot amber" /><i className="dot green" /></span>
            <strong>src/search.ts</strong>
            <span className="commit">8f29d1a</span>
          </div>
          <div className="diff-meta"><span>AI-generated patch</span><span className="green-text">+2</span><span className="red-text">−3</span></div>
          <pre className="diff">
            {diff.map((row, index) => (
              <span key={`${row.kind}-${index}`} className={row.kind}>
                <b>{row.kind === "add" ? "+" : row.kind === "remove" ? "−" : " "}</b>{row.line}
              </span>
            ))}
          </pre>
          <div className="patch-footer">
            <span className="check">✓</span>
            <div><strong>Original test suite</strong><small>214 passed · 0 failed</small></div>
            <span className="passed">PASSED</span>
          </div>
        </div>
      </section>

      <section className="proof-section" id="proof">
        <div className="section-heading">
          <div>
            <span className="kicker">Verification proof</span>
            <h2>One patch. Six independent claims.</h2>
          </div>
          <div className="run-status">
            <span className={running ? "spinner" : "status-stop"} />
            <div><strong>{running ? "Workers active" : "Completed with counterexample"}</strong><small>run pp_01JQ9V8K · seed 20260725</small></div>
          </div>
        </div>

        <div className="proof-layout">
          <div className="graph-card">
            <div className="root-node">
              <span className="branch-icon">⌘</span>
              <div><strong>Patch 8f29d1a</strong><small>equalFolded locale refactor</small></div>
              <span className="risk-chip">RISK 7.4</span>
            </div>
            <div className="stage-list" aria-live="polite">
              {stages.map((stage, index) => {
                const visible = index <= activeStage;
                return (
                  <div className={`stage-row ${visible ? "visible" : "hidden"}`} key={stage.id}>
                    <span className="connector" aria-hidden="true" />
                    <span className={`status-icon ${visible ? stage.status : "pending"}`}>
                      {visible ? (stage.status === "pass" ? "✓" : stage.status === "warn" ? "!" : "×") : "·"}
                    </span>
                    <div className="stage-text"><strong>{stage.label}</strong><small>{visible ? stage.detail : "waiting"}</small></div>
                    <code>{stage.worker}</code>
                    <time>{visible ? stage.duration : "—"}</time>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="finding-card" aria-label="Primary finding">
            <div className="finding-head"><span>COUNTEREXAMPLE #1</span><span className="severity">HIGH</span></div>
            <h3>Locale-sensitive membership changed</h3>
            <p>The patch removed locale-aware case folding. Turkish dotted capital I no longer matches its lowercase form.</p>
            <div className="shrink-flow" aria-live="polite">
              <div className={activeStage >= 5 ? "minimal" : undefined}>
                <small>{shrinkFrame.label}</small>
                <code>{shrinkFrame.value}</code>
              </div>
              <span>↓ {shrinkFrame.progress}</span>
              <div className="trace-note">
                <small>EXECUTABLE SHRINK TRACE</small>
                <code>Every accepted candidate preserves old=true · patched=false</code>
              </div>
            </div>
            <div className="behavior-grid">
              <div><small>OLD · tr-TR</small><strong className="green-text">true</strong><code>&quot;i&quot; === &quot;i&quot;</code></div>
              <div><small>PATCHED</small><strong className="red-text">false</strong><code>&quot;i̇&quot; !== &quot;i&quot;</code></div>
            </div>
            <div className="invariant"><span>PROPERTY</span><code>old(x, y, locale) ⇒ patched(x, y)</code></div>
          </aside>
        </div>
      </section>

      <section className="evidence-section" id="evidence">
        <div className="section-heading">
          <div><span className="kicker">Review packet</span><h2>Evidence, not verdicts.</h2></div>
          <div
            className="tabs"
            role="tablist"
            aria-label="Review packet"
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                const nextTab = tab === "evidence" ? "report" : "evidence";
                setTab(nextTab);
                window.requestAnimationFrame(() => {
                  document.getElementById(
                    nextTab === "evidence" ? "counterexample-tab" : "confidence-tab",
                  )?.focus();
                });
              }
            }}
          >
            <button id="counterexample-tab" role="tab" aria-controls="counterexample-panel" aria-selected={tab === "evidence"} tabIndex={tab === "evidence" ? 0 : -1} onClick={() => setTab("evidence")}>Counterexample</button>
            <button id="confidence-tab" role="tab" aria-controls="confidence-panel" aria-selected={tab === "report"} tabIndex={tab === "report" ? 0 : -1} onClick={() => setTab("report")}>Confidence report</button>
          </div>
        </div>
        {tab === "evidence" ? (
          <div className="evidence-grid" id="counterexample-panel" role="tabpanel" aria-labelledby="counterexample-tab">
            <article><span className="metric-label">VERIFIED</span><strong>2 / 3</strong><p>Existing examples and API shape hold. Locale-invariant behavior does not.</p></article>
            <article><span className="metric-label amber-text">UNVERIFIED</span><strong>2</strong><p>Concurrent cache access and non-BMP normalization remain outside this run’s budget.</p></article>
            <article><span className="metric-label cyan-text">GENERATED TEST</span><strong>1</strong><p><code>test_equal_folded_tr_tr_counterexample</code> is ready to paste into the repository.</p></article>
            <article><span className="metric-label">PERFORMANCE</span><strong>−3.1%</strong><p>Median latency improved; peak allocation is unchanged within measurement noise.</p></article>
            <article><span className="metric-label">API COMPATIBILITY</span><strong className="green-text">Compatible</strong><p>Exports, parameters, and return type are unchanged.</p></article>
            <article className="recommendation"><span className="metric-label">RECOMMENDATION</span><strong>Request changes</strong><p>Restore locale-aware folding and commit the generated regression test.</p></article>
          </div>
        ) : (
          <div className="confidence-panel" id="confidence-panel" role="tabpanel" aria-labelledby="confidence-tab">
            <div className="confidence-score"><strong>82</strong><span>/ 100 evidence confidence</span></div>
            <div className="bar-list">
              <label>Reproducibility <span>100%</span><i><b style={{ width: "100%" }} /></i></label>
              <label>Property coverage <span>74%</span><i><b style={{ width: "74%" }} /></i></label>
              <label>Mutation sensitivity <span>68%</span><i><b style={{ width: "68%" }} /></i></label>
              <label>Environment coverage <span>43%</span><i><b style={{ width: "43%" }} /></i></label>
            </div>
            <p>Confidence is an evidence-quality summary, not a probability that the patch is correct. PatchProof never claims exhaustive verification.</p>
          </div>
        )}
      </section>

      <section className="architecture" id="architecture">
        <span className="kicker">System design</span>
        <h2>Deterministic at the core. Extensible at the edges.</h2>
        <div className="architecture-flow" id="integration-seams">
          <div><span>01</span><strong>PATCH INTAKE</strong><small>diff · metadata · invariants</small></div>
          <b>→</b>
          <div><span>02</span><strong>ORCHESTRATOR</strong><small>typed jobs · fixed seed · budget</small></div>
          <b>→</b>
          <div><span>03</span><strong>VERIFIERS</strong><small>tests · properties · diff · API</small></div>
          <b>→</b>
          <div><span>04</span><strong>PROOF REPORT</strong><small>evidence · gaps · next action</small></div>
        </div>
      </section>

      <footer>
        <div className="brand"><span className="brand-mark" aria-hidden="true">P</span><span>PatchProof</span></div>
        <p>Built to challenge patches, not rubber-stamp them.</p>
        <span>Local MVP · deterministic demo</span>
      </footer>
      <span className="sr-only" aria-live="polite">{completed.length} verification stages complete</span>
    </main>
  );
}
