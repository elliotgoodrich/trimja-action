import { NinjaBuilder } from "@ninjutsu-build/core";
import { makeTSCRule } from "@ninjutsu-build/tsc";
import { makeFormatRule, makeLintRule } from "@ninjutsu-build/biome";
import { makeESBuildRule } from "@ninjutsu-build/esbuild";
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
const esbuild = makeESBuildRule(ninja);

format({ in: "ninjutsu.mjs" });
format({ in: "package.json" });
format({ in: "biome.json" });

const formatted = format({ in: "index.mts" });
const linted = lint({ in: formatted });

const sources = tsc({
  in: [linted],
  compilerOptions: {
    target: "ES2018",
    lib: ["ES2021"],
    outDir: "dist",
    module: "nodenext",
    moduleResolution: "nodenext",
    esModuleInterop: true,
    forceConsistentCasingInFileNames: true,
    strict: true,
    noImplicitAny: true,
    strictNullChecks: true,
    strictFunctionTypes: true,
    strictBindCallApply: true,
    strictPropertyInitialization: true,
    noImplicitThis: true,
    useUnknownInCatchVariables: true,
    alwaysStrict: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    noImplicitReturns: true,
    noFallthroughCasesInSwitch: true,
    skipDefaultLibCheck: true,
    skipLibCheck: true,
    isolatedModules: true,
  },
});

esbuild({
  in: sources,
  out: "dist/entry.cjs",
  buildOptions: {
    bundle: true,
    platform: "node",
    target: "es2022",
  },
});

writeFileSync("build.ninja", ninja.output);
