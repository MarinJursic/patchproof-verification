from __future__ import annotations

import json
import re
from collections.abc import Callable
from typing import Any
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from .models import VerificationReport, VerificationRequest


class GitHubCheckContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    repository: str = Field(pattern=r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
    head_sha: str = Field(pattern=r"^[0-9a-fA-F]{40}$")
    details_url: HttpUrl | None = None


class GitHubCheckPayloadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    context: GitHubCheckContext
    verification: VerificationRequest = Field(default_factory=VerificationRequest)


def build_check_run(
    report: VerificationReport,
    context: GitHubCheckContext,
) -> dict[str, object]:
    """Build a GitHub Checks API request body without performing network I/O."""
    conclusion = {
        "accept": "success",
        "request_changes": "failure",
        "inconclusive": "neutral",
    }[report.verdict]
    counterexample_lines = [
        f"- `{json.dumps(item.minimized, ensure_ascii=False)}` violates "
        f"**{item.property_name}**"
        for item in report.counterexamples
    ]
    generated_tests = [
        f"```python\n{generated_test}\n```" for generated_test in report.generated_tests
    ]
    compatibility = (
        "Compatible" if report.api_compatibility.compatible else "Incompatible"
    )
    text = "\n\n".join(
        [
            "## Executable counterexamples\n"
            + (
                "\n".join(counterexample_lines)
                if counterexample_lines
                else "None found within this strategy and budget."
            ),
            "## Verified properties\n" + _bullets(report.verified_properties, "None"),
            "## Unverified behavior\n"
            + _bullets(report.unverified_behavior, "None reported"),
            "## Evidence coverage\n"
            + _bullets(
                [
                    "Executable checks: "
                    + ", ".join(report.evidence_coverage.executable_checks),
                    "Fixture checks: "
                    + ", ".join(report.evidence_coverage.fixture_checks),
                    "Properties exercised: "
                    + ", ".join(report.evidence_coverage.properties_exercised),
                    "Counterexample reproduced: "
                    + str(report.evidence_coverage.counterexample_reproduced).lower(),
                    "Regression test generated: "
                    + str(report.evidence_coverage.regression_test_generated).lower(),
                ],
                "No coverage facts reported",
            ),
            "## Generated tests\n"
            + (
                "\n\n".join(generated_tests)
                if generated_tests
                else "No regression test generated."
            ),
            (
                "## Performance\n"
                f"{report.performance.status}: "
                f"{report.performance.delta_percent}% — {report.performance.note}"
            ),
            (
                "## API compatibility\n"
                f"{compatibility} — {report.api_compatibility.note}"
            ),
        ]
    )
    payload: dict[str, object] = {
        "name": "PatchProof",
        "head_sha": context.head_sha,
        "status": "completed",
        "conclusion": conclusion,
        "external_id": report.job_id,
        "output": {
            "title": (
                "Executable counterexample found"
                if report.counterexamples
                else "No counterexample found in budget"
            ),
            "summary": (
                "Executable checks: "
                f"{len(report.evidence_coverage.executable_checks)} · "
                f"fixture checks: {len(report.evidence_coverage.fixture_checks)}\n\n"
                f"{report.recommendation}"
            ),
            "text": text[:65_535],
        },
    }
    if context.details_url is not None:
        payload["details_url"] = str(context.details_url)
    return payload


def render_job_summary(report: VerificationReport) -> str:
    """Render the same evidence as a GitHub Actions job summary."""
    counterexample = (
        json.dumps(report.counterexamples[0].minimized, ensure_ascii=False)
        if report.counterexamples
        else "none found"
    )
    return "\n".join(
        [
            "# PatchProof",
            "",
            f"- Verdict: **{report.verdict.replace('_', ' ').title()}**",
            "- Executable checks: "
            + ", ".join(report.evidence_coverage.executable_checks),
            "- Fixture checks: " + ", ".join(report.evidence_coverage.fixture_checks),
            "- Properties exercised: "
            + ", ".join(report.evidence_coverage.properties_exercised),
            f"- Counterexample: `{counterexample}`",
            f"- Job: `{report.job_id}`",
            "",
            report.recommendation,
            "",
            "> These are named coverage facts, not a correctness probability.",
        ]
    )


def post_check_run(
    payload: dict[str, object],
    *,
    repository: str,
    token: str,
    api_url: str = "https://api.github.com",
    opener: Callable[..., Any] = urlopen,
) -> dict[str, object]:
    """Post a prepared check run using an explicit token supplied by the caller."""
    if not token:
        raise ValueError("a GitHub token is required to post a check run")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
        raise ValueError("repository must use owner/name form")
    parsed_api_url = urlsplit(api_url)
    if (
        parsed_api_url.scheme != "https"
        or not parsed_api_url.netloc
        or parsed_api_url.username is not None
        or parsed_api_url.password is not None
    ):
        raise ValueError("GitHub API URL must be an HTTPS origin without credentials")
    url = f"{api_url.rstrip('/')}/repos/{repository}/check-runs"
    request = Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode(),
        method="POST",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "patchproof/0.1.0",
        },
    )
    with opener(request, timeout=15) as response:
        result = json.loads(response.read().decode())
    if not isinstance(result, dict):
        raise ValueError("GitHub returned a non-object response")
    return result


def _bullets(items: list[str], empty: str) -> str:
    return "\n".join(f"- {item}" for item in items) if items else f"- {empty}"
