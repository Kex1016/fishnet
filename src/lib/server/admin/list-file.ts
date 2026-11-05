// Editing the two hide-list files (hidden players, hidden servers) from the admin page, line by line
// so the owner's own comments and order survive: adding appends a line, removing drops the lines
// whose entry matches. Written to a temp file in the same directory and renamed over the old one, so
// a reader never sees half a file. Pure text functions first, for tests.
import { readFileSync, renameSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { randomBytes } from "node:crypto";

/** The entries of a list file (comment-free, trimmed, as written). */
export function entries(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const e = raw.split("#")[0].trim();
    if (e) out.push(e);
  }
  return out;
}

/** Appends `entry` unless an equal one (by `same`) is there already. */
export function addEntry(text: string, entry: string, same: (a: string, b: string) => boolean): string {
  if (entries(text).some((e) => same(e, entry))) return text;
  const base = text === "" || text.endsWith("\n") ? text : text + "\n";
  return `${base}${entry}\n`;
}

/** Drops every line whose entry equals `entry` (by `same`); a trailing comment on it goes too. */
export function removeEntry(text: string, entry: string, same: (a: string, b: string) => boolean): string {
  const lines = text.split(/(?<=\n)/);
  return lines.filter((l) => {
    const e = l.split("#")[0].trim();
    return !(e && same(e, entry));
  }).join("");
}

export function readListFile(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

export function writeListFile(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = join(dirname(path), `.${basename(path)}.${randomBytes(6).toString("hex")}.tmp`);
  writeFileSync(tmp, text, { mode: 0o644 });
  try {
    renameSync(tmp, path);
  } catch {
    // e.g. the file itself is a bind mount: write in place
    writeFileSync(path, text);
    try {
      writeFileSync(tmp, "");
    } catch {}
  }
}
