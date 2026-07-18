import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

import { createZip } from "./create-zip.mjs";
import { generateIcons } from "./generate-icons.mjs";

const projectRoot = process.cwd();
const distributionRoot = path.join(projectRoot, "dist");
const requestedTarget = process.argv
  .find((argument) => argument.startsWith("--target="))
  ?.slice("--target=".length);
const targets = requestedTarget ? [requestedTarget] : ["chromium", "firefox"];
const validTargets = new Set(["chromium", "firefox", "chromium-e2e"]);

for (const target of targets) {
  if (!validTargets.has(target)) {
    throw new Error(`Unsupported build target: ${target}`);
  }
}

const entryPoints = [
  ["src/background/service-worker.ts", "background"],
  ["src/content/core-entry.ts", "content/core"],
  ["src/content/entries/chatgpt.ts", "content/chatgpt"],
  ["src/content/entries/claude.ts", "content/claude"],
  ["src/content/entries/gemini.ts", "content/gemini"],
  ["src/content/entries/mistral.ts", "content/mistral"],
  ["src/content/entries/perplexity.ts", "content/perplexity"],
];

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeManifest(target, outputDirectory) {
  const baseManifest = await readJson(path.join(projectRoot, "manifest", "manifest.base.json"));
  const browserTarget = target === "firefox" ? "firefox" : "chromium";
  const targetManifest = await readJson(
    path.join(projectRoot, "manifest", `${browserTarget}.json`),
  );
  const manifest = { ...baseManifest, ...targetManifest };

  if (target === "chromium-e2e") {
    manifest.host_permissions = [...manifest.host_permissions, "http://127.0.0.1/*"];
    manifest.content_scripts = [
      ...manifest.content_scripts,
      {
        matches: ["http://127.0.0.1/*"],
        js: ["content/core.js", "content/chatgpt.js"],
        run_at: "document_idle",
      },
    ];
  }

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

async function pathExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(directory, prefix = "") {
  const entries = [];
  for (const directoryEntry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, directoryEntry.name);
    const relativePath = path.join(prefix, directoryEntry.name);
    if (directoryEntry.isDirectory()) {
      entries.push(...(await collectFiles(absolutePath, relativePath)));
    } else if (directoryEntry.isFile()) {
      entries.push({ name: relativePath, content: await readFile(absolutePath) });
    }
  }
  return entries;
}

if (!requestedTarget) {
  await rm(distributionRoot, { recursive: true, force: true });
}

for (const target of targets) {
  const outputDirectory = path.join(distributionRoot, target);
  await rm(outputDirectory, { recursive: true, force: true });
  await generateIcons(path.join(outputDirectory, "icons"));
  await writeManifest(target, outputDirectory);

  const availableEntries = {};
  for (const [sourcePath, outputName] of entryPoints) {
    const absoluteSourcePath = path.join(projectRoot, sourcePath);
    if (await pathExists(absoluteSourcePath)) {
      availableEntries[outputName] = absoluteSourcePath;
    }
  }

  if (Object.keys(availableEntries).length > 0) {
    await build({
      bundle: true,
      charset: "utf8",
      entryNames: "[dir]/[name]",
      entryPoints: availableEntries,
      format: "iife",
      legalComments: "none",
      minify: true,
      outdir: outputDirectory,
      platform: "browser",
      sourcemap: false,
      target: target === "firefox" ? "firefox121" : "chrome121",
    });
  }

  if (target !== "chromium-e2e") {
    const archivePath = path.join(distributionRoot, "packages", `ecoia-${target}.zip`);
    await createZip(archivePath, await collectFiles(outputDirectory));
  }
}
