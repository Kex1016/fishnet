// Small disk-cache helpers shared by the icon proxy and the face service: atomic writes, age by mtime.
import { mkdir, rename, stat, writeFile, readFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function readCached(path: string): Promise<{ bytes: Buffer; ageMs: number } | null> {
  try {
    const [bytes, st] = await Promise.all([readFile(path), stat(path)]);
    return { bytes, ageMs: Math.max(0, Date.now() - st.mtimeMs) };
  } catch {
    return null;
  }
}

/** Write to a temp name, then rename, so a reader never sees half a file. Failures are swallowed: the cache is optional. */
export async function writeAtomic(path: string, bytes: Uint8Array | string): Promise<void> {
  try {
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    await writeFile(tmp, bytes);
    await rename(tmp, path);
  } catch {
    // read-only or full disk: serve uncached
  }
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
export function isPng(b: Uint8Array): boolean {
  return b.length > 8 && PNG_MAGIC.every((v, i) => b[i] === v);
}
