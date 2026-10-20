import "server-only";

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export function openDatabase() {
  const dataDirectory = join(process.cwd(), "data");
  mkdirSync(dataDirectory, { recursive: true });

  return new Database(join(dataDirectory, "app.sqlite"));
}
