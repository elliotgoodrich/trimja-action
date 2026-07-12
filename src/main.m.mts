import { DefaultArtifactClient } from "@actions/artifact";
import { restoreCache } from "@actions/cache";
import {
  addPath,
  debug,
  error,
  getInput,
  info,
  setFailed,
  warning,
} from "@actions/core";
import { exec } from "@actions/exec";
import { downloadTool, extractTar, extractZip } from "@actions/tool-cache";
import { promisify } from "node:util";
import { join } from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { existsSync } from "node:fs";
import { appendFile, writeFile } from "node:fs/promises";
import { archive } from "./common.mjs";
const execFile = promisify(execFileCallback);

// Upload the ninja file, the affected files list, and the ninja log/deps
// files  as a workflow artifact so that a crash/failure can be reproduced later.
async function uploadCrashReport(
  ninjaFile: string,
  affectedFilesFile: string,
  builddir: string,
): Promise<void> {
  try {
    const candidates = [
      ninjaFile,
      affectedFilesFile,
      join(builddir, ".ninja_log"),
      join(builddir, ".ninja_deps"),
    ];
    const files = candidates.filter((f) => existsSync(f));

    if (files.length === 0) {
      warning("No files found to include in the crash report");
      return;
    }

    const runId = process.env.GITHUB_RUN_ID ?? "local";
    const runAttempt = process.env.GITHUB_RUN_ATTEMPT ?? "1";
    const artifactName = `trimja-failure-${runId}-${runAttempt}`;
    info(`Uploading crash report as artifact '${artifactName}'`);
    const artifactClient = new DefaultArtifactClient();
    await artifactClient.uploadArtifact(artifactName, files, process.cwd(), {
      retentionDays: 7,
    });
  } catch (e) {
    warning(`Failed to upload crash report: ${e}`);
  }
}

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
    const buildConfig = getInput("build-configuration");
    if (buildConfig.length > 100) {
      throw new Error(
        `build-configuration is ${buildConfig.length} and it cannot be longer than 100 characters`,
      );
    }

    const version = getInput("version");
    const URLBase = `https://github.com/elliotgoodrich/trimja/releases/download/v${version}`;

    const { filename, ext, extract } = getPlatformVars(version);
    const URL = `${URLBase}/${filename}${ext}`;
    debug(`Starting Download of ${URL}`);
    const trimjaArchive = await downloadTool(URL);
    debug(`Extracting ${trimjaArchive}`);
    const trimjaFolder = await extract(trimjaArchive, "trimja-install");
    debug(`Extracted successfully to ${trimjaFolder}`);
    const trimjaDir = join(trimjaFolder, filename, "bin");

    debug(`Adding ${trimjaDir} to the path`);
    addPath(trimjaDir);

    await exec("trimja", ["--version"]);

    const ninjaFile = getInput("path");
    debug(`$ trimja --file ${ninjaFile} --builddir`);
    const builddirOutput = await execFile("trimja", [
      "--file",
      ninjaFile,
      "--builddir",
    ]);
    const builddir = builddirOutput.stdout.trim();
    debug(`builddir: ${builddir}`);
    const variablesForPostFile = process.env.GITHUB_STATE;
    if (variablesForPostFile === undefined) {
      throw new Error("'GITHUB_STATE' environment variable not set");
    }

    debug("Writing to GITHUB_STATE file");

    const cachePrefix = `TRIMJA-${process.platform}-${buildConfig}`;
    await appendFile(
      variablesForPostFile,
      `builddir=${builddir}\ncachePrefix=${cachePrefix}`,
      {
        encoding: "utf8",
      },
    );

    debug("Getting affected files");
    const matchedCache = await restoreCache([archive], cachePrefix, [
      cachePrefix,
    ]);
    if (matchedCache === undefined) {
      info("No cache found, skipping trimja");
      return;
    }

    debug("Extracting ninja files");
    await extractTar(archive, builddir);
    const extracted = await execFile("tar", ["-tzvf", archive]);
    debug(`Extracted the following files to ${builddir}:\n${extracted.stdout}`);
    const hash = matchedCache.slice(cachePrefix.length);

    debug(`Attempting to fetch ${hash}...`);
    try {
      await execFile("git", ["fetch", "origin", hash, "--depth=1"]);
      debug(`...Successfully fetched ${hash}`);
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
    info(`The following files have been changed between ${hash}..HEAD:`);
    info(affectedFiles.map((a) => `  - ${a}`).join("\n"));

    const extraAffectedFiles = getInput("affected")
      .split(/\r?\n/)
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
    const affectedFilesFile = join("trimja-cache", "affected.txt");
    await writeFile(
      affectedFilesFile,
      `${affected.stdout}\n${extraAffectedFiles.join("\n")}`,
    );

    const args = [
      "--file",
      ninjaFile,
      "--affected",
      affectedFilesFile,
      "--write",
    ];
    const targets = getInput("targets")
      .split(/\r?\n/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    for (const target of targets) {
      args.push("--target", target);
    }
    if (getInput("target-default") === "true") {
      args.push("--target-default");
    }
    if (getInput("explain") === "true") {
      args.push("--explain");
    }

    debug(`$ trimja ${args.join(" ")}`);
    try {
      const { stdout, stderr } = await execFile("trimja", args, {
        maxBuffer: 64 * 1024 * 1024,
      });
      info(stdout);
      if (stderr) {
        info(stderr);
      }
    } catch (e) {
      const err = e as {
        code?: number | string;
        signal?: string;
        stdout?: string;
        stderr?: string;
      };
      error(
        `trimja failed — exit code ${err.code ?? "null"}${
          err.signal ? `, killed by signal ${err.signal}` : ""
        }`,
      );
      if (err.stdout) {
        info(`stdout:\n${err.stdout}`);
      }
      if (err.stderr) {
        error(`stderr:\n${err.stderr}`);
      }
      if (err.signal === "SIGKILL") {
        warning(
          `SIGKILL usually means the runner ran out of memory (OOM killer). Check the ${ninjaFile} size or use a larger runner.`,
        );
      }
      await uploadCrashReport(ninjaFile, affectedFilesFile, builddir);
      throw e;
    }
  })();
} catch (e) {
  setFailed(e as string);
}
