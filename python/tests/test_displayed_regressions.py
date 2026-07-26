from __future__ import annotations

import math
import re
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import pytest

from patchproof.engines import patched_equivalent, reference_equivalent
from patchproof.fixtures import (
    display_time,
    patched_display_time,
    patched_shortest_path_lengths,
    shortest_path_lengths,
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCENARIO_SOURCE = (PROJECT_ROOT / "app/data/scenarios.ts").read_text()
DISPLAYED_REGRESSIONS = re.findall(
    r"generatedTest: `(.*?)`,\n\s+verified:",
    SCENARIO_SOURCE,
    flags=re.DOTALL,
)


def execute_displayed_regression(
    source: str,
    changed_name: str,
    implementation: Callable[..., Any],
    dependencies: dict[str, Any],
) -> None:
    namespace = {changed_name: implementation, **dependencies}
    exec(compile(source, "<displayed-regression>", "exec"), namespace)
    test_name = next(name for name in namespace if name.startswith("test_"))
    namespace[test_name]()


def reference_equal_folded(left: str, right: str, locale: str) -> bool:
    return reference_equivalent(left, right, locale)


def patched_equal_folded(left: str, right: str, locale: str) -> bool:
    del locale
    return patched_equivalent(left, right)


@pytest.mark.parametrize(
    (
        "index",
        "changed_name",
        "reference",
        "patched",
        "dependencies",
    ),
    [
        (
            0,
            "equal_folded",
            reference_equal_folded,
            patched_equal_folded,
            {},
        ),
        (
            1,
            "display_time",
            display_time,
            patched_display_time,
            {"UTC": UTC, "datetime": datetime, "ZoneInfo": ZoneInfo},
        ),
        (
            2,
            "shortest_path_lengths",
            shortest_path_lengths,
            patched_shortest_path_lengths,
            {"math": math},
        ),
    ],
)
def test_displayed_regression_passes_reference_and_fails_patch(
    index: int,
    changed_name: str,
    reference: Callable[..., Any],
    patched: Callable[..., Any],
    dependencies: dict[str, Any],
) -> None:
    assert len(DISPLAYED_REGRESSIONS) == 3
    source = DISPLAYED_REGRESSIONS[index]

    execute_displayed_regression(source, changed_name, reference, dependencies)
    with pytest.raises(AssertionError):
        execute_displayed_regression(source, changed_name, patched, dependencies)
