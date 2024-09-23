import { NinjaBuilder } from "@ninjutsu-build/core";
import { makeTSCRule } from "@ninjutsu-build/tsc";
import { makeFormatRule, makeLintRule } from "@ninjutsu-build/biome";
import { writeFileSync } from "node:fs";

const biomeConfig = "biome.json";

const ninja = new NinjaBuilder({
     ninja_required_version: "1.11",
     builddir: ".ninja",
});

const format = makeFormatRule(ninja, {
    configPath: biomeConfig,
});
const lint = makeLintRule(ninja, {
    configPath: biomeConfig,
});
const tsc = makeTSCRule(ninja);

const formatted = format({ in: "index.mts" });
const linted = lint({ in: formatted });

const [index] = tsc({
    in: [linted],
    tsconfig: "tsconfig.json",
    compilerOptions: {
        outDir: "dist",
        declaration: false,
    },
});

writeFileSync("build.ninja", ninja.output);