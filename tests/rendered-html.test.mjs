import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("PatchProof metadata, evidence labels, and theme behavior are product-specific", async () => {
  const [page, layout, styles] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(layout, /PatchProof — Adversarial Software Verification/);
  assert.doesNotMatch(layout, /starter-preview|Your site is taking shape/);
  assert.doesNotMatch(layout, /next\/headers|x-forwarded-host/);
  assert.match(layout, /NEXT_PUBLIC_SITE_URL/);
  assert.match(layout, /NEXT_PUBLIC_BASE_PATH/);
  assert.match(layout, /demo\/patchproof-console\.png/);
  assert.match(page, /Generated property/);
  assert.match(page, /Counterexample/);
  assert.match(page, /API COMPATIBILITY/);
  assert.match(page, /Replay verification/);
  assert.match(page, /patchproof demo/);
  assert.doesNotMatch(page, /patchproof verify demo|https:\/\/github\.com\//);
  assert.match(page, /30 code points → 2/);
  assert.match(page, /14 accepted reductions/);
  assert.match(page, /aria-controls="counterexample-panel"/);
  assert.match(page, /PERFORMANCE · FIXTURE/);
  assert.match(page, /API COMPATIBILITY · FIXTURE/);
  assert.match(page, /stage\.evidence/);
  assert.match(page, /aria-label={`Switch to/);
  assert.match(page, /localStorage\.setItem\("patchproof-theme"/);
  assert.match(layout, /localStorage\.getItem\("patchproof-theme"/);
  assert.match(layout, /prefers-color-scheme: light/);
  assert.match(layout, /suppressHydrationWarning/);
  assert.match(styles, /:root\[data-theme="light"\]/);
  assert.match(styles, /color-scheme: light/);
});

test("starter preview has been fully removed", async () => {
  const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(packageJson.name, "patchproof-verification");
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
