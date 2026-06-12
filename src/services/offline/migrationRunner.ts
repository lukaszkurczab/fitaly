import type { SQLiteDatabase } from "expo-sqlite";
import { migrations } from "./migrations";
import type { MigrationDatabase } from "./migrations";

const MIGRATION_TABLE_SQL =
  "CREATE TABLE IF NOT EXISTS _schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)";

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(MIGRATION_TABLE_SQL);

  const row = await db.getFirstAsync<{ max_v: number | null }>(
    "SELECT MAX(version) as max_v FROM _schema_migrations",
  );
  const currentVersion = row?.max_v ?? 0;

  const pending = migrations
    .filter((migration) => migration.version > currentVersion)
    .sort((left, right) => left.version - right.version);

  for (const migration of pending) {
    await db.withTransactionAsync(async () => {
      if (typeof migration.up === "function") {
        await migration.up(db as MigrationDatabase);
      } else {
        await db.execAsync(migration.up);
      }
      await db.runAsync(
        "INSERT INTO _schema_migrations (version, applied_at) VALUES (?, datetime('now'))",
        [migration.version],
      );
    });
  }
}
