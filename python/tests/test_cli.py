import json
import os
import subprocess
import sys


def test_cli_json() -> None:
    result = subprocess.run(
        [sys.executable, "-m", "patchproof.cli", "demo", "--format", "json"],
        check=True,
        capture_output=True,
        text=True,
    )
    report = json.loads(result.stdout)
    assert report["verdict"] == "request_changes"
    assert report["counterexamples"][0]["minimized"] == ["İ", "i"]


def test_cli_fail_on_finding_uses_ci_exit_code_two() -> None:
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "patchproof.cli",
            "demo",
            "--format",
            "json",
            "--fail-on-finding",
        ],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 2
    assert json.loads(result.stdout)["verdict"] == "request_changes"
    assert result.stderr == ""


def test_cli_summary_handles_no_counterexample() -> None:
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "patchproof.cli",
            "demo",
            "--locale",
            "en-US",
            "--max-examples",
            "1",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    assert "INCONCLUSIVE" in result.stdout
    assert "none found within" in result.stdout


def test_cli_rejects_invalid_budget_without_traceback() -> None:
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "patchproof.cli",
            "demo",
            "--max-examples",
            "0",
        ],
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "validation error" in result.stderr.lower()
    assert "traceback" not in result.stderr.lower()


def test_github_check_cli_dry_run_uses_standard_environment() -> None:
    environment = {
        **os.environ,
        "GITHUB_REPOSITORY": "patchproof/demo",
        "GITHUB_SHA": "a" * 40,
    }
    result = subprocess.run(
        [sys.executable, "-m", "patchproof.cli", "github-check"],
        check=True,
        capture_output=True,
        text=True,
        env=environment,
    )
    payload = json.loads(result.stdout)
    assert payload["name"] == "PatchProof"
    assert payload["head_sha"] == "a" * 40
    assert payload["conclusion"] == "failure"
    assert payload["output"]["text"].find("İ") >= 0


def test_github_check_cli_requires_context_and_token_for_post() -> None:
    missing_context = subprocess.run(
        [sys.executable, "-m", "patchproof.cli", "github-check"],
        capture_output=True,
        text=True,
        env={
            key: value
            for key, value in os.environ.items()
            if key not in {"GITHUB_REPOSITORY", "GITHUB_SHA"}
        },
    )
    assert missing_context.returncode == 2
    assert "--repository and --sha are required" in missing_context.stderr

    missing_token = subprocess.run(
        [
            sys.executable,
            "-m",
            "patchproof.cli",
            "github-check",
            "--repository",
            "patchproof/demo",
            "--sha",
            "b" * 40,
            "--post",
        ],
        capture_output=True,
        text=True,
        env={key: value for key, value in os.environ.items() if key != "GITHUB_TOKEN"},
    )
    assert missing_token.returncode == 3
    assert "token is required" in missing_token.stderr
