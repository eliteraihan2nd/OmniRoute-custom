/**
 * Database Statistics Module
 *
 * Provides functions to retrieve database statistics including size, table counts, and performance metrics.
 */

import type { SqliteAdapter } from "./adapters/types";
import { getDbInstance } from "./core";

export interface DatabaseStats {
  totalSize: number;
  pageSize: number;
  pageCount: number;
  tables: Array<{
    name: string;
    rowCount: number;
    size: number;
  }>;
  indexes: Array<{
    name: string;
    tableName: string;
  }>;
  walSize?: number;
  cacheSize: number;
}

export function getDatabaseStats(db: SqliteAdapter = getDbInstance()): DatabaseStats {
  const pageSize = db.pragma("page_size", { simple: true }) as number;
  const pageCount = db.pragma("page_count", { simple: true }) as number;
  const cacheSize = db.pragma("cache_size", { simple: true }) as number;
  const totalSize = pageSize * pageCount;

  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    )
    .all() as Array<{ name: string }>;

  const tableStats = tables.map((table) => {
    let rowCount = 0;
    try {
      const quotedName = `"${table.name.replaceAll('"', '""')}"`;
      const row = db.prepare(`SELECT COUNT(*) as count FROM ${quotedName}`).get() as
        { count: number } | undefined;
      rowCount = row?.count ?? 0;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("no such module:")) {
        throw error;
      }
      // Optional virtual-table modules may be unavailable on this connection.
    }

    let tableSize: { size: number | null } | undefined;
    try {
      tableSize = db
        .prepare(`SELECT SUM(pgsize) as size FROM dbstat WHERE name = ?`)
        .get(table.name) as { size: number | null };
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("no such table: dbstat")) {
        throw error;
      }
      // dbstat is a virtual table compiled into better-sqlite3/node:sqlite
      // builds; the sql.js WASM build omits it. Fall back to 0 rather than
      // failing the entire database-stats read.
    }

    return {
      name: table.name,
      rowCount,
      size: tableSize?.size || 0,
    };
  });

  const indexes = db
    .prepare(
      `SELECT name, tbl_name as tableName FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    )
    .all() as Array<{ name: string; tableName: string }>;

  return {
    totalSize,
    pageSize,
    pageCount,
    tables: tableStats,
    indexes,
    cacheSize,
  };
}
