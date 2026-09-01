/**
 * Lightweight, zero-dependency in-memory SQLite emulation driver.
 * Supports standard table definitions, parameterized queries, and immutability triggers.
 */

import { IDatabaseDriver, QueryResult } from '../DatabaseDriver';

interface TableStore {
  rows: Array<Record<string, unknown>>;
  hasUpdateTrigger: boolean;
  hasDeleteTrigger: boolean;
}

export class MemoryDatabaseDriver implements IDatabaseDriver {
  private tables = new Map<string, TableStore>();
  private closed = false;

  public async execute(sql: string, params: unknown[] = []): Promise<QueryResult> {
    if (this.closed) throw new Error('Database is closed');

    // Strip comments, trailing semicolons, and normalize whitespaces
    const cleanSql = sql
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/;+\s*$/, '')
      .trim();

    if (!cleanSql) return { rows: [], rowsAffected: 0 };

    const trimmed = cleanSql;
    const upper = trimmed.toUpperCase();

    // 1. CREATE TABLE
    if (upper.startsWith('CREATE TABLE')) {
      const match = trimmed.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        if (!this.tables.has(tableName)) {
          this.tables.set(tableName, { rows: [], hasUpdateTrigger: false, hasDeleteTrigger: false });
        }
      }
      return { rows: [], rowsAffected: 0 };
    }

    // 2. CREATE INDEX
    if (upper.startsWith('CREATE INDEX')) {
      return { rows: [], rowsAffected: 0 };
    }

    // 3. CREATE TRIGGER
    if (upper.startsWith('CREATE TRIGGER')) {
      const match = trimmed.match(/CREATE\s+TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s+BEFORE\s+(UPDATE|DELETE)\s+ON\s+([a-zA-Z0-9_]+)/i);
      if (match) {
        const triggerType = match[2].toUpperCase();
        const tableName = match[3].toLowerCase();
        const table = this.tables.get(tableName);
        if (table) {
          if (triggerType === 'UPDATE') table.hasUpdateTrigger = true;
          if (triggerType === 'DELETE') table.hasDeleteTrigger = true;
        }
      }
      return { rows: [], rowsAffected: 0 };
    }

    // 4. INSERT INTO
    if (upper.startsWith('INSERT INTO')) {
      const match = trimmed.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        const colNames = match[2].split(',').map((c) => c.trim().toLowerCase());
        const table = this.tables.get(tableName);
        if (!table) {
          throw new Error(`Table ${tableName} does not exist`);
        }

        const newRow: Record<string, unknown> = {};
        for (let i = 0; i < colNames.length; i++) {
          newRow[colNames[i]] = params[i] !== undefined ? params[i] : null;
        }

        table.rows.push(newRow);
        return { rows: [], rowsAffected: 1, insertId: table.rows.length };
      }
    }

    // 5. UPDATE
    if (upper.startsWith('UPDATE')) {
      const match = trimmed.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        const table = this.tables.get(tableName);
        if (!table) throw new Error(`Table ${tableName} does not exist`);

        // Check for immutability trigger
        if (table.hasUpdateTrigger) {
          throw new Error(`AUDIT VIOLATION: ${tableName} records are strictly immutable. Update prohibited.`);
        }

        const setClauses = match[2].split(',').map((s) => s.trim());
        const whereClause = match[3] ? match[3].trim() : undefined;

        let paramIdx = 0;
        const updates: Record<string, unknown> = {};
        for (const clause of setClauses) {
          const [col] = clause.split('=').map((c) => c.trim().toLowerCase());
          updates[col] = params[paramIdx++];
        }

        let updatedCount = 0;
        for (const row of table.rows) {
          let matches = true;
          if (whereClause) {
            const [whereCol] = whereClause.split('=').map((w) => w.trim().toLowerCase());
            const expectedVal = params[paramIdx];
            matches = row[whereCol] === expectedVal;
          }

          if (matches) {
            Object.assign(row, updates);
            updatedCount++;
          }
        }

        return { rows: [], rowsAffected: updatedCount };
      }
    }

    // 6. DELETE
    if (upper.startsWith('DELETE FROM')) {
      const match = trimmed.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        const table = this.tables.get(tableName);
        if (table && table.hasDeleteTrigger) {
          throw new Error(`AUDIT VIOLATION: ${tableName} records are strictly immutable. Delete prohibited.`);
        }
      }
    }

    // 7. SELECT
    if (upper.startsWith('SELECT')) {
      const fromMatch = trimmed.match(/FROM\s+([a-zA-Z0-9_]+)/i);
      if (!fromMatch) return { rows: [], rowsAffected: 0 };

      const tableName = fromMatch[1].toLowerCase();
      const table = this.tables.get(tableName);
      if (!table) return { rows: [], rowsAffected: 0 };

      let filteredRows = [...table.rows];

      // Simple WHERE filter support (e.g., WHERE session_id = ?)
      if (upper.includes('WHERE')) {
        const whereMatch = trimmed.match(/WHERE\s+([a-zA-Z0-9_]+)\s*=\s*\?/i);
        if (whereMatch && params.length > 0) {
          const colName = whereMatch[1].toLowerCase();
          const targetVal = params[0];
          filteredRows = filteredRows.filter((r) => r[colName] === targetVal);
        }
      }

      // ORDER BY support
      if (upper.includes('ORDER BY')) {
        const orderMatch = trimmed.match(/ORDER\s+BY\s+([a-zA-Z0-9_]+)\s+(ASC|DESC)/i);
        if (orderMatch) {
          const col = orderMatch[1].toLowerCase();
          const isDesc = orderMatch[2].toUpperCase() === 'DESC';
          filteredRows.sort((a, b) => {
            const valA = Number(a[col] ?? 0);
            const valB = Number(b[col] ?? 0);
            return isDesc ? valB - valA : valA - valB;
          });
        }
      }

      return { rows: filteredRows, rowsAffected: 0 };
    }

    return { rows: [], rowsAffected: 0 };
  }

  public async executeBatch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<void> {
    for (const stmt of statements) {
      await this.execute(stmt.sql, stmt.params);
    }
  }

  public async close(): Promise<void> {
    this.closed = true;
    this.tables.clear();
  }
}
