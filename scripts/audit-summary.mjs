import { spawnSync } from "node:child_process";

const command = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(command, ["audit", "--json"], {
  encoding: "utf8",
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
  console.log(JSON.stringify({
    counts: report.metadata?.vulnerabilities,
    vulnerabilities,
  }, null, 2));
} catch {
  console.log("Dependency audit did not return parseable JSON.");
  if (result.stderr) console.log(result.stderr.slice(0, 3000));
}
