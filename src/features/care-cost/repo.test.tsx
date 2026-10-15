import ReactTestRenderer from 'react-test-renderer';
import { newId, setDb } from './db';
import { budgetProgress, splitEvenly, total } from './domain';
import { installFakeDb } from './fakeDb.testutil';
import { useExpenses, useMonthlyBudget } from './hooks';
import {
  createFamily,
  deleteExpense,
  getOnboarded,
  listChildren,
  listExpenses,
  saveChild,
  saveExpense,
  setMonthlyBudget,
  setOnboarded,
  ValidationError,
} from './repo';

const TODAY = '2026-03-31';
let raw: Awaited<ReturnType<typeof installFakeDb>>;
let a: string;
let b: string;

const input = (
  amountVnd: number,
  childIds: string[],
  spentOn = '2026-03-15',
) => ({
  amountVnd,
  spentOn,
  description: 'Trị liệu',
  category: 'medical' as const,
  note: null,
  allocations: splitEvenly(amountVnd, childIds),
});

beforeEach(async () => {
  raw = await installFakeDb();
  await createFamily('Test', await newId());
  a = await saveChild({ displayName: 'An' }, await newId());
  b = await saveChild({ displayName: 'Bình' }, await newId());
});
afterEach(() => setDb(null));

test('migration from empty DB ends at the latest version', () => {
  expect(raw.prepare('PRAGMA user_version').get()).toEqual({ user_version: 3 });
});

test('ids are UUID v4 from randomness, not Date.now()', async () => {
  const ids = await Promise.all(Array.from({ length: 500 }, () => newId()));
  expect(new Set(ids).size).toBe(500);
  for (const id of ids)
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
});

test('onboarding flag persists in the DB', async () => {
  expect(await getOnboarded()).toBe(false);
  await setOnboarded();
  expect(await getOnboarded()).toBe(true);
});

test('expense + allocations + change log are written together; family total not doubled', async () => {
  await saveExpense(input(100_001, [a, b]), await newId(), TODAY);
  const [e] = await listExpenses('2026-03');
  expect(e.allocations.reduce((s, x) => s + x.amountVnd, 0)).toBe(100_001);
  const all = await listExpenses('2026-03');
  expect(total(all)).toBe(100_001);
  expect(total(all, a) + total(all, b)).toBe(100_001);
  expect(raw.prepare('SELECT count(*) n FROM change_log').get()).toEqual({
    n: 4,
  });
});

test('retry with the same operationId does not duplicate', async () => {
  const op = await newId();
  await saveExpense(input(500, [a]), op, TODAY);
  await saveExpense(input(500, [a]), op, TODAY);
  expect(await listExpenses('2026-03')).toHaveLength(1);
});

test('failed write rolls back entity and change log', async () => {
  const before = raw.prepare('SELECT count(*) n FROM change_log').get();
  await expect(
    saveExpense(
      {
        ...input(500, [a]),
        allocations: [{ childId: 'ghost', amountVnd: 500 }],
      },
      await newId(),
      TODAY,
    ),
  ).rejects.toBeInstanceOf(ValidationError);
  expect(raw.prepare('SELECT count(*) n FROM change_log').get()).toEqual(
    before,
  );
  expect(raw.prepare('SELECT count(*) n FROM expense').get()).toEqual({ n: 0 });
});

test('edit bumps version; delete is a tombstone hidden from reads', async () => {
  const id = await saveExpense(input(500, [a]), await newId(), TODAY);
  await saveExpense({ ...input(800, [a, b]), id }, await newId(), TODAY);
  expect((await listExpenses('2026-03'))[0].amountVnd).toBe(800);
  await deleteExpense(id, await newId());
  expect(await listExpenses('2026-03')).toEqual([]);
  expect(
    raw.prepare('SELECT version, deleted_at IS NOT NULL d FROM expense').get(),
  ).toEqual({ version: 3, d: 1 });
});

test('stopped child keeps history but cannot be picked for new expenses', async () => {
  const id = await saveExpense(input(500, [b]), await newId(), TODAY);
  await saveChild(
    { id: b, displayName: 'Bình', isActive: false },
    await newId(),
  );
  expect((await listChildren()).find(c => c.id === b)?.isActive).toBe(false);
  await expect(
    saveExpense(input(100, [b]), await newId(), TODAY),
  ).rejects.toBeInstanceOf(ValidationError);
  await saveExpense({ ...input(600, [b]), id }, await newId(), TODAY); // editing old expense still fine
  expect(total(await listExpenses('2026-03'), b)).toBe(600);
});

test('month filter keeps month boundaries', async () => {
  await saveExpense(input(1, [a], '2026-02-28'), await newId(), TODAY);
  await saveExpense(input(2, [a], '2026-03-01'), await newId(), TODAY);
  await saveExpense(input(3, [a], '2026-03-31'), await newId(), TODAY);
  expect(total(await listExpenses('2026-03'))).toBe(5);
  expect(total(await listExpenses('2026-02'))).toBe(1);
});

test('budget summary re-renders when expenses change (MoneyLover stale summary bug)', async () => {
  await setMonthlyBudget('2026-03', 1000, await newId());
  const seen: (number | null)[] = [];
  function Summary() {
    const { data: expenses } = useExpenses('2026-03');
    const { data: budget } = useMonthlyBudget('2026-03');
    if (expenses && budget !== undefined)
      seen.push(budgetProgress(budget, total(expenses)).remaining);
    return null;
  }
  let root!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    root = ReactTestRenderer.create(<Summary />);
  });
  expect(seen.at(-1)).toBe(1000);
  await ReactTestRenderer.act(async () => {
    await saveExpense(input(300, [a]), await newId(), TODAY);
  });
  expect(seen.at(-1)).toBe(700);
  const id = (await listExpenses('2026-03'))[0].id;
  await ReactTestRenderer.act(async () => {
    await deleteExpense(id, await newId());
  });
  expect(seen.at(-1)).toBe(1000);
  await ReactTestRenderer.act(async () => root.unmount());
});
