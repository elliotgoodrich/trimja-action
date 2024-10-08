import { restoreCache } from "@actions/cache";
import { addPath, getInput, info, setFailed, warning } from "@actions/core";
import { exec } from "@actions/exec";
import { downloadTool, extractTar, extractZip } from "@actions/tool-cache";
import { promisify } from "node:util";
import { join } from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { appendFile, writeFile } from "node:fs/promises";
import { archive, cachePrefix } from "./common.mjs";
const execFile = promisify(execFileCallback);

function getPlatformVars(version: string): {
  filename: string;
  ext: string;
  extract: (file: string, dest?: string) => Promise<string>;
} {
  switch (process.platform) {
    case "win32":
      return {
        filename: `trimja-${version}-win64`,
        ext: ".zip",
        extract: extractZip,
      };
    case "darwin":
      return {
        filename: `trimja-${version}-Darwin`,
        ext: ".tar.gz",
        extract: extractTar,
      };
    case "linux":
      return {
        filename: `trimja-${version}-Linux`,
        ext: ".tar.gz",
        extract: extractTar,
      };
    default:
      throw new Error(`Unsupported platform ${process.platform}`);
  }
}

try {
  (async () => {
    const version = getInput("version", { required: true });
    const URLBase = `https://github.com/elliotgoodrich/trimja/releases/download/v${version}`;

    const { filename, ext, extract } = getPlatformVars(version);
    const URL = `${URLBase}/${filename}${ext}`;
    info(`Starting Download of ${URL}`);
    const trimjaArchive = await downloadTool(URL);
    info(`Extracting ${trimjaArchive}`);
    const trimjaFolder = await extract(trimjaArchive, "trimja-install");
    info(`Extracted successfully to ${trimjaFolder}`);
    const trimjaDir = join(trimjaFolder, filename, "bin");

    info(`Adding ${trimjaDir} to the path`);
    addPath(trimjaDir);

    await exec("trimja", ["--version"]);

    const ninjaFile = getInput("path", { required: true });
    info(`$ trimja --file ${ninjaFile} --builddir`);
    const builddirOutput = await execFile("trimja", [
      "--file",
      ninjaFile,
      "--builddir",
    ]);
    const builddir = builddirOutput.stdout.trim();
    info(builddir);
    const variablesForPostFile = process.env.GITHUB_STATE;
    if (variablesForPostFile === undefined) {
      throw new Error("'GITHUB_STATE' environment variable not set");
    }

    info("Writing to GITHUB_STATE file");
    await appendFile(variablesForPostFile, `builddir=${builddir}`, {
      encoding: "utf8",
    });

    info("Getting affected files");
    const matchedCache = await restoreCache([archive], cachePrefix, [
      cachePrefix,
    ]);
    if (matchedCache === undefined) {
      info("No cache found, skipping trimja");
      return;
    }

    info("Extracting ninja files");
    await extractTar(archive, builddir);
    const hash = matchedCache.slice(cachePrefix.length);

    info(`Attempting to fetch ${hash}...`);
    try {
      await execFile("git", ["fetch", "origin", hash, "--depth=1"]);
      info(`...Successfully fetched ${hash}`);
    } catch (e) {
      warning(`...Failed to fetch ${hash}, skipping trimja`);
      return;
    }

    const affected = await execFile("git", [
      "diff",
      "--name-only",
      `${hash}..HEAD`,
    ]);

    const affectedFiles = affected.stdout.trimEnd().split("\n");
    info("The following files are affected:");
    info(affectedFiles.map((a) => `  - ${a}`).join("\n"));

    const affectedFilesFile = join("trimja-cache", "affected.txt");
    await writeFile(affectedFilesFile, affected.stdout);

    const explain = getInput("explain") === "true" ? "--explain" : "";
    info(
      `trimja --file ${ninjaFile} --affected ${affectedFilesFile} --write ${explain}`,
    );
    await exec("trimja", [
      "--file",
      ninjaFile,
      "--affected",
      affectedFilesFile,
      "--write",
      explain,
    ]);
  })();
} catch (e) {
  setFailed(e as string);
}
