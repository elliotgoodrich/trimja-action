import { NinjaBuilder, getInput } from "@ninjutsu-build/core";
import { makeTSCRule } from "@ninjutsu-build/tsc";
import { makeFormatRule, makeLintRule } from "@ninjutsu-build/biome";
import { makeESBuildRule } from "@ninjutsu-build/esbuild";
import { writeFileSync } from "node:fs";
import { join, parse } from "node:path/posix";
import { globSync } from "glob";

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

const sources = globSync("src/*.mts").map((s) =>
  lint({ in: format({ in: s }) }),
);

const generatedJS = tsc({
  in: sources,
  compilerOptions: {
    target: "ES2018",
    lib: ["ES2021"],
    outDir: "$builddir",
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

generatedJS
  .filter((js) => parse(getInput(js)).name.endsWith(".m"))
  .map((js) =>
    esbuild({
      in: js,
      out: join("dist", `${parse(getInput(js)).name}.cjs`),
      buildOptions: {
        bundle: true,
        platform: "node",
        target: "es2022",
      },
    }),
  );

writeFileSync("build.ninja", ninja.output);
