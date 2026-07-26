"""Small executable fixtures backing the non-engine UI evidence cases.

These are intentionally separate from the production demo orchestrator. They make
the reference/patched behavior independently reproducible without claiming that the
authored UI timings were emitted by a live verification run.
"""

from __future__ import annotations

import math
from collections.abc import Mapping
from datetime import datetime
from zoneinfo import ZoneInfo


def display_time(instant: datetime, zone: ZoneInfo) -> datetime:
    """Reference conversion that preserves PEP 495 fold identity."""

    return instant.astimezone(zone)


def patched_display_time(instant: datetime, zone: ZoneInfo) -> datetime:
    """Faulty patch that normalizes both ambiguous instants to fold=1."""

    return instant.astimezone(zone).replace(fold=1)


Graph = Mapping[str, Mapping[str, float]]


def shortest_path_lengths(graph: Graph, source: str) -> dict[str, float]:
    """Reference Dijkstra baseline with infinity for disconnected nodes."""

    distance = {node: math.inf for node in graph}
    distance[source] = 0.0
    unvisited = set(graph)
    while unvisited:
        node = min(unvisited, key=lambda candidate: distance[candidate])
        unvisited.remove(node)
        if math.isinf(distance[node]):
            break
        for neighbor, weight in graph[node].items():
            if neighbor in distance:
                distance[neighbor] = min(distance[neighbor], distance[node] + weight)
    return distance


def patched_shortest_path_lengths(graph: Graph, source: str) -> dict[str, float]:
    """Faulty patch whose zero initialization erases unreachable state."""

    distance = {node: 0.0 for node in graph}
    distance[source] = 0.0
    return distance
