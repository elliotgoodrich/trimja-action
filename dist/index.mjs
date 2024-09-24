import { downloadTool, extractTar } from "@actions/tool-cache";
import { promisify } from "node:util";
import { join } from "node:path";
import { execFile as execFileCallback } from "node:child_process";
const execFile = promisify(execFileCallback);
const version = "0.1.1";
const URLBase = `https://github.com/elliotgoodrich/trimja/releases/download/v${version}/trimja-${version}`;
(async () => {
    if (process.platform === "win32") {
        console.log("Windows not yet supported");
    }
    else if (process.platform === "darwin") {
        console.log("MacOS not yet supported");
    }
    else {
        const URL = `${URLBase}-Linux.tar.gz`;
        console.log(`Starting Download of ${URL}`);
        const trimjaTgz = await downloadTool(URL);
        const trimjaFolder = await extractTar(trimjaTgz, "trimja-install");
        console.log(`Extracted successfully to ${trimjaFolder}`);
        console.log("ls");
        const ls = await execFile("ls", null, { cwd: trimjaFolder });
        console.log(ls.stdout);
        const child = await execFile(join(trimjaFolder, `trimja-${version}-Linux`, "bin", "trimja"), ["--version"]);
        console.log(child.stdout);
    }
})();
