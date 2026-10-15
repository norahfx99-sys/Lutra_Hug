import { newId, setDb, type Sql } from '../care-cost/db';
import { splitEvenly } from '../care-cost/domain';
import { makeFakeDb } from '../care-cost/fakeDb.testutil';
import {
  createFamily,
  deleteExpense,
  listChildren,
  listExpenses,
  saveChild,
  saveExpense,
  setMonthlyBudget,
  getMonthlyBudget,
} from '../care-cost/repo';
import {
  applyRemote,
  changesMissingFrom,
  DeviceLimitError,
  FamilyMismatchError,
  NoFamilyError,
  listConflicts,
  resolveConflict,
  runSync,
  type Link,
  type Msg,
} from './engine';

const MONTH = '2026-03';
let A: Sql;
let B: Sql;

/** Run `fn` as if `db` were this phone's database. */
async function on<T>(db: Sql, fn: () => Promise<T>) {
  setDb(db);
  return fn();
}

function linkPair(): [Link, Link] {
  const q: [Msg[], Msg[]] = [[], []];
  const waiters: [((m: Msg) => void)[], ((m: Msg) => void)[]] = [[], []];
  const end = (me: 0 | 1): Link => ({
    async send(m) {
      const w = waiters[1 - me].shift();
      if (w) w(m);
      else q[1 - me].push(m);
    },
    receive: () =>
      new Promise(res => {
        const m = q[me].shift();
        if (m) res(m);
        else waiters[me].push(res);
      }),
  });
  return [end(0), end(1)];
}

async function sync() {
  const [la, lb] = linkPair();
  const [ra, rb] = await Promise.all([
    runSync(A, la, { deviceName: 'A' }),
    runSync(B, lb, { deviceName: 'B' }),
  ]);
  return { a: ra, b: rb };
}

const exp = (
  amountVnd: number,
  childIds: string[],
  description = 'Trị liệu',
) => ({
  amountVnd,
  spentOn: '2026-03-15',
  description,
  category: 'medical' as const,
  note: null,
  allocations: splitEvenly(amountVnd, childIds),
});

let kid: string;

beforeEach(async () => {
  A = (await makeFakeDb()).db;
  B = (await makeFakeDb()).db;
  await on(A, async () => {
    await createFamily('A', await newId());
    kid = await saveChild({ displayName: 'An' }, await newId());
  });
});
afterEach(() => setDb(null));

const expensesOn = (db: Sql) => on(db, () => listExpenses(MONTH));

test('first pairing copies the family to an empty phone', async () => {
  await on(A, async () => saveExpense(exp(100000, [kid]), await newId()));
  const r = await sync();
  expect(r.b.conflicts).toBe(0);
  expect((await on(B, listChildren)).map(c => c.displayName)).toEqual(['An']);
  expect(await expensesOn(B)).toHaveLength(1);
  expect(await expensesOn(A)).toEqual(await expensesOn(B));
});

test('two-way exchange and re-running sync does not duplicate', async () => {
  await sync();
  await on(A, async () =>
    saveExpense(exp(100000, [kid], 'từ A'), await newId()),
  );
  await on(B, async () =>
    saveExpense(exp(50000, [kid], 'từ B'), await newId()),
  );
  await sync();
  expect(await expensesOn(A)).toHaveLength(2);
  expect(await expensesOn(B)).toHaveLength(2);
  const again = await sync();
  expect(again.a).toEqual({ applied: 0, conflicts: 0 });
  expect(again.b).toEqual({ applied: 0, conflicts: 0 });
});

test('tombstone propagates and an old edit cannot resurrect the expense', async () => {
  let id = '';
  await on(A, async () => {
    id = await saveExpense(exp(100000, [kid]), await newId());
  });
  await sync();
  await on(A, async () => deleteExpense(id, await newId()));
  await sync();
  expect(await expensesOn(B)).toHaveLength(0);
});

test('delete vs edit on the same base version creates a conflict, no silent overwrite', async () => {
  let id = '';
  await on(A, async () => {
    id = await saveExpense(exp(100000, [kid]), await newId());
  });
  await sync();
  await on(A, async () => deleteExpense(id, await newId()));
  await on(B, async () =>
    saveExpense({ ...exp(70000, [kid]), id }, await newId()),
  );
  const r = await sync();
  expect(r.a.conflicts).toBe(1);
  expect(r.b.conflicts).toBe(1);
  expect(await listConflicts(A)).toHaveLength(1);
  expect(await expensesOn(A)).toHaveLength(0); // A kept its delete
  expect((await expensesOn(B))[0].amountVnd).toBe(70000); // B kept its edit
});

test('conflict resolution syncs back and both phones converge', async () => {
  let id = '';
  await on(A, async () => {
    id = await saveExpense(exp(100000, [kid]), await newId());
  });
  await sync();
  await on(A, async () =>
    saveExpense({ ...exp(80000, [kid], 'A sửa'), id }, await newId()),
  );
  await on(B, async () =>
    saveExpense({ ...exp(90000, [kid], 'B sửa'), id }, await newId()),
  );
  await sync();
  const [ca] = await listConflicts(A);
  await on(A, async () => resolveConflict(A, ca.id, 'remote', await newId()));
  await sync();
  expect(await listConflicts(A)).toHaveLength(0);
  expect(await listConflicts(B)).toHaveLength(0);
  expect(await expensesOn(A)).toEqual(await expensesOn(B));
  expect((await expensesOn(B))[0].description).toBe('B sửa');
});

test('both phones resolving differently still converge (higher operationId wins)', async () => {
  let id = '';
  await on(A, async () => {
    id = await saveExpense(exp(100000, [kid]), await newId());
  });
  await sync();
  await on(A, async () =>
    saveExpense({ ...exp(80000, [kid], 'A'), id }, await newId()),
  );
  await on(B, async () =>
    saveExpense({ ...exp(90000, [kid], 'B'), id }, await newId()),
  );
  await sync();
  await on(A, async () =>
    resolveConflict(A, (await listConflicts(A))[0].id, 'local', await newId()),
  );
  await on(B, async () =>
    resolveConflict(B, (await listConflicts(B))[0].id, 'local', await newId()),
  );
  await sync();
  expect(await expensesOn(A)).toEqual(await expensesOn(B));
  expect(await listConflicts(A)).toHaveLength(0);
  expect(await listConflicts(B)).toHaveLength(0);
});

test('concurrent budget for the same month is a conflict, not a unique-constraint crash', async () => {
  await sync();
  await on(A, async () => setMonthlyBudget(MONTH, 1000000, await newId()));
  await on(B, async () => setMonthlyBudget(MONTH, 2000000, await newId()));
  const r = await sync();
  expect(r.a.conflicts + r.b.conflicts).toBeGreaterThan(0);
  expect(await on(A, () => getMonthlyBudget(MONTH))).toBe(1000000);
  expect(await on(B, () => getMonthlyBudget(MONTH))).toBe(2000000);
});

test('a failing change rolls the whole batch back and a retry succeeds', async () => {
  await on(A, async () => saveExpense(exp(100000, [kid]), await newId()));
  const all = await changesMissingFrom(A, []);
  const bad = {
    ...all[all.length - 1],
    operationId: 'zzz',
    entityId: 'x',
    payload: {
      ...all[all.length - 1].payload,
      id: 'x',
      allocations: [{ childId: 'missing', amountVnd: 100000 }],
    },
  };
  await expect(applyRemote(B, [...all, bad])).rejects.toThrow();
  expect(await on(B, listChildren)).toEqual([]);
  await sync();
  expect(await expensesOn(B)).toHaveLength(1);
});

test('different families refuse to sync', async () => {
  await on(B, async () => createFamily('B', await newId()));
  const [la, lb] = linkPair();
  await expect(
    Promise.all([
      runSync(A, la, { deviceName: 'A' }),
      runSync(B, lb, { deviceName: 'B' }),
    ]),
  ).rejects.toBeInstanceOf(FamilyMismatchError);
});

test('a third phone is refused before any data reaches it', async () => {
  await sync();
  const C = (await makeFakeDb()).db;
  const [la, lc] = linkPair();
  await expect(
    Promise.all([
      runSync(A, la, { deviceName: 'A' }),
      runSync(C, lc, { deviceName: 'C' }),
    ]),
  ).rejects.toBeInstanceOf(DeviceLimitError);
  expect(await on(C, listChildren)).toEqual([]);
});

test('two phones without a family do not pair', async () => {
  const E1 = (await makeFakeDb()).db;
  const [l1, l2] = linkPair();
  await expect(
    Promise.all([
      runSync(E1, l1, { deviceName: 'X' }),
      runSync(B, l2, { deviceName: 'Y' }),
    ]),
  ).rejects.toBeInstanceOf(NoFamilyError);
});

test('the peer is recorded under the name it announced', async () => {
  await sync();
  const { rows } = await A.execute(
    'SELECT display_name FROM device ORDER BY display_name',
  );
  expect(rows.map(r => r.display_name)).toEqual(['A', 'B']);
});
