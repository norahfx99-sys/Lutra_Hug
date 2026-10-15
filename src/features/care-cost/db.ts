import { open, type DB } from '@op-engineering/op-sqlite';
import * as Keychain from 'react-native-keychain';

export type Sql = Pick<DB, 'execute' | 'transaction'>;
export type Tx = Parameters<Parameters<Sql['transaction']>[0]>[0];

// Append-only. Each entry runs once, in order; PRAGMA user_version tracks progress.
const MIGRATIONS = [
  `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE family (
    id TEXT PRIMARY KEY,
    locale TEXT NOT NULL DEFAULT 'vi-VN',
    currency TEXT NOT NULL DEFAULT 'VND',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE device (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family(id),
    display_name TEXT NOT NULL,
    last_sync_at INTEGER
  );
  CREATE TABLE child (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family(id),
    display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_by_device_id TEXT NOT NULL,
    deleted_at INTEGER
  );
  CREATE TABLE expense (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family(id),
    amount_vnd INTEGER NOT NULL CHECK (typeof(amount_vnd) = 'integer' AND amount_vnd > 0),
    spent_on TEXT NOT NULL,
    description TEXT NOT NULL CHECK (length(trim(description)) > 0),
    category TEXT NOT NULL CHECK (category IN ('medical','medication','education','transport','other')),
    note TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_by_device_id TEXT NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX expense_spent_on ON expense(spent_on);
  CREATE TABLE expense_allocation (
    expense_id TEXT NOT NULL REFERENCES expense(id),
    child_id TEXT NOT NULL REFERENCES child(id),
    amount_vnd INTEGER NOT NULL CHECK (typeof(amount_vnd) = 'integer' AND amount_vnd >= 0),
    PRIMARY KEY (expense_id, child_id)
  );
  CREATE TABLE monthly_budget (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL REFERENCES family(id),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    amount_vnd INTEGER NOT NULL CHECK (typeof(amount_vnd) = 'integer' AND amount_vnd >= 0),
    updated_at INTEGER NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_by_device_id TEXT NOT NULL,
    deleted_at INTEGER,
    UNIQUE (family_id, year, month)
  );
  CREATE TABLE change_log (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_id TEXT NOT NULL UNIQUE,
    device_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    base_version INTEGER,
    op TEXT NOT NULL CHECK (op IN ('upsert','delete')),
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  `,
  `
  CREATE TABLE conflict (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    local TEXT,
    remote TEXT NOT NULL,
    remote_version INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    resolved_at INTEGER,
    resolved_operation_id TEXT
  );
  CREATE INDEX conflict_entity ON conflict(entity_type, entity_id);
  `,
  // AI chat history: device-local only, never written to change_log, never synced.
  `
  CREATE TABLE chat_conversation (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    summary TEXT,
    summarized_upto INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE chat_message (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES chat_conversation(id),
    role TEXT NOT NULL CHECK (role IN ('user','assistant')),
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','sent','failed'))
  );
  CREATE INDEX chat_message_conv ON chat_message(conversation_id, created_at);
  `,
];

export async function migrate(db: Sql) {
  const { rows } = await db.execute('PRAGMA user_version');
  const from = Number(rows[0]?.user_version ?? 0);
  for (let v = from; v < MIGRATIONS.length; v++) {
    await db.transaction(async tx => {
      for (const stmt of MIGRATIONS[v].split(';')) {
        if (stmt.trim()) await tx.execute(stmt);
      }
      await tx.execute(`PRAGMA user_version = ${v + 1}`);
    });
  }
  const id = await db.execute("SELECT value FROM meta WHERE key = 'device_id'");
  if (id.rows.length === 0)
    await db.execute("INSERT INTO meta (key, value) VALUES ('device_id', ?)", [
      await newId(db),
    ]);
}

/** UUID v4 from SQLite's CSPRNG (Hermes has no crypto.getRandomValues). */
export async function newId(db: Pick<Sql, 'execute'> = getDb()) {
  const { rows } = await db.execute('SELECT lower(hex(randomblob(16))) AS h');
  const h = String(rows[0].h);
  const variant = '89ab'[parseInt(h[16], 16) % 4];
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(
    13,
    16,
  )}-${variant}${h.slice(17, 20)}-${h.slice(20)}`;
}

let current: Sql | null = null;
let opening: Promise<Sql> | null = null;

/** Tests inject a fake here; the app path goes through openDb(). */
export function setDb(db: Sql | null) {
  current = db;
  opening = db ? Promise.resolve(db) : null;
}

export function getDb() {
  if (!current) throw new Error('Database not open');
  return current;
}

const KEY_SERVICE = 'lutra-hug.db-key';

async function dbKey() {
  const saved = await Keychain.getGenericPassword({ service: KEY_SERVICE });
  if (saved) return saved.password;
  const tmp = open({ name: 'keygen', location: ':memory:' });
  const { rows } = await tmp.execute('SELECT hex(randomblob(32)) AS k');
  tmp.close();
  const key = String(rows[0].k);
  const ok = await Keychain.setGenericPassword('db', key, {
    service: KEY_SERVICE,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  if (!ok) throw new Error('Could not store database key');
  return key;
}

export function openDb(): Promise<Sql> {
  opening ??= (async () => {
    const db = open({ name: 'lutra-hug.db', encryptionKey: await dbKey() });
    await db.execute('PRAGMA foreign_keys = ON');
    await migrate(db);
    current = db;
    return db;
  })().catch(e => {
    opening = null;
    throw e;
  });
  return opening;
}

// Change notification: writers call emit() after commit; hooks re-query.
const listeners = new Set<() => void>();
let revision = 0;
export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const getRevision = () => revision;
export function emit() {
  revision++;
  listeners.forEach(fn => fn());
}
