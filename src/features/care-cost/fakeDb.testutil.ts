/// <reference types="node" />
// Test-only: node:sqlite shaped like the op-sqlite subset we use (same SQL, no SQLCipher).
import { DatabaseSync } from 'node:sqlite';
import { migrate, setDb, type Sql } from './db';

/** Standalone in-memory device; tests that need two devices call setDb() to switch. */
export async function makeFakeDb() {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  const execute = async (q: string, p: unknown[] = []) => {
    const stmt = raw.prepare(q);
    if (stmt.columns().length === 0) {
      const r = stmt.run(...(p as never[]));
      return { rows: [], rowsAffected: Number(r.changes) };
    }
    return { rows: stmt.all(...(p as never[])), rowsAffected: 0 };
  };
  const db = {
    execute,
    transaction: async (
      fn: (tx: { execute: typeof execute }) => Promise<void>,
    ) => {
      raw.exec('BEGIN');
      try {
        await fn({ execute });
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  } as unknown as Sql;
  await migrate(db);
  return { raw, db };
}

export async function installFakeDb() {
  const { raw, db } = await makeFakeDb();
  setDb(db);
  return raw;
}
