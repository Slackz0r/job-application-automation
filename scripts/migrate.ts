import { openDatabase } from "../src/lib/db.ts";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationsDirectory = join(process.cwd(), "migrations");

const migrationFiles = readdirSync(migrationsDirectory, {
  withFileTypes: true,
})
  .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
  .map((entry) => entry.name)
  .sort();

const db = openDatabase();

try {
  console.log("Database connection opened.");

  db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY NOT NULL,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

  console.log("Migration tracking is ready.");

  const findMigration = db.prepare(
    "SELECT name FROM schema_migrations WHERE name = ?"
  );
  const recordMigration = db.prepare(
    "INSERT INTO schema_migrations (name) VALUES (?)"
  );

  const applyMigration = db.transaction((fileName: string) => {
    if (findMigration.get(fileName)) {
      return false;
    }

    const filePath = join(migrationsDirectory, fileName);
    const sql = readFileSync(filePath, "utf8");

    db.exec(sql);
    recordMigration.run(fileName);
    return true;
  });

  for (const fileName of migrationFiles) {
    const applied = applyMigration.immediate(fileName);
    console.log(applied ? "Applied:" : "Already run:", fileName);
  }
} finally {
  db.close();
}
