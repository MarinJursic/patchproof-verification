from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class CheckStatus(StrEnum):
    PASS = "pass"
    WARN = "warn"
    FAIL = "fail"
    UNVERIFIED = "unverified"


class VerificationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    repository: str = Field(default="demo/search-service", min_length=1)
    base_ref: str = Field(default="main", min_length=1)
    patch_ref: str = Field(default="8f29d1a", min_length=1)
    patch: Literal["demo://unicode-locale-regression"] = (
        "demo://unicode-locale-regression"
    )
    locale: str = Field(default="tr-TR", min_length=1)
    seed: int = 20260725
    max_examples: int = Field(default=64, ge=1, le=10_000)


class CheckResult(BaseModel):
    id: str
    label: str
    status: CheckStatus
    detail: str
    duration_ms: int = Field(ge=0)
    evidence: dict[str, object] = Field(default_factory=dict)


class Counterexample(BaseModel):
    property_name: str
    original: tuple[str, str]
    minimized: tuple[str, str]
    shrink_steps: int
    shrink_trace: list[tuple[str, str]]
    locale: str
    old_result: bool
    patched_result: bool
    reproducer: str


class PerformanceReport(BaseModel):
    metric: str = "median latency"
    delta_percent: float
    status: Literal["improved", "regressed", "neutral"]
    note: str


class ApiCompatibilityReport(BaseModel):
    compatible: bool
    changed_exports: list[str] = Field(default_factory=list)
    note: str


class VerificationReport(BaseModel):
    job_id: str
    status: JobStatus
    verdict: Literal["accept", "request_changes", "inconclusive"]
    confidence: int = Field(ge=0, le=100)
    seed: int
    checks: list[CheckResult]
    verified_properties: list[str]
    unverified_behavior: list[str]
    generated_tests: list[str]
    counterexamples: list[Counterexample]
    performance: PerformanceReport
    api_compatibility: ApiCompatibilityReport
    recommendation: str
    started_at: datetime
    completed_at: datetime

    @classmethod
    def timestamp(cls) -> datetime:
        return datetime.now(UTC)


class JobEnvelope(BaseModel):
    id: str
    status: JobStatus
    report: VerificationReport | None = None
