import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("PatchProof workbench exposes replay controls, evidence semantics, and three sourced cases", async () => {
  const [page, scenarios, layout, styles] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/data/scenarios.ts", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(layout, /PatchProof — Adversarial Software Verification/);
  assert.doesNotMatch(layout, /starter-preview|Your site is taking shape/);
  assert.doesNotMatch(layout, /next\/headers|x-forwarded-host/);
  assert.match(layout, /NEXT_PUBLIC_SITE_URL/);
  assert.match(layout, /NEXT_PUBLIC_BASE_PATH/);
  assert.match(layout, /patchproof-workbench\.jpg/);
  assert.match(scenarios, /EXECUTABLE ENGINE RUN/);
  assert.match(scenarios, /AUTHORED BUNDLE · EXECUTABLE FIXTURE/);
  assert.match(page, /Replay/);
  assert.match(page, /Pause/);
  assert.match(page, /Step →/);
  assert.match(page, /Export JSON/);
  assert.match(page, /GENERATED REGRESSION/);
  assert.match(page, /No correctness probability is inferred/);
  assert.match(page, /Evidence source:/);
  assert.match(page, /This describes provenance, not the patch verdict/);
  assert.match(page, /Patch verdict/);
  assert.doesNotMatch(page, /Reviewed evidence/);
  assert.match(styles, /\.recorded-badge i[\s\S]*background: var\(--brand\)/);
  assert.match(page, /EXECUTION TRACE/);
  assert.match(page, /aria-current=\{selected \? "step"/);
  assert.match(scenarios, /unicode-turkish-fold/);
  assert.match(scenarios, /tzdb-ambiguous-fold/);
  assert.match(scenarios, /quixbugs-shortest-path/);
  assert.match(scenarios, /Unicode Character Database/);
  assert.match(scenarios, /IANA Time Zone Database/);
  assert.match(scenarios, /no upstream source copied/);
  assert.match(scenarios, /30 → 2 code points/);
  assert.match(scenarios, /14 accepted reductions/);
  const digestInputs = [...scenarios.matchAll(/digestInput: "([^"]+)"/g)].map((match) => match[1]);
  const digests = [...scenarios.matchAll(/digest: "sha256:([0-9a-f]+)"/g)].map((match) => match[1]);
  assert.equal(digestInputs.length, 3);
  assert.equal(digests.length, 3);
  assert.deepEqual(
    digests,
    digestInputs.map((value) => createHash("sha256").update(value).digest("hex")),
  );
  assert.match(page, /aria-label={`Switch to/);
  assert.match(page, /localStorage\.setItem\("patchproof-theme"/);
  assert.match(layout, /localStorage\.getItem\("patchproof-theme"/);
  assert.match(layout, /prefers-color-scheme: light/);
  assert.match(layout, /suppressHydrationWarning/);
  assert.match(styles, /:root\[data-theme="dark"\]/);
  assert.match(styles, /color-scheme: light/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /radial-gradient|linear-gradient/);
});

test("starter preview has been fully removed", async () => {
  const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(packageJson.name, "patchproof");
  assert.equal(packageJson.dependencies["react-loading-skeleton"], undefined);
});

test("GitHub integration is runnable and credential handling is explicit", async () => {
  const [action, workflow] = await Promise.all([
    readFile(new URL(".github/actions/patchproof/action.yml", root), "utf8"),
    readFile(new URL(".github/workflows/patchproof.yml", root), "utf8"),
  ]);
  assert.match(action, /patchproof" github-check/);
  assert.match(action, /GITHUB_STEP_SUMMARY/);
  assert.match(action, /inputs\.github-token/);
  assert.match(action, /post-check == 'true'/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /pull_request_target/);
  assert.match(workflow, /checks: write/);
});

test("README showcase uses a substantial continuous app walkthrough with an explanation", async () => {
  const [readme, animation, video, poster] = await Promise.all([
    readFile(new URL("README.md", root), "utf8"),
    stat(new URL("docs/walkthrough/app-walkthrough.gif", root)),
    stat(new URL("docs/walkthrough/app-walkthrough.mp4", root)),
    stat(new URL("docs/walkthrough/app-walkthrough-poster.jpg", root)),
  ]);
  assert.match(readme, /Continuous app walkthrough/);
  assert.match(readme, /app-walkthrough\.gif/);
  assert.match(readme, /app-walkthrough\.mp4/);
  assert.match(readme, /one continuous pass through the real product/);
  assert.match(readme, /FIXTURE.*EXECUTABLE/s);
  assert.ok(animation.size > 1_000_000);
  assert.ok(video.size > 1_000_000);
  assert.ok(poster.size > 50_000);
});
