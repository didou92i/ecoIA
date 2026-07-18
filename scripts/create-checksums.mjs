import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const archives = ["ecoia-chromium.zip", "ecoia-firefox.zip"];
const packagesDirectory = path.resolve("dist", "packages");

for (const archiveName of archives) {
  const archivePath = path.join(packagesDirectory, archiveName);
  const digest = createHash("sha256")
    .update(await readFile(archivePath))
    .digest("hex");
  const checksumPath = `${archivePath}.sha256`;
  await writeFile(checksumPath, `${digest}  ${archiveName}\n`);
  console.log(`PASS ${path.basename(checksumPath)}`);
}
