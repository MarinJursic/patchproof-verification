import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile, stat } from "node:fs/promises";
import Module, { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);

test("manifest exposes three commands and restricted workspace support", async () => {
  const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(manifest.main, "./dist/extension.cjs");
  assert.equal(manifest.capabilities.untrustedWorkspaces.supported, "limited");
  assert.deepEqual(
    manifest.contributes.commands.map((item) => item.command),
    [
      "patchproof.runDemo",
      "patchproof.openReport",
      "patchproof.clearDiagnostics",
    ],
  );
});

test("runtime has explicit trust, process, and diagnostic controls", async () => {
  const source = await readFile(new URL("src/extension.ts", root), "utf8");
  assert.match(source, /workspace\.isTrusted/);
  assert.match(source, /spawn\(executable, args/);
  assert.match(source, /shell: false/);
  assert.match(source, /MAX_OUTPUT_BYTES/);
  assert.match(source, /child\.kill\(\)/);
  assert.match(source, /publishFindings\(sink/);
  assert.match(source, /createDiagnosticCollection\("patchproof"\)/);
  assert.match(source, /targetFile must stay within the workspace/);
});

test("build and VSIX artifacts are nonempty", async () => {
  const bundle = await stat(new URL("dist/extension.cjs", root));
  const vsix = await stat(
    new URL("dist/patchproof-vscode-0.1.0.vsix", root),
  );
  assert.ok(bundle.size > 1_000);
  assert.ok(vsix.size > 1_000);
});

test("bundled extension activates and publishes a real report through the host", async () => {
  const commands = new Map();
  const outputLines = [];
  const diagnosticWrites = [];
  const spawnCalls = [];
  const report = {
    job_id: "pp_TEST",
    verdict: "request_changes",
    confidence: 82,
    recommendation: "Restore locale-aware folding.",
    counterexamples: [
      {
        property_name: "locale-aware case equivalence",
        minimized: ["İ", "i"],
      },
    ],
  };
  const output = {
    appendLine(value) {
      outputLines.push(value);
    },
    clear() {},
    dispose() {},
    show() {},
  };
  const collection = {
    clear() {},
    dispose() {},
    set(values) {
      diagnosticWrites.push(values);
    },
  };
  class Diagnostic {
    constructor(range, message, severity) {
      this.range = range;
      this.message = message;
      this.severity = severity;
    }
  }
  class Range {
    constructor(startLine, startCharacter, endLine, endCharacter) {
      Object.assign(this, {
        startLine,
        startCharacter,
        endLine,
        endCharacter,
      });
    }
  }
  const workspacePath = dirname(fileURLToPath(root));
  const vscode = {
    commands: {
      registerCommand(name, callback) {
        commands.set(name, callback);
        return { dispose() {} };
      },
    },
    window: {
      createOutputChannel() {
        return output;
      },
      async showErrorMessage() {},
      async showInformationMessage() {},
      async showWarningMessage() {},
    },
    languages: {
      createDiagnosticCollection() {
        return collection;
      },
    },
    workspace: {
      isTrusted: true,
      workspaceFolders: [{ uri: { fsPath: workspacePath } }],
      getConfiguration() {
        return {
          get(_name, fallback) {
            return fallback;
          },
        };
      },
    },
    Uri: {
      file(file) {
        return { fsPath: file };
      },
      joinPath(uri, relative) {
        return { fsPath: join(uri.fsPath, relative) };
      },
    },
    Diagnostic,
    DiagnosticSeverity: { Error: 0, Warning: 1 },
    Range,
  };
  const fakeChildProcess = {
    spawn(executable, args, options) {
      spawnCalls.push({ executable, args, options });
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = () => true;
      queueMicrotask(() => {
        child.stdout.emit("data", Buffer.from(JSON.stringify(report)));
        child.emit("close", 0, null);
      });
      return child;
    },
  };
  const originalLoad = Module._load;
  Module._load = function load(request, parent, isMain) {
    if (request === "vscode") return vscode;
    if (request === "node:child_process") return fakeChildProcess;
    return originalLoad.call(this, request, parent, isMain);
  };
  const require = createRequire(import.meta.url);
  const extension = require("../dist/extension.cjs");
  Module._load = originalLoad;
  const context = { subscriptions: [] };
  extension.activate(context);

  await commands.get("patchproof.runDemo")();

  assert.equal(context.subscriptions.length, 5);
  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0].options.shell, false);
  assert.equal(spawnCalls[0].options.stdio[0], "ignore");
  assert.equal(diagnosticWrites.length, 1);
  assert.equal(diagnosticWrites[0][0][1][0].message.includes("[\"İ\",\"i\"]"), true);
  assert.equal(outputLines.some((line) => line.includes("pp_TEST")), true);
  assert.equal(
    outputLines.some((line) => line.includes("Evidence confidence: 82/100")),
    true,
  );
});
