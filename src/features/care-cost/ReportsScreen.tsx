import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../../shared/theme/theme';
import { BudgetBar, CategoryBars, CompareBars, DailyColumns } from './charts';
import {
  categoryTotals,
  compareMonths,
  dailySeries,
  dayLabel,
  formatVnd,
  localDate,
  monthOf,
  periodEnd,
  prevMonth,
  total,
  type Category,
  type Month,
} from './domain';
import { useExpenses, useMonthlyBudget } from './hooks';
import { EmptyState, SectionHeading, styles as ui } from './ui';

/** "01–07/09/2026" */
const range = (end: string) => `01–${dayLabel(end, true)}`;

// REPORTS (design RQVXV): the "Báo cáo" mode inside the Chi phí tab, so it renders as a body, not a route.
// Not affected by the list's search/category filters; follows month + child filter.
export function ReportsScreen({
  month,
  childId,
  onCategory,
  onPreviousMonth,
  onBudget,
  onAdd,
}: {
  month: Month;
  childId?: string;
  onCategory: (c: Category) => void;
  onPreviousMonth: () => void;
  onBudget: () => void;
  onAdd: () => void;
}) {
  const today = localDate(new Date());
  const prev = prevMonth(month);
  const cur = useExpenses(month, childId);
  const before = useExpenses(prev, childId);
  const budget = useMonthlyBudget(month).data;

  if (cur.error)
    return (
      <View style={styles.content}>
        <EmptyState title="Không tải được báo cáo tháng này." />
      </View>
    );
  if (!cur.data) return null;

  const expenses = cur.data;
  const T = total(expenses, childId);
  const end = periodEnd(month, today);
  const prevEnd = periodEnd(prev, today);
  const running = month === monthOf(today);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        <Text style={styles.onPrimary}>Tổng chi đến {dayLabel(end, true)}</Text>
        <Text style={[ui.bigAmount, styles.onPrimaryStrong]}>
          {formatVnd(T)}
        </Text>
        {childId !== undefined ? (
          <Text style={styles.onPrimary}>
            Phần chi cho trẻ này. Ngân sách áp dụng cho cả gia đình.
          </Text>
        ) : budget === undefined ? null : (
          <>
            {budget === null ? (
              <Text style={styles.onPrimary}>Chưa đặt ngân sách</Text>
            ) : (
              <BudgetBar budget={budget} spent={T} onPrimary />
            )}
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={onBudget}
            >
              <Text style={styles.onPrimaryLink}>
                {budget === null ? 'Đặt ngân sách' : 'Điều chỉnh ngân sách'}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      {expenses.length === 0 ? (
        <EmptyState
          title="Chưa có chi phí trong tháng này"
          body="Biểu đồ sẽ xuất hiện khi có khoản chi."
          action="Thêm chi phí"
          onAction={onAdd}
        />
      ) : (
        <>
          <SectionHeading title="Chi theo nhóm" />
          <CategoryBars
            totals={categoryTotals(expenses, childId)}
            total={T}
            onSelect={onCategory}
          />
          <SectionHeading title="Chi theo ngày" />
          <Text style={ui.muted}>Đơn vị: đồng · {range(end)}</Text>
          <DailyColumns series={dailySeries(expenses, month, today, childId)} />
        </>
      )}

      <SectionHeading title="So với tháng trước" />
      {before.error ? (
        <EmptyState title="Chưa tải được dữ liệu so sánh" />
      ) : !before.data ? null : (
        <Compare
          T={T}
          P={total(before.data, childId)}
          current={categoryTotals(expenses, childId)}
          previous={categoryTotals(before.data, childId)}
          curLabel={range(end)}
          prevLabel={range(prevEnd)}
          running={running}
          onPreviousMonth={onPreviousMonth}
        />
      )}
    </ScrollView>
  );
}

function Compare({
  T,
  P,
  current,
  previous,
  curLabel,
  prevLabel,
  running,
  onPreviousMonth,
}: {
  T: number;
  P: number;
  current: Record<Category, number>;
  previous: Record<Category, number>;
  curLabel: string;
  prevLabel: string;
  running: boolean;
  onPreviousMonth: () => void;
}) {
  const c = compareMonths(T, P);
  const diffLine =
    T === 0 && P === 0
      ? 'Chưa có chi phí trong các kỳ so sánh.'
      : c.percent === null
      ? `Chênh lệch: ${formatVnd(
          c.diff,
          true,
        )}. Kỳ trước chưa ghi nhận chi phí, nên không tính phần trăm.`
      : `Chênh lệch: ${formatVnd(c.diff, true)} (${
          c.percent > 0 ? '+' : ''
        }${Math.round(c.percent)}%)`;
  return (
    <View style={styles.gap}>
      {running && (
        <View style={styles.notice}>
          <Text style={ui.muted}>
            Tháng này chưa kết thúc; đang so với toàn bộ tháng trước.
          </Text>
        </View>
      )}
      <Text style={styles.body}>
        {curLabel}: {formatVnd(T)}
        {'\n'}
        {prevLabel}: {formatVnd(P)}
        {'\n'}
        {diffLine}
      </Text>
      <Text style={ui.muted}>
        Thanh đậm: kỳ đang xem · Thanh nhạt: tháng trước
      </Text>
      <CompareBars current={current} previous={previous} />
      <Pressable
        accessibilityRole="button"
        hitSlop={12}
        onPress={onPreviousMonth}
      >
        <Text style={ui.link}>Xem khoản chi tháng trước</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.screen,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  gap: { gap: spacing.md },
  summary: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  onPrimary: { fontFamily: fonts.body, fontSize: 13, color: colors.onPrimary },
  onPrimaryStrong: { color: colors.onPrimary },
  onPrimaryLink: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.onPrimary,
    textDecorationLine: 'underline',
  },
  notice: {
    backgroundColor: colors.accentSurface,
    borderRadius: 18,
    padding: spacing.lg,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
    color: colors.ink,
  },
});
