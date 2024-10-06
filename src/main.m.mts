import { restoreCache } from "@actions/cache";
import { addPath, getInput, info, setFailed, warning } from "@actions/core";
import { exec } from "@actions/exec";
import { downloadTool, extractTar } from "@actions/tool-cache";
import { promisify } from "node:util";
import { join } from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { appendFile, writeFile } from "node:fs/promises";
import { normalize } from "node:path";
import { archive } from "./common.mjs";
const execFile = promisify(execFileCallback);

const version = getInput("version", { required: true });
const URLBase = `https://github.com/elliotgoodrich/trimja/releases/download/v${version}/trimja-${version}`;

try {
  (async () => {
    if (process.platform === "win32") {
      throw new Error("Windows not yet supported");
    }

    if (process.platform === "darwin") {
      throw new Error("MacOS not yet supported");
    }

    const URL = `${URLBase}-Linux.tar.gz`;
    info(`Starting Download of ${URL}`);
    const trimjaTgz = await downloadTool(URL);
    info("Extracting tar.gz");
    const trimjaFolder = await extractTar(trimjaTgz, "trimja-install");
    info(`Extracted successfully to ${trimjaFolder}`);
    const trimjaDir = join(trimjaFolder, `trimja-${version}-Linux`, "bin");

    info(`Adding ${trimjaDir} to the path`);
    addPath(trimjaDir);

    info("$ trimja --version");
    info((await execFile("trimja", ["--version"])).stdout.trimEnd());

    const ninjaFile = getInput("path", { required: true });
    info(`$ trimja --file ${ninjaFile} --builddir`);
    const builddirOutput = await execFile("trimja", [
      "--file",
      ninjaFile,
      "--builddir",
    ]);
    const builddir = normalize(builddirOutput.stdout);
    info(builddir.trimEnd());
    const variablesForPostFile = process.env.GITHUB_STATE;
    if (variablesForPostFile === undefined) {
      throw new Error("'GITHUB_STATE' environment variable not set");
    }

    info("Writing to GITHUB_STATE file");
    await appendFile(variablesForPostFile, `builddir=${builddir}`, {
      encoding: "utf8",
    });

    info("Getting affected files");
    const matchedCache = await restoreCache([archive], "TRIMJA-", ["TRIMJA-"]);
    if (matchedCache === undefined) {
      info("No cache found, skipping trimja");
      return;
    }

    info("Extracting ninja files");
    await exec("tar", ["-tf", archive]);
    await extractTar(archive, builddir);
    await exec("ls", ["-R", builddir]);

    const hash = matchedCache.slice("TRIMJA-".length);

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
