from datetime import UTC, datetime
from math import inf
from zoneinfo import ZoneInfo

from patchproof.fixtures import (
    display_time,
    patched_display_time,
    patched_shortest_path_lengths,
    shortest_path_lengths,
)


def test_dst_fold_fixture_calls_display_time_and_preserves_two_instants() -> None:
    zone = ZoneInfo("America/New_York")
    first_utc = datetime(2025, 11, 2, 5, 30, tzinfo=UTC)
    second_utc = datetime(2025, 11, 2, 6, 30, tzinfo=UTC)

    reference = [display_time(instant, zone) for instant in (first_utc, second_utc)]
    patched = [
        patched_display_time(instant, zone) for instant in (first_utc, second_utc)
    ]

    assert [value.fold for value in reference] == [0, 1]
    assert [value.fold for value in patched] == [1, 1]
    assert [value.astimezone(UTC) for value in reference] == [first_utc, second_utc]
    assert [value.astimezone(UTC) for value in patched] == [second_utc, second_utc]


def test_shortest_path_fixture_keeps_disconnected_distance_infinite() -> None:
    graph = {"A": {}, "B": {}}
    assert shortest_path_lengths(graph, "A")["B"] == inf
    assert patched_shortest_path_lengths(graph, "A")["B"] == 0
