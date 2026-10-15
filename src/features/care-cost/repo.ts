import { emit, getDb, newId, type Tx } from './db';
import {
  isVnd,
  localDate,
  validateExpense,
  type Category,
  type Child,
  type Expense,
  type ExpenseInput,
  type Month,
} from './domain';

// Every write: one transaction = entity rows + change_log row, then emit() after commit.
// `operationId` comes from the caller and is kept across retries; a replay is a no-op.

export class ValidationError extends Error {
  constructor(public errors: string[]) {
    super(errors.join('; '));
  }
}

type Change = {
  operationId: string;
  entityType: 'family' | 'child' | 'expense' | 'monthly_budget';
  entityId: string;
  baseVersion: number | null;
  op: 'upsert' | 'delete';
  payload: unknown;
};

async function write(
  operationId: string,
  fn: (
    tx: Tx,
    ctx: { deviceId: string; familyId: string; now: number },
  ) => Promise<Omit<Change, 'operationId'>>,
) {
  let applied = false;
  await getDb().transaction(async tx => {
    const seen = await tx.execute(
      'SELECT 1 FROM change_log WHERE operation_id = ?',
      [operationId],
    );
    if (seen.rows.length) return;
    const meta = await tx.execute(
      "SELECT (SELECT value FROM meta WHERE key = 'device_id') AS d, (SELECT id FROM family LIMIT 1) AS f",
    );
    const deviceId = String(meta.rows[0].d);
    const familyId = meta.rows[0].f as string;
    const now = Date.now();
    const c = await fn(tx, { deviceId, familyId, now });
    await tx.execute(
      `INSERT INTO change_log (operation_id, device_id, entity_type, entity_id, base_version, op, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        operationId,
        deviceId,
        c.entityType,
        c.entityId,
        c.baseVersion,
        c.op,
        JSON.stringify(c.payload),
        now,
      ],
    );
    applied = true;
  });
  if (applied) emit();
}

// ---- Family / onboarding ----

export async function getFamily() {
  const { rows } = await getDb().execute(
    'SELECT id, locale, currency FROM family LIMIT 1',
  );
  return rows[0]
    ? {
        id: String(rows[0].id),
        locale: String(rows[0].locale),
        currency: String(rows[0].currency),
      }
    : null;
}

/** Creates the single local family and registers this device in it. Idempotent. */
export async function createFamily(deviceName: string, operationId: string) {
  if (await getFamily()) return;
  const id = await newId();
  await write(operationId, async (tx, { deviceId, now }) => {
    await tx.execute(
      'INSERT INTO family (id, created_at, updated_at) VALUES (?, ?, ?)',
      [id, now, now],
    );
    await tx.execute(
      'INSERT INTO device (id, family_id, display_name) VALUES (?, ?, ?)',
      [deviceId, id, deviceName],
    );
    return {
      entityType: 'family',
      entityId: id,
      baseVersion: null,
      op: 'upsert',
      payload: { id, locale: 'vi-VN', currency: 'VND' },
    };
  });
}

export async function getOnboarded() {
  const { rows } = await getDb().execute(
    "SELECT 1 FROM meta WHERE key = 'onboarded' AND value = '1'",
  );
  return rows.length > 0;
}

/** Device-local flag, not synced. */
export async function setOnboarded() {
  await getDb().execute(
    "INSERT OR REPLACE INTO meta (key, value) VALUES ('onboarded', '1')",
  );
  emit();
}

// ---- Children ----

export async function listChildren(): Promise<Child[]> {
  const { rows } = await getDb().execute(
    'SELECT id, display_name, is_active FROM child WHERE deleted_at IS NULL ORDER BY created_at, id',
  );
  return rows.map(r => ({
    id: String(r.id),
    displayName: String(r.display_name),
    isActive: Number(r.is_active) === 1,
  }));
}

/** Add (no id) or rename / stop tracking. Children are never hard-deleted. */
export async function saveChild(
  input: { id?: string; displayName: string; isActive?: boolean },
  operationId: string,
) {
  const name = input.displayName.trim();
  if (!name) throw new ValidationError(['Vui lòng nhập tên trẻ']);
  const id = input.id ?? (await newId());
  await write(operationId, async (tx, { deviceId, familyId, now }) => {
    if (!familyId) throw new Error('No family');
    const prev = await tx.execute(
      'SELECT version, is_active FROM child WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    const base = prev.rows[0] ? Number(prev.rows[0].version) : null;
    if (input.id && base === null) throw new Error('Child not found');
    const isActive =
      input.isActive ??
      (prev.rows[0] ? Number(prev.rows[0].is_active) === 1 : true);
    if (base === null) {
      await tx.execute(
        `INSERT INTO child (id, family_id, display_name, is_active, created_at, updated_at, updated_by_device_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, familyId, name, isActive ? 1 : 0, now, now, deviceId],
      );
    } else {
      await tx.execute(
        `UPDATE child SET display_name = ?, is_active = ?, updated_at = ?, version = version + 1,
         updated_by_device_id = ? WHERE id = ?`,
        [name, isActive ? 1 : 0, now, deviceId, id],
      );
    }
    return {
      entityType: 'child',
      entityId: id,
      baseVersion: base,
      op: 'upsert',
      payload: { id, displayName: name, isActive },
    };
  });
  return id;
}

// ---- Expenses ----

export async function listExpenses(month: Month): Promise<Expense[]> {
  const db = getDb();
  const { rows } = await db.execute(
    `SELECT id, amount_vnd, spent_on, description, category, note, created_at FROM expense
     WHERE deleted_at IS NULL AND spent_on >= ? AND spent_on < ?`,
    [`${month}-01`, `${month}-32`],
  );
  const alloc = await db.execute(
    `SELECT a.expense_id, a.child_id, a.amount_vnd FROM expense_allocation a
     JOIN expense e ON e.id = a.expense_id
     WHERE e.deleted_at IS NULL AND e.spent_on >= ? AND e.spent_on < ? ORDER BY a.child_id`,
    [`${month}-01`, `${month}-32`],
  );
  const byExpense = new Map<string, Expense['allocations']>();
  for (const a of alloc.rows) {
    const list = byExpense.get(String(a.expense_id)) ?? [];
    list.push({ childId: String(a.child_id), amountVnd: Number(a.amount_vnd) });
    byExpense.set(String(a.expense_id), list);
  }
  return rows.map(r => ({
    id: String(r.id),
    amountVnd: Number(r.amount_vnd),
    spentOn: String(r.spent_on),
    description: String(r.description),
    category: r.category as Category,
    note: r.note == null ? null : String(r.note),
    createdAt: Number(r.created_at),
    allocations: byExpense.get(String(r.id)) ?? [],
  }));
}

/** Insert (no id) or update. Validation and the allocation-sum rule run here for every entry path. */
export async function saveExpense(
  input: ExpenseInput,
  operationId: string,
  today = localDate(new Date()),
) {
  const e = {
    ...input,
    description: input.description.trim(),
    note: input.note?.trim() || null,
  };
  const errors = validateExpense(e, today);
  if (errors.length) throw new ValidationError(errors);
  const id = e.id ?? (await newId());
  await write(operationId, async (tx, { deviceId, familyId, now }) => {
    if (!familyId) throw new Error('No family');
    const prev = await tx.execute(
      'SELECT version FROM expense WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    const base = prev.rows[0] ? Number(prev.rows[0].version) : null;
    if (e.id && base === null) throw new Error('Expense not found');
    // Inactive children stay valid on an expense that already had them, but cannot be newly picked.
    for (const a of e.allocations) {
      const ok = await tx.execute(
        `SELECT 1 FROM child c WHERE c.id = ? AND c.deleted_at IS NULL AND (c.is_active = 1
         OR EXISTS (SELECT 1 FROM expense_allocation x WHERE x.expense_id = ? AND x.child_id = c.id))`,
        [a.childId, id],
      );
      if (!ok.rows.length) throw new ValidationError(['Trẻ không hợp lệ']);
    }
    if (base === null) {
      await tx.execute(
        `INSERT INTO expense (id, family_id, amount_vnd, spent_on, description, category, note,
         created_at, updated_at, updated_by_device_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          familyId,
          e.amountVnd,
          e.spentOn,
          e.description,
          e.category,
          e.note,
          now,
          now,
          deviceId,
        ],
      );
    } else {
      await tx.execute(
        `UPDATE expense SET amount_vnd = ?, spent_on = ?, description = ?, category = ?, note = ?,
         updated_at = ?, version = version + 1, updated_by_device_id = ? WHERE id = ?`,
        [
          e.amountVnd,
          e.spentOn,
          e.description,
          e.category,
          e.note,
          now,
          deviceId,
          id,
        ],
      );
      await tx.execute('DELETE FROM expense_allocation WHERE expense_id = ?', [
        id,
      ]);
    }
    for (const a of e.allocations)
      await tx.execute(
        'INSERT INTO expense_allocation (expense_id, child_id, amount_vnd) VALUES (?, ?, ?)',
        [id, a.childId, a.amountVnd],
      );
    return {
      entityType: 'expense',
      entityId: id,
      baseVersion: base,
      op: 'upsert',
      payload: { ...e, id },
    };
  });
  return id;
}

/** Tombstone, not a physical delete, so sync can propagate it. */
export async function deleteExpense(id: string, operationId: string) {
  await write(operationId, async (tx, { deviceId, now }) => {
    const prev = await tx.execute(
      'SELECT version FROM expense WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    if (!prev.rows[0]) throw new Error('Expense not found');
    await tx.execute(
      `UPDATE expense SET deleted_at = ?, updated_at = ?, version = version + 1,
       updated_by_device_id = ? WHERE id = ?`,
      [now, now, deviceId, id],
    );
    return {
      entityType: 'expense',
      entityId: id,
      baseVersion: Number(prev.rows[0].version),
      op: 'delete',
      payload: { id },
    };
  });
}

// ---- Monthly family budget ----

export async function getMonthlyBudget(month: Month): Promise<number | null> {
  const [y, m] = month.split('-').map(Number);
  const { rows } = await getDb().execute(
    'SELECT amount_vnd FROM monthly_budget WHERE year = ? AND month = ? AND deleted_at IS NULL',
    [y, m],
  );
  return rows[0] ? Number(rows[0].amount_vnd) : null;
}

export async function setMonthlyBudget(
  month: Month,
  amountVnd: number,
  operationId: string,
) {
  if (!isVnd(amountVnd))
    throw new ValidationError(['Ngân sách phải là số nguyên không âm']);
  const [y, m] = month.split('-').map(Number);
  const freshId = await newId();
  await write(operationId, async (tx, { deviceId, familyId, now }) => {
    if (!familyId) throw new Error('No family');
    const prev = await tx.execute(
      'SELECT id, version FROM monthly_budget WHERE family_id = ? AND year = ? AND month = ?',
      [familyId, y, m],
    );
    const row = prev.rows[0];
    const id = row ? String(row.id) : freshId;
    if (row) {
      await tx.execute(
        `UPDATE monthly_budget SET amount_vnd = ?, deleted_at = NULL, updated_at = ?,
         version = version + 1, updated_by_device_id = ? WHERE id = ?`,
        [amountVnd, now, deviceId, id],
      );
    } else {
      await tx.execute(
        `INSERT INTO monthly_budget (id, family_id, year, month, amount_vnd, updated_at, updated_by_device_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, familyId, y, m, amountVnd, now, deviceId],
      );
    }
    return {
      entityType: 'monthly_budget',
      entityId: id,
      baseVersion: row ? Number(row.version) : null,
      op: 'upsert',
      payload: { id, year: y, month: m, amountVnd },
    };
  });
}

/** Live (not deleted) expenses allocated to each child, all time. Children with none are absent. */
export async function childAllocationCounts(): Promise<Record<string, number>> {
  const { rows } = await getDb().execute(
    `SELECT a.child_id, COUNT(*) AS n FROM expense_allocation a
     JOIN expense e ON e.id = a.expense_id WHERE e.deleted_at IS NULL GROUP BY a.child_id`,
  );
  return Object.fromEntries(rows.map(r => [String(r.child_id), Number(r.n)]));
}
