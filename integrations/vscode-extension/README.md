# PatchProof for VS Code

This extension runs PatchProof’s deterministic Unicode-locale verifier, converts
its executable counterexample into a VS Code diagnostic, and retains the full
JSON report in a dedicated output channel.

## Install

Build the VSIX from the repository root:

```bash
npm run package:vscode
code --install-extension integrations/vscode-extension/dist/patchproof-vscode-0.1.0.vsix
```

Install the Python CLI first:

```bash
python3 -m venv python/.venv
python/.venv/bin/pip install -e python
```

The extension auto-detects `python/.venv/bin/patchproof` (or the Windows
equivalent). Set `patchproof.executable` when the command is elsewhere.

## Commands

- **PatchProof: Run Deterministic Demo** starts the verifier without a shell,
  caps captured output at 1 MiB, and terminates it at the configured timeout.
- **PatchProof: Open Latest Report** opens the output channel for the latest
  report held in this extension session.
- **PatchProof: Clear Diagnostics** removes PatchProof diagnostics.

Starting a process requires a trusted workspace. Report viewing and diagnostic
clearing remain available in restricted mode. Configuration values are
validated before they reach process arguments, and `patchproof.targetFile`
cannot escape the workspace.

## Scope

Version 0.1.0 runs the repository’s built-in executable demo. It does not yet
clone repositories or run arbitrary patches. The VSIX contains no credentials,
telemetry, network client, or update mechanism.
