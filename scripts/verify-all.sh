#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

npm run build
npm test
npm run lint
npm run typecheck
npm run package:vscode
npm run test:vscode
unzip -t integrations/vscode-extension/dist/patchproof-vscode-0.1.0.vsix >/dev/null
python/.venv/bin/ruff check python
python/.venv/bin/ruff format --check python
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python/.venv/bin/python -m pytest python/tests
python/.venv/bin/patchproof demo --format json >/tmp/patchproof-smoke-report.json
python3 -m json.tool /tmp/patchproof-smoke-report.json >/dev/null
if python/.venv/bin/patchproof demo --fail-on-finding >/dev/null; then
  echo "Expected --fail-on-finding to exit 2." >&2
  exit 1
else
  test "$?" -eq 2
fi

echo "Patch Verification passed."
