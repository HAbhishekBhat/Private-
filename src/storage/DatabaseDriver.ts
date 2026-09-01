/**
 * Abstract Database Driver interface for cross-platform SQLite compatibility
 * (supporting op-sqlite, expo-sqlite, better-sqlite3, or Node/web memory stores).
 */

export interface QueryResult {
  rows: Record<string, unknown>[];
  insertId?: number;
  rowsAffected: number;
}

export interface IDatabaseDriver {
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  executeBatch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<void>;
  close(): Promise<void>;
}

export interface IFileSystemDriver {
  appendFile(path: string, content: string | Uint8Array): Promise<void>;
  readFile(path: string): Promise<string>;
  readFileBytes(path: string): Promise<Uint8Array>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  computeSha256(path: string): Promise<string>;
}
