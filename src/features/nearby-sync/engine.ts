import { emit, newId, type Sql, type Tx } from '../care-cost/db';

// Transport-agnostic sync. The Nearby layer only has to move `Msg` objects between two phones;
// everything below runs on plain SQL so it is testable without hardware.
// Conflicts come from base versions only, never from device clocks.

type EntityType = 'family' | 'child' | 'expense' | 'monthly_budget';
type Op = 'upsert' | 'delete';
// Row payloads are JSON written by repo.ts; fields are validated by the SQL CHECKs on insert.
type Payload = { id: string; [field: string]: any };

export type WireChange = {
  operationId: string;
  deviceId: string;
  entityType: EntityType;
  entityId: string;
  baseVersion: number | null;
  op: Op;
  payload: Payload & { __resolve?: number };
  createdAt: number;
};

export type Msg =
  | {
      t: 'hello';
      familyId: string | null;
      deviceId: string;
      name: string;
      devices: string[]; // ids already paired on the sender, so both sides can enforce the limit up front
      ops: string[];
    }
  | { t: 'changes'; changes: WireChange[] };

export type Link = {
  send(m: Msg): Promise<void>;
  receive(): Promise<Msg>;
};

export class FamilyMismatchError extends Error {}
export class DeviceLimitError extends Error {}
export class NoFamilyError extends Error {}

const MAX_DEVICES = 2;
const TABLE = {
  child: 'child',
  expense: 'expense',
  monthly_budget: 'monthly_budget',
} as const;

type Entity = { version: number; deleted: boolean; payload: Payload };
type Side = { op: Op; payload: Payload };

async function readEntity(
  tx: Pick<Tx, 'execute'>,
  type: keyof typeof TABLE,
  id: string,
): Promise<Entity | null> {
  const q = (sql: string) => tx.execute(sql, [id]);
  if (type === 'child') {
    const r = (
      await q('SELECT display_name, is_active, version FROM child WHERE id = ?')
    ).rows[0];
    return r
      ? {
          version: Number(r.version),
          deleted: false,
          payload: {
            id,
            displayName: String(r.display_name),
            isActive: Number(r.is_active) === 1,
          },
        }
      : null;
  }
  if (type === 'monthly_budget') {
    const r = (
      await q(
        'SELECT year, month, amount_vnd, version, deleted_at FROM monthly_budget WHERE id = ?',
      )
    ).rows[0];
    return r
      ? {
          version: Number(r.version),
          deleted: r.deleted_at != null,
          payload: {
            id,
            year: Number(r.year),
            month: Number(r.month),
            amountVnd: Number(r.amount_vnd),
          },
        }
      : null;
  }
  const r = (
    await q(
      `SELECT amount_vnd, spent_on, description, category, note, version, deleted_at
       FROM expense WHERE id = ?`,
    )
  ).rows[0];
  if (!r) return null;
  const al = await tx.execute(
    'SELECT child_id, amount_vnd FROM expense_allocation WHERE expense_id = ? ORDER BY child_id',
    [id],
  );
  return {
    version: Number(r.version),
    deleted: r.deleted_at != null,
    payload: {
      id,
      amountVnd: Number(r.amount_vnd),
      spentOn: String(r.spent_on),
      description: String(r.description),
      category: String(r.category),
      note: r.note == null ? null : String(r.note),
      allocations: al.rows.map(a => ({
        childId: String(a.child_id),
        amountVnd: Number(a.amount_vnd),
      })),
    },
  };
}

type Ctx = { deviceId: string; familyId: string; now: number };

/** Writes one entity state with an explicit resulting version. */
async function writeEntity(
  tx: Tx,
  type: keyof typeof TABLE,
  op: Op,
  p: Payload,
  version: number,
  createdAt: number,
  c: Ctx,
) {
  const id = p.id;
  if (type === 'child') {
    await tx.execute(
      `INSERT INTO child (id, family_id, display_name, is_active, created_at, updated_at, version, updated_by_device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, is_active = excluded.is_active,
         updated_at = excluded.updated_at, version = excluded.version, updated_by_device_id = excluded.updated_by_device_id`,
      [
        id,
        c.familyId,
        p.displayName,
        p.isActive ? 1 : 0,
        createdAt,
        c.now,
        version,
        c.deviceId,
      ],
    );
  } else if (type === 'monthly_budget') {
    await tx.execute(
      `INSERT INTO monthly_budget (id, family_id, year, month, amount_vnd, updated_at, version, updated_by_device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET amount_vnd = excluded.amount_vnd, deleted_at = NULL,
         updated_at = excluded.updated_at, version = excluded.version, updated_by_device_id = excluded.updated_by_device_id`,
      [
        id,
        c.familyId,
        p.year,
        p.month,
        p.amountVnd,
        c.now,
        version,
        c.deviceId,
      ],
    );
  } else if (op === 'delete') {
    await tx.execute(
      `UPDATE expense SET deleted_at = ?, updated_at = ?, version = ?, updated_by_device_id = ? WHERE id = ?`,
      [c.now, c.now, version, c.deviceId, id],
    );
  } else {
    await tx.execute(
      `INSERT INTO expense (id, family_id, amount_vnd, spent_on, description, category, note, created_at, updated_at, version, updated_by_device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET amount_vnd = excluded.amount_vnd, spent_on = excluded.spent_on,
         description = excluded.description, category = excluded.category, note = excluded.note,
         deleted_at = NULL, updated_at = excluded.updated_at, version = excluded.version,
         updated_by_device_id = excluded.updated_by_device_id`,
      [
        id,
        c.familyId,
        p.amountVnd,
        p.spentOn,
        p.description,
        p.category,
        p.note ?? null,
        createdAt,
        c.now,
        version,
        c.deviceId,
      ],
    );
    await tx.execute('DELETE FROM expense_allocation WHERE expense_id = ?', [
      id,
    ]);
    for (const a of p.allocations as { childId: string; amountVnd: number }[])
      await tx.execute(
        'INSERT INTO expense_allocation (expense_id, child_id, amount_vnd) VALUES (?, ?, ?)',
        [id, a.childId, a.amountVnd],
      );
  }
}

async function context(tx: Tx): Promise<Ctx & { hasFamily: boolean }> {
  const r = (
    await tx.execute(
      "SELECT (SELECT value FROM meta WHERE key = 'device_id') AS d, (SELECT id FROM family LIMIT 1) AS f",
    )
  ).rows[0];
  return {
    deviceId: String(r.d),
    familyId: r.f == null ? '' : String(r.f),
    hasFamily: r.f != null,
    now: Date.now(),
  };
}

function logChange(tx: Tx, c: WireChange) {
  return tx.execute(
    `INSERT INTO change_log (operation_id, device_id, entity_type, entity_id, base_version, op, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      c.operationId,
      c.deviceId,
      c.entityType,
      c.entityId,
      c.baseVersion,
      c.op,
      JSON.stringify(c.payload),
      c.createdAt,
    ],
  );
}

export async function changesMissingFrom(
  db: Sql,
  have: string[],
): Promise<WireChange[]> {
  const known = new Set(have);
  const { rows } = await db.execute('SELECT * FROM change_log ORDER BY seq');
  return rows
    .filter(r => !known.has(String(r.operation_id)))
    .map(r => ({
      operationId: String(r.operation_id),
      deviceId: String(r.device_id),
      entityType: r.entity_type as EntityType,
      entityId: String(r.entity_id),
      baseVersion: r.base_version == null ? null : Number(r.base_version),
      op: r.op as Op,
      payload: JSON.parse(String(r.payload)),
      createdAt: Number(r.created_at),
    }));
}

/** Applies remote changes in one transaction. A replayed operationId is a no-op. */
export async function applyRemote(db: Sql, changes: WireChange[]) {
  let applied = 0;
  let conflicts = 0;
  await db.transaction(async tx => {
    const ctx = await context(tx);
    for (const ch of changes) {
      const seen = await tx.execute(
        'SELECT 1 FROM change_log WHERE operation_id = ?',
        [ch.operationId],
      );
      if (seen.rows.length) continue;
      await logChange(tx, ch);
      const r = await applyOne(tx, ch, ctx);
      if (r === 'applied') applied++;
      else if (r === 'conflict') conflicts++;
    }
  });
  if (applied || conflicts) emit();
  return { applied, conflicts };
}

async function applyOne(
  tx: Tx,
  ch: WireChange,
  ctx: Ctx & { hasFamily: boolean },
): Promise<'applied' | 'conflict' | 'held' | 'skipped'> {
  if (ch.entityType === 'family') {
    if (!ctx.hasFamily) {
      await tx.execute(
        'INSERT INTO family (id, locale, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [
          ch.payload.id,
          ch.payload.locale ?? 'vi-VN',
          ch.payload.currency ?? 'VND',
          ch.createdAt,
          ch.createdAt,
        ],
      );
      ctx.familyId = ch.payload.id;
      ctx.hasFamily = true;
      return 'applied';
    }
    if (ctx.familyId !== ch.payload.id) throw new FamilyMismatchError();
    return 'skipped';
  }
  const type = ch.entityType;
  if (!(type in TABLE)) return 'skipped';
  if (ch.op === 'delete' && type !== 'expense') return 'skipped'; // only expenses are deletable

  // Budgets are unique per month: a concurrent create has a different id but the same month.
  let id = ch.entityId;
  if (type === 'monthly_budget' && ch.op === 'upsert') {
    const m = await tx.execute(
      'SELECT id FROM monthly_budget WHERE family_id = ? AND year = ? AND month = ?',
      [ctx.familyId, ch.payload.year, ch.payload.month],
    );
    if (m.rows[0]) id = String(m.rows[0].id);
  }
  const local = await readEntity(tx, type, id);
  const remote: Side = { op: ch.op, payload: { ...ch.payload, id } };
  const resolveVersion = ch.payload.__resolve;
  if (resolveVersion !== undefined) {
    delete (remote.payload as { __resolve?: number }).__resolve;
    return applyResolve(tx, ch, type, id, remote, resolveVersion, ctx);
  }

  const open = await tx.execute(
    'SELECT id FROM conflict WHERE entity_type = ? AND entity_id = ? AND resolved_at IS NULL',
    [type, id],
  );
  const remoteVersion = (ch.baseVersion ?? 0) + 1;
  if (open.rows[0]) {
    // Later edits to a contested entity ride on the open conflict instead of overwriting it.
    await tx.execute(
      'UPDATE conflict SET remote = ?, remote_version = ? WHERE id = ?',
      [JSON.stringify(remote), remoteVersion, open.rows[0].id],
    );
    return 'held';
  }
  if ((local?.version ?? null) === ch.baseVersion && id === ch.entityId) {
    await writeEntity(
      tx,
      type,
      ch.op,
      remote.payload,
      remoteVersion,
      ch.createdAt,
      {
        ...ctx,
        deviceId: ch.deviceId,
      },
    );
    return 'applied';
  }
  await tx.execute(
    `INSERT INTO conflict (id, entity_type, entity_id, local, remote, remote_version, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      await newId(tx),
      type,
      id,
      local
        ? JSON.stringify({
            op: local.deleted ? 'delete' : 'upsert',
            payload: local.payload,
          })
        : null,
      JSON.stringify(remote),
      remoteVersion,
      ctx.now,
    ],
  );
  return 'conflict';
}

/**
 * A resolution carries its target version and overwrites. If both phones resolved the same
 * entity differently, the higher operationId wins on both sides, so they converge without clocks.
 */
async function applyResolve(
  tx: Tx,
  ch: WireChange,
  type: keyof typeof TABLE,
  id: string,
  remote: Side,
  version: number,
  ctx: Ctx,
): Promise<'applied' | 'skipped'> {
  const mine = await tx.execute(
    `SELECT resolved_operation_id AS o FROM conflict
     WHERE entity_type = ? AND entity_id = ? AND resolved_at IS NOT NULL
     ORDER BY resolved_at DESC, rowid DESC LIMIT 1`,
    [type, id],
  );
  const own = mine.rows[0]?.o == null ? null : String(mine.rows[0].o);
  if (own !== null && own > ch.operationId) return 'skipped';
  await writeEntity(
    tx,
    type,
    remote.op,
    remote.payload,
    version,
    ch.createdAt,
    {
      ...ctx,
      deviceId: ch.deviceId,
    },
  );
  await tx.execute(
    `UPDATE conflict SET resolved_at = ?, resolved_operation_id = ?
     WHERE entity_type = ? AND entity_id = ? AND (resolved_at IS NULL OR resolved_operation_id < ?)`,
    [ctx.now, ch.operationId, type, id, ch.operationId],
  );
  return 'applied';
}

export type OpenConflict = {
  id: string;
  entityType: EntityType;
  entityId: string;
  local: Side | null;
  remote: Side;
};

export async function listConflicts(db: Sql): Promise<OpenConflict[]> {
  const { rows } = await db.execute(
    'SELECT * FROM conflict WHERE resolved_at IS NULL ORDER BY created_at, id',
  );
  return rows.map(r => ({
    id: String(r.id),
    entityType: r.entity_type as EntityType,
    entityId: String(r.entity_id),
    local: r.local == null ? null : JSON.parse(String(r.local)),
    remote: JSON.parse(String(r.remote)),
  }));
}

/** 'local' / 'remote' keep that side; a Side re-enters new data. The decision syncs as a new change. */
export async function resolveConflict(
  db: Sql,
  conflictId: string,
  choice: 'local' | 'remote' | Side,
  operationId: string,
) {
  let done = false;
  await db.transaction(async tx => {
    const ctx = await context(tx);
    const seen = await tx.execute(
      'SELECT 1 FROM change_log WHERE operation_id = ?',
      [operationId],
    );
    if (seen.rows.length) return;
    const c = (
      await tx.execute(
        'SELECT * FROM conflict WHERE id = ? AND resolved_at IS NULL',
        [conflictId],
      )
    ).rows[0];
    if (!c) throw new Error('Conflict not found');
    const type = c.entity_type as keyof typeof TABLE;
    const id = String(c.entity_id);
    const localSide: Side | null =
      c.local == null ? null : JSON.parse(String(c.local));
    const side =
      choice === 'local'
        ? localSide
        : choice === 'remote'
        ? (JSON.parse(String(c.remote)) as Side)
        : choice;
    if (!side) throw new Error('Nothing to keep on this side');
    const local = await readEntity(tx, type, id);
    const version = Math.max(local?.version ?? 0, Number(c.remote_version)) + 1;
    await writeEntity(
      tx,
      type,
      side.op,
      { ...side.payload, id },
      version,
      ctx.now,
      ctx,
    );
    await tx.execute(
      'UPDATE conflict SET resolved_at = ?, resolved_operation_id = ? WHERE id = ?',
      [ctx.now, operationId, conflictId],
    );
    await logChange(tx, {
      operationId,
      deviceId: ctx.deviceId,
      entityType: type,
      entityId: id,
      baseVersion: local?.version ?? null,
      op: side.op,
      payload: { ...side.payload, id, __resolve: version },
      createdAt: ctx.now,
    });
    done = true;
  });
  if (done) emit();
}

/** Two phones max; the peer is recorded once pairing is verified. */
async function registerDevice(db: Sql, deviceId: string, name: string) {
  await db.transaction(async tx => {
    const f = (await tx.execute('SELECT id FROM family LIMIT 1')).rows[0];
    if (!f) return;
    const has = await tx.execute('SELECT 1 FROM device WHERE id = ?', [
      deviceId,
    ]);
    if (!has.rows.length) {
      const n = await tx.execute('SELECT COUNT(*) AS n FROM device');
      if (Number(n.rows[0].n) >= MAX_DEVICES) throw new DeviceLimitError();
      await tx.execute(
        'INSERT INTO device (id, family_id, display_name) VALUES (?, ?, ?)',
        [deviceId, f.id, name],
      );
    }
    await tx.execute('UPDATE device SET last_sync_at = ? WHERE id = ?', [
      Date.now(),
      deviceId,
    ]);
  });
}

/**
 * One manual sync round over an already verified link. Both phones run this symmetrically.
 * `have` is the full operationId list: fine for a family's data size
 * (ponytail: switch to per-device cursors if change_log grows past ~100k rows).
 */
export async function runSync(
  db: Sql,
  link: Link,
  opts: { deviceName: string },
) {
  const me = (
    await db.execute(
      "SELECT (SELECT value FROM meta WHERE key = 'device_id') AS d, (SELECT id FROM family LIMIT 1) AS f",
    )
  ).rows[0];
  const ops = (
    await db.execute('SELECT operation_id FROM change_log')
  ).rows.map(r => String(r.operation_id));
  const devices = (await db.execute('SELECT id FROM device')).rows.map(r =>
    String(r.id),
  );
  await link.send({
    t: 'hello',
    familyId: me.f == null ? null : String(me.f),
    deviceId: String(me.d),
    name: opts.deviceName,
    devices,
    ops,
  });
  const hello = await link.receive();
  if (hello.t !== 'hello') throw new Error('Protocol error');
  if (me.f != null && hello.familyId != null && me.f !== hello.familyId)
    throw new FamilyMismatchError();
  if (me.f == null && hello.familyId == null) throw new NoFamilyError();
  // Checked before any data moves: a third phone must not receive the family and then be refused.
  if (
    new Set([String(me.d), hello.deviceId, ...devices, ...hello.devices]).size >
    MAX_DEVICES
  )
    throw new DeviceLimitError();
  await link.send({
    t: 'changes',
    changes: await changesMissingFrom(db, hello.ops),
  });
  const got = await link.receive();
  if (got.t !== 'changes') throw new Error('Protocol error');
  const result = await applyRemote(db, got.changes);
  await registerDevice(db, hello.deviceId, hello.name);
  await registerDevice(db, String(me.d), opts.deviceName);
  return result;
}
