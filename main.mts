import { addPath, debug, error, getInput, info } from "@actions/core";
import { saveCache } from "@actions/cache";
import { downloadTool, extractTar } from "@actions/tool-cache";
import { promisify } from "node:util";
import { join } from "node:path";
import { execFile as execFileCallback } from "node:child_process";
const execFile = promisify(execFileCallback);

const version = getInput("version", { required: true });
const URLBase = `https://github.com/elliotgoodrich/trimja/releases/download/v${version}/trimja-${version}`;

(async () => {
  if (process.platform === "win32") {
    error("Windows not yet supported");
  } else if (process.platform === "darwin") {
    error("MacOS not yet supported");
  } else {
    await saveCache(["doesnt.exist"], "TEST");
    const URL = `${URLBase}-Linux.tar.gz`;
    debug(`Starting Download of ${URL}`);
    const trimjaTgz = await downloadTool(URL);
    debug("Extracting tar.gz");
    const trimjaFolder = await extractTar(trimjaTgz, "trimja-install");
    debug(`Extracted successfully to ${trimjaFolder}`);

    const trimjaDir = join(trimjaFolder, `trimja-${version}-Linux`, "bin");
    info("$ trimja --version");
    const child = await execFile(join(trimjaDir, "trimja"), ["--version"]);
    info(child.stdout);

    debug(`Adding ${trimjaDir} to the path`);
    addPath(trimjaDir);
  }
})();
