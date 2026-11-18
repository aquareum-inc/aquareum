import { writeFile } from "node:fs/promises";
import { compileFromFile } from "json-schema-to-typescript";

const schema = new URL("../schema/instance.schema.json", import.meta.url);
const out = new URL("../src/generated.ts", import.meta.url);

const types = await compileFromFile(schema.pathname, {
  bannerComment: "/* Generated from schema/instance.schema.json by `pnpm --filter @aquareum/config generate`. Do not edit. */",
  additionalProperties: false,
});
await writeFile(out, types);
