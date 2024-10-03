import { info, setFailed } from "@actions/core";
import { saveCache } from "@actions/cache";
import { promisify } from "node:util";
import { join } from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { archive } from "./common.mjs";
const execFile = promisify(execFileCallback);

try {
  (async () => {
    const builddir = process.env.STATE_builddir;
    if (builddir === undefined) {
      throw new Error("Unable to find builddir");
    }
    info(`Found ninja output directory: ${builddir}`);

    const HASH = process.env.GITHUB_SHA;
    if (HASH === undefined) {
      throw new Error("Cannot find 'GITHUB_SHA' environment variable");
    }

    const files = [".ninja_log", ".ninja_deps"].filter((f) =>
      existsSync(join(builddir, f)),
    );

    await mkdir("trimja-cache", { recursive: true });
    info(`Creating ${archive}`);
    await execFile("tar", ["-czvf", archive, "-C", builddir, ...files]);

    const key = `TRIMJA-${HASH}`;
    info(`Saving cache '${key}'`);
    await saveCache([archive], key);
  })();
} catch (e) {
  setFailed(e as string);
}
