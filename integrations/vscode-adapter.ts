/**
 * Boundary used by a future VS Code extension.
 * The host extension supplies VS Code's DiagnosticCollection implementation;
 * the verification package remains editor-independent and testable.
 */
export type Finding = {
  file: string;
  line: number;
  message: string;
  severity: "warning" | "error";
};

export type DiagnosticSink = {
  replace(findings: Finding[]): void;
  showReport(jobId: string): void;
};

export type CounterexampleReport = {
  job_id: string;
  counterexamples: Array<{
    property_name: string;
    minimized: [string, string];
  }>;
};

export function toVsCodeFindings(
  report: CounterexampleReport,
  file: string,
  line: number,
): Finding[] {
  return report.counterexamples.map((counterexample) => ({
    file,
    line,
    severity: "error",
    message: `${counterexample.property_name} fails for ${JSON.stringify(counterexample.minimized)}`,
  }));
}

export function publishFindings(
  sink: DiagnosticSink,
  jobId: string,
  findings: Finding[],
) {
  sink.replace(findings);
  sink.showReport(jobId);
}
