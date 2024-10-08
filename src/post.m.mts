import { info, setFailed } from "@actions/core";
import { saveCache } from "@actions/cache";
import { exec } from "@actions/exec";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { archive } from "./common.mjs";

try {
  (async () => {
    const builddir = process.env.STATE_builddir;
    if (builddir === undefined) {
      throw new Error("Unable to find builddir");
    }

    const cachePrefix = process.env.STATE_cachePrefix;
    if (cachePrefix === undefined) {
      throw new Error("Unable to find cachePrefix");
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
    await exec("tar", ["-czvf", archive, "-C", builddir, ...files]);

    const key = `${cachePrefix}${HASH}`;
    info(`Saving cache '${key}'`);
    await saveCache([archive], key);
  })();
} catch (e) {
  setFailed(e as string);
}
