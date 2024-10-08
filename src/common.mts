import { join } from "node:path";

export const archive = join("trimja-cache", "ninjafiles.tar.gz");

export const cachePrefix = `TRIMJA-${process.platform}-`;
