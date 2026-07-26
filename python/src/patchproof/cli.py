from __future__ import annotations

import argparse
import json
import os
import sys
from urllib.error import HTTPError, URLError

from pydantic import ValidationError

from .github_check import (
    GitHubCheckContext,
    build_check_run,
    post_check_run,
    render_job_summary,
)
from .models import VerificationReport, VerificationRequest
from .orchestrator import VerificationOrchestrator


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(
        prog="patchproof",
        description=(
            "Attempt to disprove a patch with deterministic executable evidence."
        ),
    )
    commands = root.add_subparsers(dest="command", required=True)
    demo = commands.add_parser("demo", help="run the built-in Unicode/locale patch")
    demo.add_argument("--locale", default="tr-TR")
    demo.add_argument("--seed", type=int, default=20260725)
    demo.add_argument("--max-examples", type=int, default=64)
    demo.add_argument("--format", choices=("summary", "json"), default="summary")
    demo.add_argument(
        "--fail-on-finding",
        action="store_true",
        help="exit 2 when an executable counterexample is found",
    )
    github = commands.add_parser(
        "github-check",
        help="build or post a GitHub Checks API payload for the demo evidence",
    )
    github.add_argument("--repository", default=os.getenv("GITHUB_REPOSITORY"))
    github.add_argument("--sha", default=os.getenv("GITHUB_SHA"))
    github.add_argument("--details-url", default=_default_github_details_url())
    github.add_argument("--locale", default="tr-TR")
    github.add_argument("--seed", type=int, default=20260725)
    github.add_argument("--max-examples", type=int, default=64)
    github.add_argument(
        "--post",
        action="store_true",
        help="post using GITHUB_TOKEN; default behavior is a credential-free dry run",
    )
    github.add_argument(
        "--summary",
        action="store_true",
        help="print GitHub Actions job-summary Markdown instead of payload JSON",
    )
    github.add_argument(
        "--api-url",
        default=os.getenv("GITHUB_API_URL", "https://api.github.com"),
        help="GitHub API origin, including a GitHub Enterprise API origin",
    )
    return root


def summary(report: VerificationReport) -> str:
    data = report.model_dump(mode="json")
    coverage = data["evidence_coverage"]
    lines = [
        f"PatchProof {data['job_id']} · {data['verdict'].upper()}",
        "coverage: executable="
        + ",".join(coverage["executable_checks"])
        + " · fixtures="
        + ",".join(coverage["fixture_checks"]),
        "coverage facts: "
        f"counterexample_reproduced={coverage['counterexample_reproduced']} · "
        f"regression_test_generated={coverage['regression_test_generated']}",
    ]
    if data["counterexamples"]:
        counterexample = data["counterexamples"][0]
        lines.extend(
            [
                (
                    f"counterexample: {counterexample['minimized']!r} "
                    f"· locale {counterexample['locale']}"
                ),
                (
                    f"behavior: reference={counterexample['old_result']} "
                    f"patched={counterexample['patched_result']}"
                ),
            ]
        )
    else:
        lines.append(
            "counterexample: none found within the configured strategy and budget"
        )
    lines.append(f"recommendation: {data['recommendation']}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if args.command == "demo":
        try:
            request = VerificationRequest(
                locale=args.locale,
                seed=args.seed,
                max_examples=args.max_examples,
            )
        except ValidationError as error:
            print(f"patchproof: validation error: {error}", file=sys.stderr)
            return 2
        report = VerificationOrchestrator().verify(request)
        if args.format == "json":
            print(report.model_dump_json(indent=2))
        else:
            print(summary(report))
        if args.fail_on_finding and report.counterexamples:
            return 2
        return 0
    if args.command == "github-check":
        if not args.repository or not args.sha:
            print(
                "patchproof: validation error: --repository and --sha are required "
                "(or set GITHUB_REPOSITORY and GITHUB_SHA)",
                file=sys.stderr,
            )
            return 2
        try:
            request = VerificationRequest(
                locale=args.locale,
                seed=args.seed,
                max_examples=args.max_examples,
            )
            context = GitHubCheckContext(
                repository=args.repository,
                head_sha=args.sha,
                details_url=args.details_url,
            )
        except ValidationError as error:
            print(f"patchproof: validation error: {error}", file=sys.stderr)
            return 2
        report = VerificationOrchestrator().verify(request)
        payload = build_check_run(report, context)
        if args.summary:
            print(render_job_summary(report))
            return 0
        if not args.post:
            print(json.dumps(payload, ensure_ascii=False, indent=2))
            return 0
        token = os.getenv("GITHUB_TOKEN", "")
        try:
            response = post_check_run(
                payload,
                repository=context.repository,
                token=token,
                api_url=args.api_url,
            )
        except (HTTPError, URLError, OSError, ValueError) as error:
            print(f"patchproof: GitHub check post failed: {error}", file=sys.stderr)
            return 3
        print(json.dumps(response, ensure_ascii=False, indent=2))
        return 0
    return 1


def _default_github_details_url() -> str | None:
    server = os.getenv("GITHUB_SERVER_URL")
    repository = os.getenv("GITHUB_REPOSITORY")
    run_id = os.getenv("GITHUB_RUN_ID")
    if server and repository and run_id:
        return f"{server.rstrip('/')}/{repository}/actions/runs/{run_id}"
    return None


if __name__ == "__main__":
    sys.exit(main())
