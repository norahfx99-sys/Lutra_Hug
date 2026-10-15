import {
  addMonths,
  budgetProgress,
  categoryTotals,
  childTotals,
  compareMonths,
  dailySeries,
  dayLabel,
  formatVnd,
  groupAmountInput,
  groupByDay,
  monthLabel,
  parseVnd,
  percentLabel,
  periodEnd,
  searchExpenses,
  monthOf,
  prevMonth,
  recentExpenses,
  splitEvenly,
  total,
  validateExpense,
  type Expense,
} from './domain';

const exp = (p: Partial<Expense>): Expense => ({
  id: 'e',
  amountVnd: 100,
  spentOn: '2026-03-01',
  description: 'x',
  category: 'other',
  note: null,
  createdAt: 0,
  allocations: [{ childId: 'a', amountVnd: p.amountVnd ?? 100 }],
  ...p,
});

describe('splitEvenly', () => {
  test('one child gets everything', () => {
    expect(splitEvenly(100_000, ['a'])).toEqual([
      { childId: 'a', amountVnd: 100_000 },
    ]);
  });
  test('remainder goes one đồng each in childId order, sum exact', () => {
    const parts = splitEvenly(100_001, ['c', 'a', 'b']);
    expect(parts).toEqual([
      { childId: 'a', amountVnd: 33_334 },
      { childId: 'b', amountVnd: 33_334 },
      { childId: 'c', amountVnd: 33_333 },
    ]);
    expect(parts.reduce((s, p) => s + p.amountVnd, 0)).toBe(100_001);
  });
  test('sum is exact for many totals and child counts', () => {
    for (let n = 1; n <= 7; n++)
      for (const amount of [1, 2, 99, 1_000_003, Number.MAX_SAFE_INTEGER]) {
        const ids = Array.from({ length: n }, (_, i) => `k${i}`);
        const parts = splitEvenly(amount, ids);
        expect(parts.reduce((s, p) => s + p.amountVnd, 0)).toBe(amount);
        expect(parts.every(p => Number.isInteger(p.amountVnd))).toBe(true);
      }
  });
});

describe('validateExpense', () => {
  const ok = {
    amountVnd: 300,
    spentOn: '2026-03-10',
    description: ' Khám ',
    category: 'medical' as const,
    note: null,
    allocations: [
      { childId: 'a', amountVnd: 200 },
      { childId: 'b', amountVnd: 100 },
    ],
  };
  test('accepts a custom split that sums to the total', () => {
    expect(validateExpense(ok, '2026-03-10')).toEqual([]);
  });
  test.each([
    ['float amount', { amountVnd: 1.5 }],
    ['zero amount', { amountVnd: 0 }],
    ['future date', { spentOn: '2026-03-11' }],
    ['invalid date', { spentOn: '2026-02-30' }],
    ['blank description', { description: '  ' }],
    ['unknown category', { category: 'food' as never }],
    ['no child', { allocations: [] }],
    ['split off by one', { allocations: [{ childId: 'a', amountVnd: 299 }] }],
    [
      'duplicate child',
      {
        allocations: [
          { childId: 'a', amountVnd: 150 },
          { childId: 'a', amountVnd: 150 },
        ],
      },
    ],
  ])('rejects %s', (_, patch) => {
    expect(
      validateExpense({ ...ok, ...patch }, '2026-03-10').length,
    ).toBeGreaterThan(0);
  });
});

describe('months', () => {
  test('previous month from the 31st is the calendar month before (MoneyLover bug)', () => {
    expect(prevMonth(monthOf(new Date(2026, 2, 31)))).toBe('2026-02');
    expect(prevMonth(monthOf(new Date(2026, 4, 31)))).toBe('2026-04');
  });
  test('year boundaries', () => {
    expect(prevMonth('2026-01')).toBe('2025-12');
    expect(addMonths('2025-12', 1)).toBe('2026-01');
  });
});

describe('aggregation', () => {
  const shared = exp({
    id: 's',
    amountVnd: 300,
    allocations: [
      { childId: 'a', amountVnd: 150 },
      { childId: 'b', amountVnd: 150 },
    ],
  });
  const onlyB = exp({
    id: 'o',
    amountVnd: 50,
    category: 'medication',
    allocations: [{ childId: 'b', amountVnd: 50 }],
  });

  test('family total counts each expense once; child total uses its allocation', () => {
    expect(total([shared, onlyB])).toBe(350);
    expect(total([shared, onlyB], 'a')).toBe(150);
    expect(total([shared, onlyB], 'b')).toBe(200);
    expect(childTotals([shared, onlyB])).toEqual({ a: 150, b: 200 });
  });
  test('category totals cover every fixed category', () => {
    expect(categoryTotals([shared, onlyB])).toEqual({
      medical: 0,
      medication: 50,
      education: 0,
      transport: 0,
      other: 300,
    });
  });
});

test('budget progress: none, zero, under, over', () => {
  expect(budgetProgress(null, 10).ratio).toBeNull();
  expect(budgetProgress(0, 10)).toMatchObject({
    ratio: null,
    over: 10,
    remaining: 0,
  });
  expect(budgetProgress(100, 40)).toMatchObject({
    remaining: 60,
    over: 0,
    ratio: 0.4,
  });
  expect(budgetProgress(100, 150)).toMatchObject({
    remaining: 0,
    over: 50,
    ratio: 1.5,
  });
});

describe('dailySeries', () => {
  test('days ordered numerically with zero days filled (MoneyLover "1,10,2" bug)', () => {
    const s = dailySeries(
      [
        exp({ spentOn: '2026-03-10', amountVnd: 5 }),
        exp({ spentOn: '2026-03-02', amountVnd: 7 }),
      ],
      '2026-03',
      '2026-04-15',
    );
    expect(s).toHaveLength(31);
    expect(s.slice(0, 3).map(p => p.date)).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
    ]);
    expect(s[1].amountVnd).toBe(7);
    expect(s[9]).toEqual({ date: '2026-03-10', amountVnd: 5 });
  });
  test('current month stops at today; future month is empty', () => {
    expect(dailySeries([], '2026-03', '2026-03-12')).toHaveLength(12);
    expect(dailySeries([], '2026-04', '2026-03-12')).toEqual([]);
  });
});

test('compare with zero previous month gives no percentage (MoneyLover 100% bug)', () => {
  expect(compareMonths(500, 0)).toEqual({
    current: 500,
    previous: 0,
    diff: 500,
    percent: null,
  });
  expect(compareMonths(150, 100).percent).toBe(50);
});

test('recent expenses sort by date, then createdAt, then id — not insertion order', () => {
  const list = [
    exp({ id: 'old', spentOn: '2026-03-01', createdAt: 9 }),
    exp({ id: 'b', spentOn: '2026-03-05', createdAt: 1 }),
    exp({ id: 'late', spentOn: '2026-03-05', createdAt: 2 }),
    exp({ id: 'c', spentOn: '2026-03-05', createdAt: 1 }),
  ];
  expect(recentExpenses(list, 3).map(e => e.id)).toEqual(['late', 'c', 'b']);
});

describe('presentation helpers', () => {
  test('formatVnd groups thousands and signs', () => {
    expect(formatVnd(0)).toBe('0 đ');
    expect(formatVnd(1000000)).toBe('1.000.000 đ');
    expect(formatVnd(-200000)).toBe('-200.000 đ');
    expect(formatVnd(200000, true)).toBe('+200.000 đ');
  });

  test('groupAmountInput groups while typing and leaves bad input for validation', () => {
    expect(groupAmountInput('')).toBe('');
    expect(groupAmountInput('1250000')).toBe('1.250.000');
    expect(groupAmountInput('1.250.0000')).toBe('12.500.000'); // a digit typed into a grouped value
    expect(groupAmountInput('12a')).toBe('12a');
    expect(parseVnd(groupAmountInput('450000'))).toBe(450000);
  });

  test('parseVnd accepts digits or grouped thousands only', () => {
    expect(parseVnd('450000')).toBe(450000);
    expect(parseVnd('450.000')).toBe(450000);
    expect(parseVnd(' 1.000.000 ')).toBe(1000000);
    for (const bad of [
      '',
      '-5',
      '1e3',
      '45.00',
      '1,000',
      '12a',
      '9007199254740993',
    ])
      expect(parseVnd(bad)).toBeNull();
  });

  test('labels and period end', () => {
    expect(monthLabel('2026-09')).toBe('Tháng 9, 2026');
    expect(dayLabel('2026-09-07')).toBe('07/09');
    expect(dayLabel('2026-09-07', true)).toBe('07/09/2026');
    expect(periodEnd('2026-09', '2026-09-07')).toBe('2026-09-07');
    expect(periodEnd('2024-02', '2026-09-07')).toBe('2024-02-29');
    expect(percentLabel(1000, 800)).toBe(125);
    expect(percentLabel(5, 0)).toBeNull();
  });

  test('searchExpenses matches description and note, case-insensitive', () => {
    const list = [
      exp({ id: 'a', description: 'Thuốc theo đơn' }),
      exp({ id: 'b', description: 'Xe', note: 'Đi THUỐC' }),
      exp({ id: 'c', description: 'Học' }),
    ];
    expect(searchExpenses(list, 'thuốc').map(e => e.id)).toEqual(['a', 'b']);
    expect(searchExpenses(list, '  ')).toHaveLength(3);
  });

  test('groupByDay orders full dates numerically, newest first, with per-child totals', () => {
    const list = [
      exp({ id: 'd2', spentOn: '2026-03-02', amountVnd: 10 }),
      exp({ id: 'd10', spentOn: '2026-03-10', amountVnd: 20 }),
      exp({
        id: 'd10b',
        spentOn: '2026-03-10',
        amountVnd: 30,
        createdAt: 5,
        allocations: [
          { childId: 'a', amountVnd: 10 },
          { childId: 'b', amountVnd: 20 },
        ],
      }),
      exp({ id: 'd1', spentOn: '2026-03-01', amountVnd: 5 }),
    ];
    const g = groupByDay(list);
    expect(g.map(x => x.date)).toEqual([
      '2026-03-10',
      '2026-03-02',
      '2026-03-01',
    ]);
    expect(g[0].items.map(e => e.id)).toEqual(['d10b', 'd10']);
    expect(g[0].total).toBe(50);
    expect(groupByDay(list, 'b')[0].total).toBe(20);
  });
});
