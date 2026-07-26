export type EvidenceState = "pass" | "warn" | "fail" | "unverified";

export type EvidenceStage = {
  id: string;
  label: string;
  engine: string;
  state: EvidenceState;
  summary: string;
  duration: string;
  command: string;
  output: string;
  scope: string;
};

export type DiffLine = {
  kind: "context" | "remove" | "add";
  number: number;
  text: string;
};

export type Scenario = {
  id: string;
  shortLabel: string;
  title: string;
  repository: string;
  patchRef: string;
  sourceFile: string;
  verdict: "FALSIFIED";
  question: string;
  diff: DiffLine[];
  stages: EvidenceStage[];
  counterexample: {
    property: string;
    original: string;
    minimized: string;
    reference: string;
    patched: string;
    shrinkTrace: string[];
  };
  generatedTest: string;
  verified: string[];
  unverified: string[];
  provenance: {
    classification:
      | "EXECUTABLE ENGINE RUN"
      | "AUTHORED BUNDLE · EXECUTABLE FIXTURE";
    source: string;
    sourceUrl: string;
    version: string;
    license: string;
    digestInput: string;
    digest: string;
    generatedAt: string;
    note: string;
  };
};

const sharedStages = {
  tests: {
    id: "tests",
    label: "Existing tests",
    engine: "pytest",
    state: "pass",
    duration: "1.20 s",
    command: "pytest -q",
  },
  contracts: {
    id: "contracts",
    label: "Type contracts",
    engine: "pyright",
    state: "pass",
    duration: "0.40 s",
    command: "pyright",
  },
} as const;

export const scenarios: Scenario[] = [
  {
    id: "unicode-turkish-fold",
    shortLabel: "Unicode locale",
    title: "Turkish case folding",
    repository: "search-service",
    patchRef: "8f29d1a",
    sourceFile: "src/search.py",
    verdict: "FALSIFIED",
    question: "Does locale-aware case equality remain equivalent after removing the locale argument?",
    diff: [
      { kind: "context", number: 41, text: "def equal_folded(a: str, b: str, locale: str) -> bool:" },
      { kind: "remove", number: 42, text: "    return locale_lower(a, locale) == locale_lower(b, locale)" },
      { kind: "add", number: 42, text: "    return a.lower() == b.lower()" },
    ],
    stages: [
      { ...sharedStages.tests, summary: "214 / 214 passed", output: "214 passed in 1.20s", scope: "Repository regression suite" },
      { ...sharedStages.contracts, summary: "0 violations", output: "0 errors, 0 warnings", scope: "Export and call-site contracts" },
      { id: "mutation", label: "Mutation probe", engine: "mutator", state: "warn", summary: "Locale branch survived", duration: "1.70 s", command: "patchproof mutate --target equal_folded", output: "SURVIVED replace locale-aware fold with str.lower()", scope: "Changed expression and adjacent branch" },
      { id: "property", label: "Generated property", engine: "property-engine", state: "fail", summary: "Equivalence diverged", duration: "2.10 s", command: "patchproof probe --property locale-equivalence --examples 64", output: "Falsifying example: ('İSTANBUL PORTAL', 'istanbul portal')", scope: "64 mutation-guided Unicode examples" },
      { id: "shrink", label: "Counterexample minimized", engine: "shrinker", state: "fail", summary: "30 → 2 code points", duration: "0.30 s", command: "patchproof shrink pp_496349FCE8", output: "1-minimal after 14 accepted reductions: ('İ', 'i')", scope: "Failure-preserving paired deletion" },
      { id: "differential", label: "Behavior replay", engine: "differential", state: "fail", summary: "Reference true · patch false", duration: "0.10 s", command: "patchproof replay pp_496349FCE8", output: "reference=True patched=False locale=tr-TR", scope: "Same process, seed, and minimized input" },
    ],
    counterexample: {
      property: "locale-aware case equivalence",
      original: '["İSTANBUL PORTAL", "istanbul portal"]',
      minimized: '["İ", "i"]',
      reference: "true · locale_lower(…, 'tr-TR')",
      patched: "false · str.lower()",
      shrinkTrace: ['["İSTANBUL PORTAL", "istanbul portal"]', '["İSTANBUL", "istanbul"]', '["İ", "i"]'],
    },
    generatedTest: `def test_equal_folded_tr_tr_counterexample():
    assert equal_folded("İ", "i", locale="tr-TR") is True`,
    verified: ["Existing examples remain valid", "Public function shape is unchanged", "The minimized input reproduces deterministically"],
    unverified: ["Concurrent cache access", "Non-BMP grapheme clusters", "Locales outside the generated corpus"],
    provenance: {
      classification: "EXECUTABLE ENGINE RUN",
      source: "Unicode Character Database · SpecialCasing",
      sourceUrl: "https://www.unicode.org/Public/UCD/latest/ucd/SpecialCasing.txt",
      version: "Unicode 17.0.0 · seed 20260725",
      license: "Unicode Data Files and Software License",
      digestInput: "patchproof-evidence-v1|unicode-turkish-fold|unicode-17.0.0|seed=20260725|min=İ,i|reference=true|patched=false",
      digest: "sha256:90d4a07510625de769d4d767a085c5473f9af052401f63936fc2363f92f72d6c",
      generatedAt: "2026-07-25T14:34:25Z",
      note: "The Python demo engine executes this locale property and shrinker. The static Pages app only replays the resulting evidence bundle; it does not execute arbitrary repository code.",
    },
  },
  {
    id: "tzdb-ambiguous-fold",
    shortLabel: "DST fold",
    title: "Ambiguous local time",
    repository: "booking-api",
    patchRef: "c7310bd",
    sourceFile: "booking/windows.py",
    verdict: "FALSIFIED",
    question: "Does replacing timezone conversion preserve distinct instants during a daylight-saving fallback?",
    diff: [
      { kind: "context", number: 78, text: "def display_time(instant: datetime, zone: ZoneInfo) -> datetime:" },
      { kind: "remove", number: 79, text: "    return instant.astimezone(zone)" },
      { kind: "add", number: 79, text: "    return instant.astimezone(zone).replace(fold=1)" },
    ],
    stages: [
      { ...sharedStages.tests, summary: "86 / 86 passed", output: "86 passed in 0.84s", scope: "Repository regression suite" },
      { ...sharedStages.contracts, summary: "0 violations", output: "0 errors, 0 warnings", scope: "Datetime return contract" },
      { id: "mutation", label: "Transition probe", engine: "pytest fixture", state: "warn", summary: "Fold forced to second instant", duration: "0.18 s", command: "pytest -q python/tests/test_fixtures.py -k dst_fold", output: "reference keeps fold=0/1; patched forces fold=1/1", scope: "Pinned America/New_York fallback pair" },
      { id: "property", label: "Generated property", engine: "property-engine", state: "fail", summary: "Two instants collapsed", duration: "0.72 s", command: "patchproof probe --property instant-identity --examples 48", output: "Falsifying transition: America/New_York 2025-11-02 01:30", scope: "48 instants around tzdb transitions" },
      { id: "shrink", label: "Counterexample minimized", engine: "shrinker", state: "fail", summary: "6 h window → 1 minute", duration: "0.09 s", command: "patchproof shrink pp_2A630B48D1", output: "fold=0 and fold=1 map to distinct UTC instants", scope: "Minute-resolution transition search" },
      { id: "differential", label: "Behavior replay", engine: "differential", state: "fail", summary: "UTC identity lost", duration: "0.04 s", command: "patchproof replay pp_2A630B48D1", output: "reference: 05:30Z / 06:30Z · patched: 06:30Z / 06:30Z", scope: "IANA tzdb 2026c" },
    ],
    counterexample: {
      property: "distinct instants remain distinct after localization",
      original: "America/New_York · 2025-11-02 · 00:00–06:00",
      minimized: "2025-11-02 01:30 · fold 0 / fold 1",
      reference: "05:30Z / 06:30Z · distinct",
      patched: "06:30Z / 06:30Z · collapsed",
      shrinkTrace: ["6-hour transition window", "30-minute boundary window", "01:30 · fold 0 / fold 1"],
    },
    generatedTest: `def test_display_time_preserves_dst_fold():
    zone = ZoneInfo("America/New_York")
    first_utc = datetime(2025, 11, 2, 5, 30, tzinfo=UTC)
    second_utc = datetime(2025, 11, 2, 6, 30, tzinfo=UTC)
    localized = [display_time(value, zone) for value in (first_utc, second_utc)]
    assert [value.fold for value in localized] == [0, 1]
    assert [value.astimezone(UTC) for value in localized] == [first_utc, second_utc]`,
    verified: ["Behavior outside the transition remains unchanged", "IANA transition data is pinned", "The minimized pair reproduces"],
    unverified: ["Historical pre-1970 transitions", "Leap-second handling", "Zones not present in tzdb 2026c"],
    provenance: {
      classification: "AUTHORED BUNDLE · EXECUTABLE FIXTURE",
      source: "IANA Time Zone Database",
      sourceUrl: "https://www.iana.org/time-zones",
      version: "tzdb 2026c · America/New_York",
      license: "Public-domain tz database",
      digestInput: "patchproof-evidence-v1|tzdb-ambiguous-fold|tzdb-2026c|zone=America/New_York|instants=2025-11-02T05:30Z,2025-11-02T06:30Z|patched=fold1",
      digest: "sha256:d9435c54f21f14e8d4db4630591877f378eb41c5e49b8147ef5beeb3cd736add",
      generatedAt: "2026-07-25T14:36:10Z",
      note: "The reference and patched display_time functions are executable local Python fixtures tested against this pinned fallback pair. The UI stage narrative and durations are authored deterministically, not emitted by the production verifier or executed on GitHub Pages.",
    },
  },
  {
    id: "quixbugs-shortest-path",
    shortLabel: "Shortest path",
    title: "Disconnected graph path",
    repository: "routing-core",
    patchRef: "4be102e",
    sourceFile: "algorithms/shortest_path.py",
    verdict: "FALSIFIED",
    question: "Does the optimization preserve infinity for a destination disconnected from the source?",
    diff: [
      { kind: "context", number: 33, text: "for node in nodes:" },
      { kind: "remove", number: 34, text: "    distance[node] = math.inf" },
      { kind: "add", number: 34, text: "    distance[node] = 0" },
      { kind: "context", number: 35, text: "distance[source] = 0" },
    ],
    stages: [
      { ...sharedStages.tests, summary: "31 / 31 passed", output: "31 passed in 0.31s", scope: "Original example suite" },
      { ...sharedStages.contracts, summary: "0 violations", output: "0 errors, 0 warnings", scope: "Mapping and numeric contracts" },
      { id: "mutation", label: "Boundary probe", engine: "graph-mutator", state: "warn", summary: "Default distance survived", duration: "0.28 s", command: "patchproof mutate --target shortest_path_lengths", output: "SURVIVED replace infinity with zero", scope: "Initialization and disconnected nodes" },
      { id: "property", label: "Generated graph", engine: "property-engine", state: "fail", summary: "Unreachable node reported as zero", duration: "0.46 s", command: "patchproof probe --property reachability --examples 96", output: "Falsifying graph: nodes={A,B}; edges={}", scope: "96 bounded directed graphs" },
      { id: "shrink", label: "Counterexample minimized", engine: "shrinker", state: "fail", summary: "9 nodes → 2 nodes", duration: "0.12 s", command: "patchproof shrink pp_8D14E9B270", output: "1-minimal graph: source=A, destination=B, no edges", scope: "Node and edge deletion" },
      { id: "differential", label: "Behavior replay", engine: "differential", state: "fail", summary: "∞ became 0", duration: "0.03 s", command: "patchproof replay pp_8D14E9B270", output: "reference=inf patched=0", scope: "Bounded graph oracle" },
    ],
    counterexample: {
      property: "unreachable destinations have infinite distance",
      original: "9 nodes · 14 directed edges · B unreachable from A",
      minimized: "nodes={A, B} · edges=∅ · source=A",
      reference: "distance[B] = ∞",
      patched: "distance[B] = 0",
      shrinkTrace: ["9 nodes · 14 edges", "4 nodes · 3 edges", "2 nodes · no edges"],
    },
    generatedTest: `def test_disconnected_destination_is_infinite():
    graph = {"A": {}, "B": {}}
    assert shortest_path_lengths(graph, "A")["B"] == math.inf`,
    verified: ["Connected positive-weight examples still pass", "The two-node graph is 1-minimal", "Reference and patch share the same graph"],
    unverified: ["Negative edge weights", "Concurrent graph mutation", "Graphs beyond the bounded generation budget"],
    provenance: {
      classification: "AUTHORED BUNDLE · EXECUTABLE FIXTURE",
      source: "QuixBugs benchmark shape · original local fixture",
      sourceUrl: "https://github.com/jkoppel/QuixBugs",
      version: "Upstream benchmark consulted 2026-07-26",
      license: "MIT · no upstream source copied",
      digestInput: "patchproof-evidence-v1|quixbugs-shortest-path|local-fixture|nodes=A,B|edges=empty|reference=inf|patched=0",
      digest: "sha256:560abc5319e044846f9492ec46e98a57fce378ce0e19b85d2a7724b9bf7d51b8",
      generatedAt: "2026-07-25T14:38:02Z",
      note: "Executable local Python fixtures reproduce the reference and patched results. The UI stage narrative and durations are authored deterministically. The scenario uses the public benchmark’s problem shape, copies no upstream source, and is not an upstream QuixBugs result.",
    },
  },
];

export const scenarioById = Object.fromEntries(
  scenarios.map((scenario) => [scenario.id, scenario]),
) as Record<string, Scenario>;
