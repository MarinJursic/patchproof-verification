import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, isAbsolute, join, normalize, sep } from "node:path";
import * as vscode from "vscode";

import {
  publishFindings,
  toVsCodeFindings,
  type DiagnosticSink,
  type Finding,
} from "../../vscode-adapter";

const MAX_OUTPUT_BYTES = 1_048_576;

type VerificationReport = {
  job_id: string;
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
  counterexamples: Array<{
    property_name: string;
    minimized: [string, string];
  }>;
};

let latestReport: VerificationReport | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Patch Verification", { log: true });
  const diagnostics =
    vscode.languages.createDiagnosticCollection("patchproof");
  const sink = createDiagnosticSink(diagnostics, output);

  const run = vscode.commands.registerCommand("patchproof.runDemo", async () => {
    if (!vscode.workspace.isTrusted) {
      await vscode.window.showWarningMessage(
        "Patch Verification will not start a process until this workspace is trusted.",
      );
      return;
    }
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      await vscode.window.showErrorMessage(
        "Open a workspace folder before running Patch Verification.",
      );
      return;
    }

    output.clear();
    output.appendLine("[Patch Verification] Starting deterministic verification.");
    try {
      const report = await runVerifier(folder, output);
      latestReport = report;
      const targetFile = safeTargetFile(
        vscode.workspace
          .getConfiguration("patchproof", folder.uri)
          .get("targetFile", "src/search.py"),
      );
      const findings = toVsCodeFindings(
        report,
        vscode.Uri.joinPath(folder.uri, targetFile).fsPath,
        1,
      );
      publishFindings(sink, report.job_id, findings);
      appendReport(output, report);
      const action = await vscode.window.showInformationMessage(
        `Patch Verification: ${report.verdict.replace("_", " ")} · ${report.evidence_coverage.executable_checks.length} executable checks, ${report.evidence_coverage.fixture_checks.length} fixture checks.`,
        "Open report",
      );
      if (action === "Open report") output.show(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      output.appendLine(`[Patch Verification] Failed: ${message}`);
      output.show(true);
      await vscode.window.showErrorMessage(`Patch Verification failed: ${message}`);
    }
  });

  const open = vscode.commands.registerCommand(
    "patchproof.openReport",
    async () => {
      if (!latestReport) {
        await vscode.window.showInformationMessage(
          "Patch Verification has no report in this extension session.",
        );
        return;
      }
      output.show(true);
    },
  );

  const clear = vscode.commands.registerCommand(
    "patchproof.clearDiagnostics",
    () => {
      diagnostics.clear();
      output.appendLine("[Patch Verification] Diagnostics cleared.");
    },
  );

  context.subscriptions.push(output, diagnostics, run, open, clear);
}

function runVerifier(
  folder: vscode.WorkspaceFolder,
  output: vscode.LogOutputChannel,
): Promise<VerificationReport> {
  const configuration = vscode.workspace.getConfiguration(
    "patchproof",
    folder.uri,
  );
  const executable = resolveExecutable(
    folder.uri.fsPath,
    configuration.get("executable", ""),
  );
  const locale = safeLocale(configuration.get("locale", "tr-TR"));
  const maxExamples = clampInteger(
    configuration.get("maxExamples", 64),
    1,
    10_000,
  );
  const timeoutMs = clampInteger(
    configuration.get("timeoutMs", 30_000),
    1_000,
    120_000,
  );
  const args = [
    "demo",
    "--format",
    "json",
    "--locale",
    locale,
    "--max-examples",
    String(maxExamples),
  ];

  output.appendLine(
    `[Patch Verification] Executing ${executable} ${args.join(" ")} (shell disabled).`,
  );
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: folder.uri.fsPath,
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let settled = false;

    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const capture = (target: "stdout" | "stderr", chunk: Buffer): void => {
      outputBytes += chunk.byteLength;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill();
        finish(() =>
          reject(
            new Error(
              `verifier output exceeded ${MAX_OUTPUT_BYTES} bytes and was terminated`,
            ),
          ),
        );
        return;
      }
      if (target === "stdout") stdout += chunk.toString();
      else stderr += chunk.toString();
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(() =>
        reject(new Error(`verifier exceeded the ${timeoutMs} ms timeout`)),
      );
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => capture("stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => capture("stderr", chunk));
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code, signal) => {
      finish(() => {
        if (code !== 0) {
          reject(
            new Error(
              `verifier exited with code ${String(code)} signal ${String(signal)}: ${stderr.trim()}`,
            ),
          );
          return;
        }
        try {
          resolve(parseReport(stdout));
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    });
  });
}

function resolveExecutable(workspace: string, configured: string): string {
  const requested = configured.trim();
  if (requested) {
    if (requested.includes(delimiter)) {
      throw new Error(
        "patchproof.executable must be one command or path, not a PATH list",
      );
    }
    return requested;
  }
  const candidates =
    process.platform === "win32"
      ? [join(workspace, "python", ".venv", "Scripts", "patchproof.exe")]
      : [join(workspace, "python", ".venv", "bin", "patchproof")];
  return candidates.find((candidate) => existsSync(candidate)) ?? "patchproof";
}

function parseReport(value: string): VerificationReport {
  const report = JSON.parse(value) as Partial<VerificationReport>;
  if (
    typeof report.job_id !== "string" ||
    typeof report.evidence_coverage !== "object" ||
    !Array.isArray(report.evidence_coverage?.executable_checks) ||
    !Array.isArray(report.evidence_coverage?.fixture_checks) ||
    !Array.isArray(report.counterexamples) ||
    typeof report.recommendation !== "string" ||
    !["accept", "request_changes", "inconclusive"].includes(
      report.verdict ?? "",
    )
  ) {
    throw new Error("verifier returned an invalid Patch Verification report");
  }
  return report as VerificationReport;
}

function createDiagnosticSink(
  diagnostics: vscode.DiagnosticCollection,
  output: vscode.LogOutputChannel,
): DiagnosticSink {
  return {
    replace(findings: Finding[]): void {
      diagnostics.clear();
      const grouped = new Map<string, vscode.Diagnostic[]>();
      for (const finding of findings) {
        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(
            Math.max(0, finding.line - 1),
            0,
            Math.max(0, finding.line - 1),
            1,
          ),
          finding.message,
          finding.severity === "error"
            ? vscode.DiagnosticSeverity.Error
            : vscode.DiagnosticSeverity.Warning,
        );
        diagnostic.source = "Patch Verification";
        const values = grouped.get(finding.file) ?? [];
        values.push(diagnostic);
        grouped.set(finding.file, values);
      }
      diagnostics.set(
        [...grouped].map(([file, values]) => [vscode.Uri.file(file), values]),
      );
    },
    showReport(jobId: string): void {
      output.appendLine(`[Patch Verification] Report ${jobId}`);
      output.show(true);
    },
  };
}

function appendReport(
  output: vscode.LogOutputChannel,
  report: VerificationReport,
): void {
  output.appendLine(`[Patch Verification] Verdict: ${report.verdict}`);
  output.appendLine(
    `[Patch Verification] Executable checks: ${report.evidence_coverage.executable_checks.join(", ")}`,
  );
  output.appendLine(
    `[Patch Verification] Fixture checks: ${report.evidence_coverage.fixture_checks.join(", ")}`,
  );
  output.appendLine(`[Patch Verification] ${report.recommendation}`);
  output.appendLine(JSON.stringify(report, null, 2));
}

function safeTargetFile(value: string): string {
  const normalized = normalize(value.trim());
  if (
    !normalized ||
    isAbsolute(normalized) ||
    normalized === ".." ||
    normalized.startsWith(`..${sep}`)
  ) {
    throw new Error("patchproof.targetFile must stay within the workspace");
  }
  return normalized;
}

function safeLocale(value: string): string {
  const locale = value.trim();
  if (!/^[A-Za-z]{2,8}(?:[-_][A-Za-z0-9]{1,8})*$/.test(locale)) {
    throw new Error("patchproof.locale is invalid");
  }
  return locale;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isInteger(value)) {
    throw new Error("Patch Verification numeric configuration must use integers");
  }
  return Math.min(maximum, Math.max(minimum, value));
}
