import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface ContentScriptDefinition {
  matches: string[];
  js: string[];
}

interface ManifestDefinition {
  manifest_version: number;
  permissions: string[];
  host_permissions: string[];
  content_scripts: ContentScriptDefinition[];
  content_security_policy: { extension_pages: string };
  background: { service_worker?: string; scripts?: string[] };
  browser_specific_settings?: { gecko?: { id?: string; strict_min_version?: string } };
}

const projectRoot = path.resolve(import.meta.dirname, "../..");
const allowedHosts = [
  "https://chatgpt.com/*",
  "https://chat.openai.com/*",
  "https://claude.ai/*",
  "https://gemini.google.com/*",
  "https://chat.mistral.ai/*",
  "https://www.perplexity.ai/*",
];

async function readManifest(fileName: string): Promise<ManifestDefinition> {
  return JSON.parse(await readFile(path.join(projectRoot, "manifest", fileName), "utf8"));
}

describe("release manifests", () => {
  it("uses an exact allowlist and only the storage permission", async () => {
    const manifest = await readManifest("manifest.base.json");
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(["storage"]);
    expect(manifest.host_permissions).toEqual(allowedHosts);
    expect(JSON.stringify(manifest)).not.toContain("<all_urls>");
    expect(manifest.permissions).not.toEqual(
      expect.arrayContaining(["tabs", "activeTab", "scripting", "webRequest"]),
    );
  });

  it("injects one shared core and one bounded adapter per host", async () => {
    const manifest = await readManifest("manifest.base.json");
    expect(manifest.content_scripts).toHaveLength(5);
    expect(manifest.content_scripts.flatMap((entry) => entry.matches).sort()).toEqual(
      [...allowedHosts].sort(),
    );
    for (const entry of manifest.content_scripts) {
      expect(entry.js).toHaveLength(2);
      expect(entry.js[0]).toBe("content/core.js");
      expect(entry.js[1]).toMatch(/^content\/(chatgpt|claude|gemini|mistral|perplexity)\.js$/u);
    }
  });

  it("forbids remote executable code", async () => {
    const manifest = await readManifest("manifest.base.json");
    expect(manifest.content_security_policy.extension_pages).toBe(
      "script-src 'self'; object-src 'none';",
    );
    for (const scriptPath of manifest.content_scripts.flatMap((entry) => entry.js)) {
      expect(scriptPath).not.toMatch(/^https?:/u);
    }
  });

  it("selects the native background format for Chromium and Firefox", async () => {
    const chromium = await readManifest("chromium.json");
    const firefox = await readManifest("firefox.json");
    expect(chromium.background).toEqual({ service_worker: "background.js" });
    expect(firefox.background).toEqual({ scripts: ["background.js"] });
    expect(firefox.browser_specific_settings?.gecko).toMatchObject({
      strict_min_version: "121.0",
    });
  });
});
