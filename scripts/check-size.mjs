import { stat } from "node:fs/promises";
import path from "node:path";

const maximumArchiveBytes = 153_600;
const archivePaths = [
  path.resolve("dist/packages/ecoia-chromium.zip"),
  path.resolve("dist/packages/ecoia-firefox.zip"),
];

let failed = false;
for (const archivePath of archivePaths) {
  try {
    const archive = await stat(archivePath);
    const status = archive.size <= maximumArchiveBytes ? "PASS" : "FAIL";
    console.log(`${status} ${path.basename(archivePath)} ${archive.size} bytes`);
    failed ||= archive.size > maximumArchiveBytes;
  } catch {
    console.error(`FAIL ${path.basename(archivePath)} is missing`);
    failed = true;
  }
}

if (failed) {
  process.exitCode = 1;
}
