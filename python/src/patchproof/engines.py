from __future__ import annotations

import unicodedata
from dataclasses import dataclass

TURKISH_TRANSLATION = str.maketrans({"I": "ı", "İ": "i"})


def locale_fold(value: str, locale: str) -> str:
    """Reference behavior for the demo's explicit Turkish contract."""
    normalized_locale = locale.lower().replace("_", "-")
    if normalized_locale.startswith("tr"):
        value = value.translate(TURKISH_TRANSLATION)
    return unicodedata.normalize("NFC", value.casefold())


def patched_fold(value: str) -> str:
    """The subtly wrong patch: locale-independent lowercasing."""
    return value.lower()


def reference_equivalent(left: str, right: str, locale: str) -> bool:
    return locale_fold(left, locale) == locale_fold(right, locale)


def patched_equivalent(left: str, right: str) -> bool:
    return patched_fold(left) == patched_fold(right)


def violates_locale_equivalence(left: str, right: str, locale: str) -> bool:
    return reference_equivalent(left, right, locale) and not patched_equivalent(
        left, right
    )


@dataclass(frozen=True)
class GeneratedCase:
    left: str
    right: str
    source: str


def mutation_guided_cases(locale: str, max_examples: int) -> list[GeneratedCase]:
    """Prioritize inputs aimed at a surviving locale-removal mutant."""
    generic = [
        GeneratedCase("PATCHPROOF", "patchproof", "generic-ascii"),
        GeneratedCase("Straße", "strasse", "unicode-casefold"),
        GeneratedCase("CAFÉ", "café", "composed-accent"),
        GeneratedCase("Σ", "σ", "greek-case"),
    ]
    locale_cases = [
        GeneratedCase("İSTANBUL PORTAL", "istanbul portal", "surviving-locale-mutant"),
        GeneratedCase("İ", "i", "surviving-locale-mutant"),
        GeneratedCase("I", "ı", "surviving-locale-mutant"),
    ]
    ordered = (
        locale_cases + generic
        if locale.lower().startswith("tr")
        else generic + locale_cases
    )
    return ordered[:max_examples]


def minimize_pair(left: str, right: str, locale: str) -> tuple[tuple[str, str], int]:
    """Deterministic paired delta-debugging followed by single-character deletion."""
    minimized, trace = minimize_pair_with_trace(left, right, locale)
    return minimized, len(trace) - 1


def minimize_pair_with_trace(
    left: str, right: str, locale: str
) -> tuple[tuple[str, str], list[tuple[str, str]]]:
    """Return a 1-minimal counterexample and every accepted reduction.

    The trace is executable evidence: each entry still satisfies the same
    divergence predicate, and each accepted edit strictly reduces code points.
    """
    if not violates_locale_equivalence(left, right, locale):
        raise ValueError("input does not demonstrate the target divergence")

    current_left, current_right = left, right
    trace = [(current_left, current_right)]

    # Paired suffix deletion preserves alignment and quickly reaches a local minimum.
    while len(current_left) > 1 and len(current_right) > 1:
        candidate = (current_left[:-1], current_right[:-1])
        if violates_locale_equivalence(*candidate, locale):
            current_left, current_right = candidate
            trace.append(candidate)
        else:
            break

    changed = True
    while changed:
        changed = False
        for side in (0, 1):
            value = current_left if side == 0 else current_right
            for index in range(len(value)):
                candidate_value = value[:index] + value[index + 1 :]
                candidate = (
                    candidate_value if side == 0 else current_left,
                    candidate_value if side == 1 else current_right,
                )
                if candidate_value and violates_locale_equivalence(*candidate, locale):
                    current_left, current_right = candidate
                    trace.append(candidate)
                    changed = True
                    break
            if changed:
                break

    return (current_left, current_right), trace


def generated_pytest(left: str, right: str, locale: str) -> str:
    safe_locale = locale.lower().replace("-", "_")
    return (
        f"def test_equal_folded_{safe_locale}_counterexample():\n"
        f"    assert equal_folded({left!r}, {right!r}, locale={locale!r}) is True"
    )
