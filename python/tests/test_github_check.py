import json

import pytest

from patchproof.github_check import (
    GitHubCheckContext,
    build_check_run,
    post_check_run,
    render_job_summary,
)
from patchproof.models import VerificationRequest
from patchproof.orchestrator import VerificationOrchestrator


def report():
    return VerificationOrchestrator().verify(VerificationRequest())


def test_check_payload_contains_complete_evidence() -> None:
    payload = build_check_run(
        report(),
        GitHubCheckContext(
            repository="patchproof/demo",
            head_sha="c" * 40,
            details_url="https://github.com/patchproof/demo/actions/runs/1",
        ),
    )
    assert payload["status"] == "completed"
    assert payload["conclusion"] == "failure"
    assert payload["external_id"] == "pp_496349FCE8"
    assert payload["details_url"].endswith("/actions/runs/1")
    output = payload["output"]
    assert "Verified properties" in output["text"]
    assert "Unverified behavior" in output["text"]
    assert "Generated tests" in output["text"]
    assert '["İ", "i"]' in output["text"]


def test_job_summary_is_explicit_about_confidence() -> None:
    summary = render_job_summary(report())
    assert "Request Changes" in summary
    assert '["İ", "i"]' in summary
    assert "not correctness probability" in summary


def test_post_uses_checks_endpoint_and_never_logs_token() -> None:
    captured = {}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def read(self):
            return b'{"id": 42, "status": "completed"}'

    def opener(request, timeout):
        captured["url"] = request.full_url
        captured["authorization"] = request.headers["Authorization"]
        captured["body"] = json.loads(request.data)
        captured["timeout"] = timeout
        return FakeResponse()

    payload = {"name": "PatchProof", "head_sha": "d" * 40}
    response = post_check_run(
        payload,
        repository="patchproof/demo",
        token="secret-token",
        opener=opener,
    )
    assert response == {"id": 42, "status": "completed"}
    assert captured["url"].endswith("/repos/patchproof/demo/check-runs")
    assert captured["authorization"] == "Bearer secret-token"
    assert captured["body"] == payload
    assert captured["timeout"] == 15


def test_post_rejects_missing_token_before_network() -> None:
    with pytest.raises(ValueError, match="token is required"):
        post_check_run(
            {},
            repository="patchproof/demo",
            token="",
            opener=lambda *_args, **_kwargs: pytest.fail("network must not run"),
        )


def test_post_rejects_insecure_api_origin_before_network() -> None:
    with pytest.raises(ValueError, match="HTTPS origin"):
        post_check_run(
            {},
            repository="patchproof/demo",
            token="secret",
            api_url="http://github.example.test/api/v3",
            opener=lambda *_args, **_kwargs: pytest.fail("network must not run"),
        )
