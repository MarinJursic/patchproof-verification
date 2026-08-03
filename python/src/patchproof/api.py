from __future__ import annotations

from fastapi import FastAPI, HTTPException

from .github_check import GitHubCheckPayloadRequest, build_check_run
from .models import JobEnvelope, JobStatus, VerificationRequest
from .orchestrator import VerificationOrchestrator

app = FastAPI(
    title="Patch Verification API",
    version="0.1.0",
    description="Typed, deterministic adversarial patch-verification jobs.",
)
orchestrator = VerificationOrchestrator()
jobs: dict[str, JobEnvelope] = {}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "patchproof"}


@app.post("/v1/verify", response_model=JobEnvelope)
def verify(request: VerificationRequest) -> JobEnvelope:
    report = orchestrator.verify(request)
    envelope = JobEnvelope(id=report.job_id, status=JobStatus.COMPLETED, report=report)
    jobs[envelope.id] = envelope
    return envelope


@app.get("/v1/jobs/{job_id}", response_model=JobEnvelope)
def get_job(job_id: str) -> JobEnvelope:
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return job


@app.post("/v1/integrations/github/check-payload")
def github_check_payload(request: GitHubCheckPayloadRequest) -> dict[str, object]:
    """Return a credential-free Checks API payload; never posts externally."""
    report = orchestrator.verify(request.verification)
    return build_check_run(report, request.context)
