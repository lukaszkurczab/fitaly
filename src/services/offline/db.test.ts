import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockExecSync = jest.fn<(sql: string) => void>();
const mockGetFirstSync = jest.fn<
  (sql: string) => { user_version: number } | undefined
>();
const mockGetAllSync = jest.fn<(sql: string) => Array<{ name: string }>>();
const mockOpenDatabaseSync = jest.fn<
  (name: string) => {
    execSync: typeof mockExecSync;
    getFirstSync: typeof mockGetFirstSync;
    getAllSync: typeof mockGetAllSync;
  }
>((_) => ({
  execSync: mockExecSync,
  getFirstSync: mockGetFirstSync,
  getAllSync: mockGetAllSync,
}));

jest.mock("expo-sqlite", () => ({
  defaultDatabaseDirectory: "file:///mockdb",
  openDatabaseSync: (name: string) => mockOpenDatabaseSync(name),
}));

describe("offline db bootstrap (src/services/offline/db.ts)", () => {
  beforeEach(() => {
    jest.resetModules();
    mockExecSync.mockClear();
    mockGetFirstSync.mockClear();
    mockGetAllSync.mockClear();
    mockOpenDatabaseSync.mockClear();
  });

  it("opens the renamed database and memoizes the connection", () => {
    const module =
      jest.requireActual<typeof import("@/services/offline/db")>(
        "@/services/offline/db",
      );

    const db1 = module.getDB();
    const db2 = module.getDB();

    expect(db1).toBe(db2);
    expect(mockOpenDatabaseSync).toHaveBeenCalledTimes(1);
    expect(mockOpenDatabaseSync).toHaveBeenCalledWith("fitaly.db");
    expect(mockExecSync).toHaveBeenCalledWith("PRAGMA journal_mode = WAL;");
    expect(mockExecSync).toHaveBeenCalledWith("PRAGMA foreign_keys = ON;");
  });

  it("resets offline storage by deleting current runtime tables in one transaction", () => {
    const module =
      jest.requireActual<typeof import("@/services/offline/db")>(
        "@/services/offline/db",
      );

    module.getDB();
    mockExecSync.mockClear();

    module.resetOfflineStorage();

    expect(mockExecSync.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      "DELETE FROM op_queue;",
      "DELETE FROM op_queue_dead;",
      "DELETE FROM images;",
      "DELETE FROM meals;",
      "DELETE FROM my_meals;",
      "DELETE FROM smart_memory_items;",
      "DELETE FROM smart_memory_candidates;",
      "DELETE FROM smart_memory_settings;",
      "DELETE FROM ingredient_product_search_cache;",
      "DELETE FROM chat_messages;",
      "DELETE FROM chat_threads;",
      "COMMIT",
    ]);
  });

  it("migrates meals and my_meals to v8 by adding input_method and ai_meta", () => {
    mockGetFirstSync.mockReturnValue({ user_version: 7 });
    mockGetAllSync.mockImplementation((sql: string) => {
      if (sql === "PRAGMA table_info(meals)") {
        return [{ name: "cloud_id" }];
      }
      if (sql === "PRAGMA table_info(my_meals)") {
        return [{ name: "cloud_id" }];
      }
      return [];
    });

    const module =
      jest.requireActual<typeof import("@/services/offline/db")>(
        "@/services/offline/db",
      );

    module.runMigrations();

    expect(mockExecSync).toHaveBeenCalledWith(
      "ALTER TABLE meals ADD COLUMN input_method TEXT;",
    );
    expect(mockExecSync).toHaveBeenCalledWith(
      "ALTER TABLE meals ADD COLUMN ai_meta TEXT;",
    );
    expect(mockExecSync).toHaveBeenCalledWith(
      "ALTER TABLE my_meals ADD COLUMN input_method TEXT;",
    );
    expect(mockExecSync).toHaveBeenCalledWith(
      "ALTER TABLE my_meals ADD COLUMN ai_meta TEXT;",
    );
    expect(mockExecSync).toHaveBeenCalledWith("PRAGMA user_version = 8;");
  });

  it("removes legacy chat persistence queue rows during v11 migration", () => {
    mockGetFirstSync.mockReturnValue({ user_version: 8 });

    const module =
      jest.requireActual<typeof import("@/services/offline/db")>(
        "@/services/offline/db",
      );

    module.runMigrations();

    expect(mockExecSync).toHaveBeenCalledWith(
      "DELETE FROM op_queue WHERE kind = 'persist_chat_message';",
    );
    expect(mockExecSync).toHaveBeenCalledWith(
      "DELETE FROM op_queue_dead WHERE kind = 'persist_chat_message';",
    );
    expect(mockExecSync).toHaveBeenCalledWith("PRAGMA user_version = 11;");
  });

  it("adds durable queue mutation identity columns during v12 migration", () => {
    mockGetFirstSync.mockReturnValue({ user_version: 11 });
    mockGetAllSync.mockImplementation((sql: string) => {
      if (sql === "PRAGMA table_info(op_queue)") {
        return [{ name: "id" }];
      }
      if (sql === "PRAGMA table_info(op_queue_dead)") {
        return [{ name: "id" }, { name: "op_id" }];
      }
      return [];
    });

    const module =
      jest.requireActual<typeof import("@/services/offline/db")>(
        "@/services/offline/db",
      );

    module.runMigrations();

    expect(mockExecSync).toHaveBeenCalledWith(
      "ALTER TABLE op_queue ADD COLUMN client_mutation_id TEXT NOT NULL DEFAULT '';",
    );
    expect(mockExecSync).toHaveBeenCalledWith(
      "ALTER TABLE op_queue_dead ADD COLUMN client_mutation_id TEXT NOT NULL DEFAULT '';",
    );
    expect(mockExecSync).toHaveBeenCalledWith("PRAGMA user_version = 12;");
  });

  it("adds saved meal image_ref column during v13 migration", () => {
    mockGetFirstSync.mockReturnValue({ user_version: 12 });
    mockGetAllSync.mockImplementation((sql: string) => {
      if (sql === "PRAGMA table_info(my_meals)") {
        return [{ name: "cloud_id" }, { name: "image_id" }];
      }
      return [];
    });

    const module =
      jest.requireActual<typeof import("@/services/offline/db")>(
        "@/services/offline/db",
      );

    module.runMigrations();

    expect(mockExecSync).toHaveBeenCalledWith(
      "ALTER TABLE my_meals ADD COLUMN image_ref TEXT;",
    );
    expect(mockExecSync).toHaveBeenCalledWith("PRAGMA user_version = 13;");
  });

  it("adds Smart Memory projection tables during v14 migration", () => {
    mockGetFirstSync.mockReturnValue({ user_version: 13 });

    const module =
      jest.requireActual<typeof import("@/services/offline/db")>(
        "@/services/offline/db",
      );

    module.runMigrations();

    const calls = mockExecSync.mock.calls.map(([sql]) => String(sql));
    expect(
      calls.some((sql) => sql.includes("CREATE TABLE IF NOT EXISTS smart_memory_items")),
    ).toBe(true);
    expect(
      calls.some((sql) =>
        sql.includes("CREATE TABLE IF NOT EXISTS smart_memory_candidates"),
      ),
    ).toBe(true);
    expect(
      calls.some((sql) =>
        sql.includes("CREATE TABLE IF NOT EXISTS smart_memory_settings"),
      ),
    ).toBe(true);
    expect(mockExecSync).toHaveBeenCalledWith("PRAGMA user_version = 14;");
  });

  it("adds Ingredient/Product search cache table during v15 migration", () => {
    mockGetFirstSync.mockReturnValue({ user_version: 14 });

    const module =
      jest.requireActual<typeof import("@/services/offline/db")>(
        "@/services/offline/db",
      );

    module.runMigrations();

    const calls = mockExecSync.mock.calls.map(([sql]) => String(sql));
    expect(
      calls.some((sql) =>
        sql.includes("CREATE TABLE IF NOT EXISTS ingredient_product_search_cache"),
      ),
    ).toBe(true);
    expect(
      calls.some((sql) =>
        sql.includes("idx_ingredient_product_search_cache_query"),
      ),
    ).toBe(true);
    expect(mockExecSync).toHaveBeenCalledWith("PRAGMA user_version = 15;");
  });

  it("skips saved meal image_ref migration when the column already exists", () => {
    mockGetFirstSync.mockReturnValue({ user_version: 12 });
    mockGetAllSync.mockImplementation((sql: string) => {
      if (sql === "PRAGMA table_info(my_meals)") {
        return [{ name: "cloud_id" }, { name: "image_ref" }];
      }
      return [];
    });

    const module =
      jest.requireActual<typeof import("@/services/offline/db")>(
        "@/services/offline/db",
      );

    module.runMigrations();

    const calls = mockExecSync.mock.calls.map(([sql]) => String(sql));
    expect(
      calls.some((sql) => sql.includes("ALTER TABLE my_meals ADD COLUMN image_ref")),
    ).toBe(false);
    expect(mockExecSync).toHaveBeenCalledWith("PRAGMA user_version = 13;");
  });

  it("skips v8 column adds when schema is already current", () => {
    mockGetFirstSync.mockReturnValue({ user_version: 12 });

    const module =
      jest.requireActual<typeof import("@/services/offline/db")>(
        "@/services/offline/db",
      );

    module.runMigrations();

    const calls = mockExecSync.mock.calls.map(([sql]) => String(sql));
    expect(
      calls.some((sql) => sql.includes("ALTER TABLE meals ADD COLUMN input_method")),
    ).toBe(false);
    expect(
      calls.some((sql) => sql.includes("ALTER TABLE my_meals ADD COLUMN ai_meta")),
    ).toBe(false);
  });
});
