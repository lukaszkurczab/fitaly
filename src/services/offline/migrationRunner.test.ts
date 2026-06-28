import { beforeEach, describe, expect, it, jest } from "@jest/globals";

type MigrationDef = {
  version: number;
  up: string | ((db: DbMock) => Promise<void>);
};

type DbMock = {
  execAsync: jest.MockedFunction<(sql: string) => Promise<void>>;
  runAsync: jest.MockedFunction<
    (sql: string, params?: unknown[]) => Promise<unknown>
  >;
  getFirstAsync: jest.MockedFunction<
    (
      sql: string,
      params?: unknown[],
    ) => Promise<Record<string, unknown> | null>
  >;
  withTransactionAsync: jest.MockedFunction<
    (fn: () => Promise<void>) => Promise<void>
  >;
};

function createDbMock(
  currentVersion: number | null,
  tableColumns: Record<string, string[]> = {},
): DbMock {
  const execAsync = jest.fn(async (_sql: string) => {});
  const runAsync = jest.fn(async (_sql: string, _params?: unknown[]) => ({}));
  const getFirstAsync = jest.fn(async (sql: string, params?: unknown[]) => {
    if (sql.includes("pragma_table_info")) {
      const tableMatch = sql.match(/pragma_table_info\('([^']+)'\)/);
      const table = tableMatch?.[1] ?? "";
      const expectedColumn = String(params?.[0] ?? "").toLowerCase();
      const existingColumn = tableColumns[table]?.find(
        (column) => column.toLowerCase() === expectedColumn,
      );
      return existingColumn ? { name: existingColumn } : null;
    }
    return { max_v: currentVersion };
  });
  const withTransactionAsync = jest.fn(async (fn: () => Promise<void>) => {
    await fn();
  });

  return {
    execAsync,
    runAsync,
    getFirstAsync,
    withTransactionAsync,
  };
}

async function loadRunnerWithMigrations(migrations: MigrationDef[]) {
  jest.resetModules();
  jest.doMock("@/services/offline/migrations", () => ({ migrations }));
  return jest.requireActual<typeof import("@/services/offline/migrationRunner")>(
    "@/services/offline/migrationRunner",
  );
}

async function loadActualRunner() {
  jest.resetModules();
  jest.dontMock("@/services/offline/migrations");
  return jest.requireActual<typeof import("@/services/offline/migrationRunner")>(
    "@/services/offline/migrationRunner",
  );
}

async function loadActualMigrations() {
  jest.resetModules();
  jest.dontMock("@/services/offline/migrations");
  return jest.requireActual<typeof import("@/services/offline/migrations")>(
    "@/services/offline/migrations",
  );
}

describe("offline migrationRunner", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("creates _schema_migrations table", async () => {
    const module = await loadRunnerWithMigrations([]);
    const db = createDbMock(0);

    await module.runMigrations(db as never);

    expect(db.execAsync).toHaveBeenCalledWith(
      "CREATE TABLE IF NOT EXISTS _schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
    );
  });

  it("executes pending migrations in version order", async () => {
    const module = await loadRunnerWithMigrations([
      { version: 3, up: "m3" },
      { version: 1, up: "m1" },
      { version: 2, up: "m2" },
    ]);
    const db = createDbMock(0);

    await module.runMigrations(db as never);

    expect(db.runAsync.mock.calls.map(([, params]) => params?.[0])).toEqual([
      1,
      2,
      3,
    ]);
    expect(db.execAsync.mock.calls.map(([sql]) => sql)).toEqual([
      "CREATE TABLE IF NOT EXISTS _schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
      "m1",
      "m2",
      "m3",
    ]);
  });

  it("skips already applied migrations", async () => {
    const module = await loadRunnerWithMigrations([
      { version: 1, up: "m1" },
      { version: 2, up: "m2" },
      { version: 3, up: "m3" },
    ]);
    const db = createDbMock(2);

    await module.runMigrations(db as never);

    expect(db.execAsync.mock.calls.map(([sql]) => sql)).toEqual([
      "CREATE TABLE IF NOT EXISTS _schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
      "m3",
    ]);
    expect(db.runAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenCalledWith(
      "INSERT INTO _schema_migrations (version, applied_at) VALUES (?, datetime('now'))",
      [3],
    );
  });

  it("runs each migration inside its own transaction", async () => {
    const module = await loadRunnerWithMigrations([
      { version: 1, up: "m1" },
      { version: 2, up: "m2" },
    ]);
    const db = createDbMock(0);

    await module.runMigrations(db as never);

    expect(db.withTransactionAsync).toHaveBeenCalledTimes(2);
  });

  it("keeps saved meal image_ref in the async fresh my_meals schema", async () => {
    const { migrations } = await loadActualMigrations();
    const freshSchema = migrations.find((migration) => migration.version === 1);

    expect(typeof freshSchema?.up).toBe("string");
    if (typeof freshSchema?.up !== "string") {
      throw new Error("Expected async migration v1 to be a SQL schema string");
    }
    const sql = freshSchema.up;
    const mealsBlock = sql.slice(
      sql.indexOf("CREATE TABLE IF NOT EXISTS meals"),
      sql.indexOf("CREATE INDEX IF NOT EXISTS idx_meals_user_ts"),
    );
    const myMealsBlock = sql.slice(
      sql.indexOf("CREATE TABLE IF NOT EXISTS my_meals"),
      sql.indexOf("CREATE INDEX IF NOT EXISTS idx_my_meals_user_name"),
    );
    expect(myMealsBlock).toContain("image_ref TEXT");
    expect(mealsBlock).not.toContain("image_ref TEXT");
  });

  it("does not issue duplicate image_ref ALTER when async v4 sees the column already exists", async () => {
    const module = await loadActualRunner();
    const db = createDbMock(3, { my_meals: ["cloud_id", "image_ref"] });

    await module.runMigrations(db as never);

    expect(db.execAsync).toHaveBeenCalledWith(
      "CREATE TABLE IF NOT EXISTS _schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
    );
    expect(
      db.execAsync.mock.calls.some(([sql]) =>
        sql.includes("ALTER TABLE my_meals ADD COLUMN image_ref TEXT"),
      ),
    ).toBe(false);
    expect(db.execAsync).toHaveBeenCalledWith("PRAGMA user_version=13;");
    expect(db.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS smart_memory_items"),
    );
    expect(db.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("PRAGMA user_version=14;"),
    );
    expect(db.runAsync.mock.calls.map(([, params]) => params?.[0])).toEqual([
      4,
      5,
      6,
    ]);
    expect(db.runAsync).toHaveBeenCalledWith(
      "INSERT INTO _schema_migrations (version, applied_at) VALUES (?, datetime('now'))",
      [4],
    );
  });

  it("does not replay duplicate client_mutation_id ALTER in mixed bootstrap state", async () => {
    const module = await loadActualRunner();
    const db = createDbMock(2, {
      op_queue: ["id", "client_mutation_id"],
      op_queue_dead: ["id", "client_mutation_id"],
      my_meals: ["cloud_id", "image_ref"],
    });

    await module.runMigrations(db as never);

    const executedSql = db.execAsync.mock.calls.map(([sql]) => sql);
    expect(
      executedSql.some((sql) =>
        sql.includes("ALTER TABLE op_queue ADD COLUMN client_mutation_id"),
      ),
    ).toBe(false);
    expect(
      executedSql.some((sql) =>
        sql.includes("ALTER TABLE op_queue_dead ADD COLUMN client_mutation_id"),
      ),
    ).toBe(false);
    expect(
      executedSql.some((sql) =>
        sql.includes("ALTER TABLE my_meals ADD COLUMN image_ref TEXT"),
      ),
    ).toBe(false);
    expect(executedSql).toContain("PRAGMA user_version=13;");
    expect(db.runAsync.mock.calls.map(([, params]) => params?.[0])).toEqual([
      3,
      4,
      5,
      6,
    ]);
  });

  it("adds and backfills client_mutation_id columns when async v3 columns are missing", async () => {
    const module = await loadActualRunner();
    const db = createDbMock(2, { my_meals: ["cloud_id", "image_ref"] });

    await module.runMigrations(db as never);

    const executedSql = db.execAsync.mock.calls.map(([sql]) => sql);
    expect(executedSql).toContain(
      "ALTER TABLE op_queue ADD COLUMN client_mutation_id TEXT NOT NULL DEFAULT '';",
    );
    expect(executedSql).toContain(
      "ALTER TABLE op_queue_dead ADD COLUMN client_mutation_id TEXT NOT NULL DEFAULT '';",
    );
    expect(
      executedSql.some((sql) =>
        sql.includes(
          "SET client_mutation_id = 'legacy:' || user_uid || ':' || kind || ':' || cloud_id || ':' || updated_at",
        ),
      ),
    ).toBe(true);
    expect(
      executedSql.some((sql) => sql.includes("PRAGMA user_version=12;")),
    ).toBe(true);
    expect(db.runAsync.mock.calls.map(([, params]) => params?.[0])).toEqual([
      3,
      4,
      5,
      6,
    ]);
  });

  it("adds Product/Ingredient projection tables in async v6", async () => {
    const module = await loadActualRunner();
    const db = createDbMock(5);

    await module.runMigrations(db as never);

    const executedSql = db.execAsync.mock.calls.map(([sql]) => sql);
    expect(
      executedSql.some((sql) =>
        sql.includes("CREATE TABLE IF NOT EXISTS ingredient_product_search_cache"),
      ),
    ).toBe(true);
    expect(
      executedSql.some((sql) =>
        sql.includes("CREATE TABLE IF NOT EXISTS ingredient_product_user_records"),
      ),
    ).toBe(true);
    expect(
      executedSql.some((sql) => sql.includes("PRAGMA user_version=16;")),
    ).toBe(true);
    expect(db.runAsync.mock.calls.map(([, params]) => params?.[0])).toEqual([6]);
  });
});
