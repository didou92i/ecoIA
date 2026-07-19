import { describe, expect, it } from "vitest";

import packageJson from "../../package.json";

const expectedDevelopmentDependencies = {
  "@biomejs/biome": "2.5.4",
  "@playwright/test": "1.61.1",
  "@types/chrome": "0.2.2",
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
});
