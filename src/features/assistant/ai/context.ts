import {
  CATEGORIES,
  CATEGORY_LABELS,
  addMonths,
  budgetProgress,
  categoryTotals,
  childTotals,
  compareMonths,
  dayLabel,
  formatVnd,
  localDate,
  monthLabel,
  monthOf,
  percentLabel,
  recentExpenses,
  total,
  type Child,
  type Expense,
  type Month,
} from '../../care-cost/domain';
import {
  getMonthlyBudget,
  listChildren,
  listExpenses,
} from '../../care-cost/repo';

// The on-device data block sent with each question. Split into sections ordered by importance:
// promptBuilder drops from the END when the token budget is tight.

export type Privacy = { shareChildNames: boolean; shareDescriptions: boolean };

export type Snapshot = {
  today: string;
  month: Month;
  prevMonth: Month;
  current: Expense[];
  previous: Expense[];
  budget: number | null;
  children: Child[];
};

export async function loadSnapshot(now = new Date()): Promise<Snapshot> {
  const month = monthOf(now);
  const prevMonth = addMonths(month, -1);
  const [current, previous, budget, children] = await Promise.all([
    listExpenses(month),
    listExpenses(prevMonth),
    getMonthlyBudget(month),
    listChildren(),
  ]);
  return {
    today: localDate(now),
    month,
    prevMonth,
    current,
    previous,
    budget,
    children,
  };
}

// Free text from the family's own records: one line, bounded, so it cannot reshape the prompt.
const oneLine = (s: string, max = 80) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

function byCategory(expenses: Expense[]) {
  const t = categoryTotals(expenses);
  const sum = total(expenses);
  return CATEGORIES.filter(c => t[c] > 0)
    .sort((a, b) => t[b] - t[a])
    .map(
      c =>
        `${CATEGORY_LABELS[c]} ${formatVnd(t[c])} (${percentLabel(
          t[c],
          sum,
        )}%)`,
    )
    .join('; ');
}

export function contextSections(s: Snapshot, p: Privacy): string[] {
  const out: string[] = [];
  const spent = total(s.current);
  const prevSpent = total(s.previous);

  out.push(
    [
      `Hôm nay: ${dayLabel(s.today, true)}. Đơn vị tiền: VND.`,
      s.current.length
        ? `${monthLabel(s.month)}: tổng ${formatVnd(spent)} (${
            s.current.length
          } khoản chi). Theo nhóm: ${byCategory(s.current)}.`
        : `${monthLabel(s.month)}: chưa có khoản chi nào được ghi.`,
    ].join('\n'),
  );

  const b = budgetProgress(s.budget, spent);
  out.push(
    b.budget === null
      ? 'Ngân sách tháng này: chưa đặt.'
      : `Ngân sách tháng này: ${formatVnd(b.budget)}; đã dùng ${formatVnd(
          b.spent,
        )}${b.ratio === null ? '' : ` (${Math.round(b.ratio * 100)}%)`}; ${
          b.over > 0
            ? `đã vượt ${formatVnd(b.over)}`
            : `còn lại ${formatVnd(b.remaining ?? 0)}`
        }.`,
  );

  if (s.previous.length) {
    const cmp = compareMonths(spent, prevSpent);
    const dir = cmp.diff > 0 ? 'nhiều hơn' : 'ít hơn';
    const pct =
      cmp.percent === null ? '' : ` (${Math.abs(Math.round(cmp.percent))}%)`;
    out.push(
      [
        `${monthLabel(s.prevMonth)}: tổng ${formatVnd(prevSpent)} (${
          s.previous.length
        } khoản chi). Theo nhóm: ${byCategory(s.previous)}.`,
        cmp.diff === 0
          ? 'So với tháng trước: bằng nhau.'
          : `So với tháng trước, tháng này ${dir} ${formatVnd(
              Math.abs(cmp.diff),
            )}${pct}.`,
      ].join('\n'),
    );
  } else {
    out.push(`${monthLabel(s.prevMonth)}: chưa có khoản chi nào được ghi.`);
  }

  const per = childTotals(s.current);
  const label = (c: Child, i: number) =>
    p.shareChildNames ? oneLine(c.displayName, 40) : `Trẻ ${i + 1}`;
  const rows = s.children
    .map((c, i) => ({ name: label(c, i), amount: per[c.id] ?? 0 }))
    .filter(r => r.amount > 0);
  out.push(
    `Gia đình đang theo dõi ${s.children.filter(c => c.isActive).length} trẻ.${
      rows.length
        ? ` Chi tháng này theo từng trẻ (khoản chung đã chia): ${rows
            .map(r => `${r.name} ${formatVnd(r.amount)}`)
            .join('; ')}.`
        : ''
    }`,
  );

  const recent = recentExpenses(s.current, 10);
  if (recent.length)
    out.push(
      `Các khoản chi gần đây trong tháng:\n${recent
        .map(e => {
          const base = `- ${dayLabel(e.spentOn)} · ${
            CATEGORY_LABELS[e.category]
          } · ${formatVnd(e.amountVnd)}`;
          if (!p.shareDescriptions) return base;
          const note = e.note ? ` (ghi chú: ${oneLine(e.note)})` : '';
          return `${base} · ${oneLine(e.description)}${note}`;
        })
        .join('\n')}`,
    );

  return out;
}

export const buildContext = async (p: Privacy, now = new Date()) =>
  contextSections(await loadSnapshot(now), p);

/** Questions the local data can actually answer; empty when there is nothing to ask about. */
export function suggestQuestions(s: Snapshot): string[] {
  const out: string[] = [];
  if (s.current.length) out.push('Tháng này mình chi nhiều nhất vào nhóm nào?');
  if (s.current.length && s.previous.length)
    out.push('So với tháng trước thế nào?');
  if (s.budget !== null) out.push('Mình còn bao nhiêu ngân sách tháng này?');
  if (s.current.length && s.children.filter(c => c.isActive).length > 1)
    out.push('Trẻ nào đang tốn chi phí nhiều nhất tháng này?');
  return out;
}
