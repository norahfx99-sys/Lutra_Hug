// Pure care-cost logic: no SQLite, no React. Amounts are integer VND.

export const CATEGORIES = [
  'medical',
  'medication',
  'education',
  'transport',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  medical: 'Khám & trị liệu',
  medication: 'Thuốc',
  education: 'Giáo dục đặc biệt',
  transport: 'Đi lại',
  other: 'Khác',
};

export type Allocation = { childId: string; amountVnd: number };

export type Child = { id: string; displayName: string; isActive: boolean };

export type Expense = {
  id: string;
  amountVnd: number;
  spentOn: string; // local date YYYY-MM-DD
  description: string;
  category: Category;
  note: string | null;
  createdAt: number; // ms, tie-break only
  allocations: Allocation[];
};

export type ExpenseInput = Omit<Expense, 'id' | 'createdAt'> & { id?: string };

/** 'YYYY-MM' */
export type Month = string;

const pad = (n: number) => String(n).padStart(2, '0');

export const localDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const monthOf = (date: string | Date): Month =>
  (typeof date === 'string' ? date : localDate(date)).slice(0, 7);

// Integer month arithmetic: never goes through Date.setMonth (MoneyLover's 31st bug).
export function addMonths(month: Month, delta: number): Month {
  const [y, m] = month.split('-').map(Number);
  const i = y * 12 + (m - 1) + delta;
  return `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
}

export const prevMonth = (month: Month) => addMonths(month, -1);

export function daysInMonth(month: Month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export const isVnd = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;

function isValidDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
  );
}

/**
 * Even split; the leftover đồng go one each to children in ascending childId order,
 * so the parts always sum exactly to the total.
 */
export function splitEvenly(
  amountVnd: number,
  childIds: string[],
): Allocation[] {
  const ids = [...new Set(childIds)].sort();
  if (ids.length === 0) return [];
  const base = Math.floor(amountVnd / ids.length);
  const rest = amountVnd - base * ids.length;
  return ids.map((childId, i) => ({
    childId,
    amountVnd: base + (i < rest ? 1 : 0),
  }));
}

/** Single validation path for every entry point. Returns messages; empty = valid. */
export function validateExpense(e: ExpenseInput, today: string): string[] {
  const errors: string[] = [];
  if (!isVnd(e.amountVnd) || e.amountVnd <= 0)
    errors.push('Số tiền phải là số nguyên dương');
  if (!isValidDate(e.spentOn)) errors.push('Ngày không hợp lệ');
  else if (e.spentOn > today) errors.push('Ngày chi không được ở tương lai');
  if (!e.description.trim()) errors.push('Vui lòng nhập mô tả');
  if (!CATEGORIES.includes(e.category)) errors.push('Vui lòng chọn danh mục');
  if (e.allocations.length === 0) errors.push('Chọn ít nhất một trẻ');
  const ids = new Set(e.allocations.map(a => a.childId));
  if (ids.size !== e.allocations.length) errors.push('Trẻ bị chọn trùng');
  if (e.allocations.some(a => !isVnd(a.amountVnd)))
    errors.push('Phần phân bổ phải là số nguyên không âm');
  else if (e.allocations.reduce((s, a) => s + a.amountVnd, 0) !== e.amountVnd)
    errors.push('Tổng phân bổ phải bằng số tiền');
  return errors;
}

// ---- Aggregation. `childId` undefined = whole family (each expense counted once). ----

export function amountFor(e: Expense, childId?: string) {
  if (childId === undefined) return e.amountVnd;
  return e.allocations.find(a => a.childId === childId)?.amountVnd ?? 0;
}

export const forChild = (expenses: Expense[], childId?: string) =>
  childId === undefined
    ? expenses
    : expenses.filter(e => e.allocations.some(a => a.childId === childId));

export const inMonth = (expenses: Expense[], month: Month) =>
  expenses.filter(e => monthOf(e.spentOn) === month);

export const total = (expenses: Expense[], childId?: string) =>
  expenses.reduce((s, e) => s + amountFor(e, childId), 0);

export function categoryTotals(expenses: Expense[], childId?: string) {
  const out = Object.fromEntries(CATEGORIES.map(c => [c, 0])) as Record<
    Category,
    number
  >;
  for (const e of expenses) out[e.category] += amountFor(e, childId);
  return out;
}

export function childTotals(expenses: Expense[]) {
  const out: Record<string, number> = {};
  for (const e of expenses)
    for (const a of e.allocations)
      out[a.childId] = (out[a.childId] ?? 0) + a.amountVnd;
  return out;
}

export type BudgetProgress = {
  spent: number;
  budget: number | null;
  remaining: number | null;
  over: number;
  ratio: number | null; // real ratio, may exceed 1; null when no budget or budget 0
};

export function budgetProgress(
  budget: number | null,
  spent: number,
): BudgetProgress {
  if (budget === null)
    return { spent, budget, remaining: null, over: 0, ratio: null };
  return {
    spent,
    budget,
    remaining: Math.max(budget - spent, 0),
    over: Math.max(spent - budget, 0),
    ratio: budget > 0 ? spent / budget : null,
  };
}

/**
 * One point per calendar day, ordered by full date, zero-spend days included.
 * For the current month, stops at `today`.
 */
export function dailySeries(
  expenses: Expense[],
  month: Month,
  today: string,
  childId?: string,
) {
  if (month > monthOf(today)) return [];
  const last =
    month === monthOf(today) ? Number(today.slice(8)) : daysInMonth(month);
  const byDay = new Map<string, number>();
  for (const e of expenses)
    byDay.set(e.spentOn, (byDay.get(e.spentOn) ?? 0) + amountFor(e, childId));
  return Array.from({ length: last }, (_, i) => {
    const date = `${month}-${pad(i + 1)}`;
    return { date, amountVnd: byDay.get(date) ?? 0 };
  });
}

/** `percent` is null when the previous month is 0: no baseline, show `diff` only. */
export function compareMonths(current: number, previous: number) {
  return {
    current,
    previous,
    diff: current - previous,
    percent: previous === 0 ? null : ((current - previous) / previous) * 100,
  };
}

/** Newest by spend date, then creation time, then id — never insertion order. */
export function recentExpenses(expenses: Expense[], n: number) {
  return [...expenses]
    .sort(
      (a, b) =>
        b.spentOn.localeCompare(a.spentOn) ||
        b.createdAt - a.createdAt ||
        b.id.localeCompare(a.id),
    )
    .slice(0, n);
}

// ---- Presentation helpers (pure; rounding only here, never before summing). ----

/** '1234567' -> '1.234.567'. No Intl: Hermes locale data varies by build. */
export const groupThousands = (digits: string) =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Groups digits while typing; non-digit input is returned as is so validation still rejects it. */
export const groupAmountInput = (v: string) => {
  const digits = v.replace(/\./g, '');
  return /^\d*$/.test(digits) ? groupThousands(digits) : v;
};

/** 1234567 -> '1.234.567 đ'. */
export function formatVnd(n: number, signed = false) {
  const digits = groupThousands(String(Math.abs(n)));
  const sign = n < 0 ? '-' : signed && n > 0 ? '+' : '';
  return `${sign}${digits} đ`;
}

/** Strict: plain digits or '.'-grouped thousands. Anything else is null, never "repaired". */
export function parseVnd(s: string): number | null {
  const t = s.trim();
  if (!/^(\d+|\d{1,3}(\.\d{3})+)$/.test(t)) return null;
  const n = Number(t.replace(/\./g, ''));
  return isVnd(n) ? n : null;
}

/** '2026-09' -> 'Tháng 9, 2026' */
export const monthLabel = (month: Month) =>
  `Tháng ${Number(month.slice(5))}, ${month.slice(0, 4)}`;

/** '2026-09-07' -> '07/09' (withYear: '07/09/2026') */
export const dayLabel = (date: string, withYear = false) =>
  `${date.slice(8)}/${date.slice(5, 7)}${
    withYear ? `/${date.slice(0, 4)}` : ''
  }`;

/** Last day a month report covers: today for the running month, else the month's last day. */
export const periodEnd = (month: Month, today: string) =>
  month === monthOf(today) ? today : `${month}-${pad(daysInMonth(month))}`;

/** Case-insensitive match on description and note; empty query keeps everything. */
export function searchExpenses(expenses: Expense[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return expenses;
  return expenses.filter(e =>
    `${e.description}\n${e.note ?? ''}`.toLowerCase().includes(q),
  );
}

/** Groups by spend date, newest full date first (string compare on YYYY-MM-DD = calendar order). */
export function groupByDay(expenses: Expense[], childId?: string) {
  const groups: { date: string; total: number; items: Expense[] }[] = [];
  for (const e of recentExpenses(expenses, expenses.length)) {
    const last = groups[groups.length - 1];
    if (last?.date === e.spentOn) {
      last.items.push(e);
      last.total += amountFor(e, childId);
    } else
      groups.push({
        date: e.spentOn,
        total: amountFor(e, childId),
        items: [e],
      });
  }
  return groups;
}

/** Rounded whole percent for labels; null when there is no base. */
export const percentLabel = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 100) : null;
