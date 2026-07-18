import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const executeFile = promisify(execFile);
const maximumScannedBytes = 2 * 1024 * 1024;
const rules = [
  { name: "private-key", pattern: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/u },
  { name: "aws-access-key", pattern: /AKIA[0-9A-Z]{16}/u },
  { name: "github-token", pattern: /gh[pousr]_[A-Za-z0-9]{36,255}/u },
  { name: "openai-key", pattern: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/u },
  { name: "slack-token", pattern: /xox[baprs]-[A-Za-z0-9-]{20,}/u },
];

const { stdout } = await executeFile(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "buffer", maxBuffer: 8 * 1024 * 1024 },
);
const filePaths = stdout.toString("utf8").split("\0").filter(Boolean).sort();
const findings = [];

for (const relativePath of filePaths) {
  const content = await readFile(path.resolve(relativePath));
  if (content.length > maximumScannedBytes || content.includes(0)) continue;
  const text = content.toString("utf8");
  for (const rule of rules) {
    if (rule.pattern.test(text)) findings.push(`${relativePath}: ${rule.name}`);
  }
}

if (findings.length > 0) {
  for (const finding of findings) console.error(`FAIL ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`PASS secret scan (${filePaths.length} files considered)`);
}
