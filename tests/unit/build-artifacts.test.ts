import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "../..");

function runBuild(): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, ["scripts/build.mjs"], { cwd: projectRoot }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

describe("built browser artifacts", () => {
  beforeAll(async () => runBuild(), 30_000);

  it.each(["chromium", "firefox"])("contains every file referenced by %s", async (target) => {
    const targetRoot = path.join(projectRoot, "dist", target);
    const manifest = JSON.parse(await readFile(path.join(targetRoot, "manifest.json"), "utf8")) as {
      background: { service_worker?: string; scripts?: string[] };
      content_scripts: { js: string[] }[];
    };
    const referencedFiles = [
      ...(manifest.background.service_worker ? [manifest.background.service_worker] : []),
      ...(manifest.background.scripts ?? []),
      ...manifest.content_scripts.flatMap((definition) => definition.js),
    ];
    for (const relativePath of referencedFiles) {
      await expect(access(path.join(targetRoot, relativePath))).resolves.toBeUndefined();
    }
    for (const legalDocument of [
      "LICENSE",
      "NOTICE",
      "PRIVACY.md",
      "METHODOLOGY.md",
      "THIRD_PARTY_NOTICES.md",
    ]) {
      await expect(access(path.join(targetRoot, legalDocument))).resolves.toBeUndefined();
    }
  });

  it.each([16, 32, 48, 128])("generates a valid %d px PNG icon", async (size) => {
    const icon = await readFile(
      path.join(projectRoot, "dist", "chromium", "icons", `icon-${size}.png`),
    );
    expect(icon.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(icon.readUInt32BE(16)).toBe(size);
    expect(icon.readUInt32BE(20)).toBe(size);
  });

  it.each(["chromium", "firefox"])("keeps localhost out of the %s release", async (target) => {
    const archive = await readFile(
      path.join(projectRoot, "dist", "packages", `ecoia-${target}.zip`),
    );
    expect(archive.toString("utf8")).not.toContain("127.0.0.1");
  });

  it.each(["chromium", "firefox"])(
    "keeps platform-specific model detection in the %s runtime",
    async (target) => {
      const targetRoot = path.join(projectRoot, "dist", target, "content");
      const [core, perplexity] = await Promise.all([
        readFile(path.join(targetRoot, "core.js"), "utf8"),
        readFile(path.join(targetRoot, "perplexity.js"), "utf8"),
      ]);

      expect(core).toContain("__ecoIARecognizeModelLabel");
      expect(perplexity).toContain("Prepared with");
      expect(perplexity).toContain("preferLatestModelLabel");
    },
  );
});
