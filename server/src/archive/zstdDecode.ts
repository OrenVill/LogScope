import { decompress as fzstdDecompress } from "fzstd";

/** Decompress zstd-framed bytes to UTF-8 text (pure JS, no native addon). */
export function decodeZstdToUtf8(bytes: Buffer): string {
  const out = fzstdDecompress(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  return Buffer.from(out).toString("utf8");
}
