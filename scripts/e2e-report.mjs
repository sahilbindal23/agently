import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const resultsPath = path.resolve("test-results/e2e-results.json");
const outputPath = path.resolve("test-results/e2e-feedback-report.md");

if (!existsSync(resultsPath)) {
  console.error("No Playwright JSON results found. Run `npm run test:e2e` first.");
  process.exit(1);
}

const results = JSON.parse(readFileSync(resultsPath, "utf8"));
const specs = flattenSuites(results.suites ?? []);
const passed = specs.filter((spec) => spec.ok).length;
const failed = specs.filter((spec) => !spec.ok);
const lines = [
  "# Agently Synthetic Tester Report",
  "",
  `Generated: ${new Date().toLocaleString("en-IN")}`,
  `Base URL: ${process.env.AGENTLY_BASE_URL ?? "http://localhost:3000"}`,
  "",
  "## Summary",
  "",
  `- Total checks: ${specs.length}`,
  `- Passed: ${passed}`,
  `- Failed: ${failed.length}`,
  "",
  "## What To Paste Back To Codex",
  "",
  "Paste this whole report into Codex after a run. The failed-check sections include the workflow, error, and artifact path when available.",
  "",
  "## Failed Checks",
  ""
];

if (!failed.length) {
  lines.push("No failed checks. The main role workflows are healthy.");
} else {
  failed.forEach((spec, index) => {
    lines.push(`### ${index + 1}. ${spec.title}`);
    lines.push("");
    lines.push(`- File: \`${spec.file}\``);
    lines.push(`- Status: ${spec.status}`);
    if (spec.error) lines.push(`- Error: ${spec.error}`);
    if (spec.attachments.length) {
      lines.push("- Artifacts:");
      spec.attachments.forEach((attachment) => lines.push(`  - ${attachment.name}: \`${attachment.path ?? "inline artifact"}\``));
    }
    lines.push("");
  });
}

lines.push("");
lines.push("## Passed Checks");
lines.push("");
specs.filter((spec) => spec.ok).forEach((spec) => {
  lines.push(`- ${spec.title}`);
});
lines.push("");
lines.push("## Suggested Next Debug Step");
lines.push("");
lines.push(failed.length ? "Open the first failed check, reproduce it locally, and fix the highest-impact workflow break first." : "Run the suite again after the next product change or before pushing to Vercel.");

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, lines.join("\n"));
console.log(`Wrote ${outputPath}`);

function flattenSuites(suites) {
  return suites.flatMap((suite) => [
    ...(suite.specs ?? []).map((spec) => normalizeSpec(spec, suite.file)),
    ...flattenSuites(suite.suites ?? [])
  ]);
}

function normalizeSpec(spec, suiteFile) {
  const tests = spec.tests ?? [];
  const results = tests.flatMap((test) => test.results ?? []);
  const failedResult = results.find((result) => result.status !== "passed" && result.status !== "skipped");
  const skipped = results.length && results.every((result) => result.status === "skipped");
  return {
    title: spec.title,
    file: suiteFile ?? spec.file ?? "unknown",
    status: skipped ? "skipped" : failedResult?.status ?? "passed",
    ok: !failedResult,
    error: failedResult?.error?.message?.replace(/\x1b\[[0-9;]*m/g, "") ?? "",
    attachments: results.flatMap((result) => result.attachments ?? []).filter((attachment) => attachment.path)
  };
}
