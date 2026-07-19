import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import packageJson from "../../package.json";

const expectedDevelopmentDependencies = {
  "@biomejs/biome": "2.5.4",
  "@playwright/test": "1.61.1",
  "@types/chrome": "0.2.2",
  "@types/node": "22.20.1",
  esbuild: "0.28.1",
  jsdom: "29.1.1",
  typescript: "7.0.2",
  vitest: "4.1.10",
};

const requiredScripts = [
  "format",
  "format:check",
  "lint",
  "typecheck",
  "test",
  "build",
  "build:e2e",
  "size",
  "e2e",
  "audit",
  "impact-coefficients",
  "source-freshness",
  "verify",
] as const;

describe("project configuration", () => {
  it("ships no runtime dependencies", () => {
    expect(packageJson).not.toHaveProperty("dependencies");
  });

  it("pins the reviewed development toolchain", () => {
    expect(packageJson.devDependencies).toEqual(expectedDevelopmentDependencies);
  });

  it("declares the supported runtime and package manager", () => {
    expect(packageJson).toMatchObject({
      engines: { node: ">=22" },
      packageManager: "npm@10.9.3",
    });
  });

  it.each(requiredScripts)("defines the %s script", (scriptName) => {
    expect(packageJson.scripts).toHaveProperty(scriptName);
  });

  it("checks source freshness before building during verification", () => {
    const verifyScript = packageJson.scripts.verify;
    expect(verifyScript).toContain("npm run source-freshness");
    expect(verifyScript.indexOf("npm run source-freshness")).toBeLessThan(
      verifyScript.indexOf("npm run build"),
    );
  });

  it("checks derived impact coefficients before building during verification", () => {
    const verifyScript = packageJson.scripts.verify;
    expect(verifyScript).toContain("npm run impact-coefficients");
    expect(verifyScript.indexOf("npm run impact-coefficients")).toBeLessThan(
      verifyScript.indexOf("npm run build"),
    );
  });

  it("audits the complete installed toolchain at moderate severity", async () => {
    const [workflow, checklist] = await Promise.all([
      readFile(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8"),
      readFile(new URL("../../docs/release-checklist.md", import.meta.url), "utf8"),
    ]);
    expect(packageJson.scripts.audit).toBe("npm audit --audit-level=moderate");
    expect(workflow).toMatch(/Full dependency tree audit[\s\S]*run: npm run audit/u);
    expect(checklist).toMatch(/npm run audit[\s\S]*(?:arbre complet|toolchain de développement)/iu);
  });

  it("runs the impact coefficient gate explicitly in CI before build and documents it", async () => {
    const [workflow, checklist] = await Promise.all([
      readFile(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8"),
      readFile(new URL("../../docs/release-checklist.md", import.meta.url), "utf8"),
    ]);
    expect(workflow).toContain("run: npm run impact-coefficients");
    expect(workflow.indexOf("run: npm run impact-coefficients")).toBeLessThan(
      workflow.indexOf("run: npm run build"),
    );
    expect(checklist).toContain("npm run impact-coefficients");
  });
});
