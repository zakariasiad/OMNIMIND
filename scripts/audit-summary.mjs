import { spawnSync } from "node:child_process";

const result = spawnSync("npm audit --json", {
  encoding: "utf8",
  shell: true,
  windowsHide: true,
});
const raw = result.stdout ?? "";
try {
  const report = JSON.parse(raw);
  const vulnerabilities = Object.entries(report.vulnerabilities ?? {}).map(([name, item]) => ({
    name,
    severity: item.severity,
    range: item.range,
    fixAvailable: item.fixAvailable,
    advisories: (item.via ?? []).map((advisory) =>
      typeof advisory === "string"
        ? advisory
        : { title: advisory.title, url: advisory.url, range: advisory.range },
    ),
  }));
  const counts = report.metadata?.vulnerabilities ?? {};
  console.log(JSON.stringify({ counts, vulnerabilities }, null, 2));
  if ((counts.high ?? 0) > 0 || (counts.critical ?? 0) > 0) {
    process.exitCode = 1;
  }
} catch {
  console.log("Dependency audit did not return parseable JSON.");
  if (result.stderr) console.log(result.stderr.slice(0, 3000));
}
