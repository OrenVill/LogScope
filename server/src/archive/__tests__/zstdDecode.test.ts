import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodeGroupedLines } from "../groupedDecoder.js";
import { decodeZstdToUtf8 } from "../zstdDecode.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, "fixtures/grouped-hour.ndjson"), "utf8");
const compressed = readFileSync(join(__dirname, "fixtures/grouped-hour.ndjson.zst"));

describe("decodeZstdToUtf8", () => {
  it("decompresses standard zstd frames from compacted ndjson objects", () => {
    const text = decodeZstdToUtf8(compressed);
    expect(text).toBe(fixture);
    const events = decodeGroupedLines(text.split("\n"));
    expect(events.length).toBeGreaterThan(0);
  });
});
