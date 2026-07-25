import pytest

from patchproof.engines import (
    generated_pytest,
    locale_fold,
    minimize_pair,
    minimize_pair_with_trace,
    mutation_guided_cases,
    patched_fold,
    reference_equivalent,
    violates_locale_equivalence,
)


def test_turkish_dotted_i_diverges() -> None:
    assert locale_fold("İ", "tr-TR") == locale_fold("i", "tr-TR")
    assert patched_fold("İ") != patched_fold("i")
    assert violates_locale_equivalence("İ", "i", "tr-TR")


def test_counterexample_shrinks_deterministically() -> None:
    minimized, steps = minimize_pair("İSTANBUL PORTAL", "istanbul portal", "tr-TR")
    assert minimized == ("İ", "i")
    assert steps == 14


def test_shrink_trace_is_strict_and_preserves_the_failure() -> None:
    minimized, trace = minimize_pair_with_trace(
        "İSTANBUL PORTAL", "istanbul portal", "tr-TR"
    )
    assert trace[0] == ("İSTANBUL PORTAL", "istanbul portal")
    assert trace[-1] == minimized == ("İ", "i")
    sizes = [len(left) + len(right) for left, right in trace]
    assert all(after < before for before, after in zip(sizes, sizes[1:], strict=False))
    assert all(violates_locale_equivalence(*pair, "tr-TR") for pair in trace)


def test_minimizer_rejects_non_failing_input() -> None:
    with pytest.raises(ValueError, match="does not demonstrate"):
        minimize_pair("PATCHPROOF", "patchproof", "tr-TR")


def test_mutation_guidance_prioritizes_locale_cases() -> None:
    cases = mutation_guided_cases("tr-TR", 3)
    assert cases[0].source == "surviving-locale-mutant"
    assert any(violates_locale_equivalence(c.left, c.right, "tr-TR") for c in cases)


def test_locale_variants_and_non_turkish_behavior_are_explicit() -> None:
    assert reference_equivalent("I", "ı", "tr_TR")
    assert reference_equivalent("I", "ı", "TR-tr")
    assert not reference_equivalent("I", "ı", "en-US")
    assert not violates_locale_equivalence("PATCHPROOF", "patchproof", "tr-TR")


def test_generated_test_is_valid_and_uses_a_safe_name() -> None:
    generated = generated_pytest("İ", "i", "tr-TR")
    compile(generated, "<generated-test>", "exec")
    assert generated.startswith("def test_equal_folded_tr_tr_counterexample")
    assert "locale='tr-TR'" in generated
