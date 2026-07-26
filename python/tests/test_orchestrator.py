from fastapi.testclient import TestClient

from patchproof.api import app, jobs
from patchproof.models import VerificationRequest
from patchproof.orchestrator import VerificationOrchestrator


def test_report_is_complete_and_reproducible() -> None:
    request = VerificationRequest()
    first = VerificationOrchestrator().verify(request)
    second = VerificationOrchestrator().verify(request)
    assert first.model_dump() == second.model_dump()
    assert first.verdict == "request_changes"
    assert first.counterexamples[0].minimized == ("İ", "i")
    assert first.generated_tests
    assert first.api_compatibility.compatible
    assert first.performance.delta_percent == -3.1
    assert len(first.unverified_behavior) == 2
    assert first.evidence_coverage.executable_checks == [
        "generated-property",
        "counterexample-shrink",
        "behavioral-diff",
    ]
    assert first.evidence_coverage.fixture_checks == [
        "existing-tests",
        "type-contracts",
        "mutation-probe",
    ]
    assert first.evidence_coverage.counterexample_reproduced
    assert first.evidence_coverage.regression_test_generated
    assert first.counterexamples[0].shrink_steps == 14
    assert len(first.counterexamples[0].shrink_trace) == 15
    assert {check.id for check in first.checks} == {
        "existing-tests",
        "type-contracts",
        "mutation-probe",
        "generated-property",
        "counterexample-shrink",
        "behavioral-diff",
    }


def test_api_smoke_flow() -> None:
    jobs.clear()
    client = TestClient(app)
    assert client.get("/health").json()["status"] == "ok"
    created = client.post("/v1/verify", json={}).json()
    assert created["status"] == "completed"
    job_id = created["id"]
    fetched = client.get(f"/v1/jobs/{job_id}")
    assert fetched.status_code == 200
    assert fetched.json()["report"]["counterexamples"][0]["minimized"] == ["İ", "i"]


def test_missing_job_is_404() -> None:
    assert TestClient(app).get("/v1/jobs/missing").status_code == 404


def test_job_identity_covers_material_request_fields() -> None:
    orchestrator = VerificationOrchestrator()
    baseline = orchestrator.verify(VerificationRequest())
    changed_locale = orchestrator.verify(VerificationRequest(locale="en-US"))
    changed_budget = orchestrator.verify(VerificationRequest(max_examples=1))
    changed_base = orchestrator.verify(VerificationRequest(base_ref="release"))
    assert (
        len(
            {
                baseline.job_id,
                changed_locale.job_id,
                changed_budget.job_id,
                changed_base.job_id,
            }
        )
        == 4
    )


def test_no_finding_report_is_honest_and_inconclusive() -> None:
    report = VerificationOrchestrator().verify(
        VerificationRequest(locale="en-US", max_examples=1)
    )
    assert report.verdict == "inconclusive"
    assert report.counterexamples == []
    assert report.generated_tests == []
    assert report.evidence_coverage.counterexample_reproduced is False
    assert report.evidence_coverage.regression_test_generated is False
    assert report.evidence_coverage.executable_checks == ["generated-property"]
    assert "Expand the verification budget" in report.recommendation


def test_api_rejects_invalid_and_unsupported_requests() -> None:
    client = TestClient(app)
    assert client.post("/v1/verify", json={"max_examples": 0}).status_code == 422
    assert (
        client.post(
            "/v1/verify",
            json={"patch": "diff --git a/file.py b/file.py"},
        ).status_code
        == 422
    )
    assert client.post("/v1/verify", json={"unexpected": True}).status_code == 422


def test_api_builds_github_payload_without_credentials() -> None:
    response = TestClient(app).post(
        "/v1/integrations/github/check-payload",
        json={
            "context": {
                "repository": "patchproof/demo",
                "head_sha": "e" * 40,
            }
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["head_sha"] == "e" * 40
    assert payload["conclusion"] == "failure"
    assert payload["external_id"] == "pp_496349FCE8"
