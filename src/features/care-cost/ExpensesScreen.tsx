import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { TabProps } from '../../app/RootNavigator';
import { fadeIn, fadeOut, listLayout } from '../../shared/motion/presets';
import { colors, spacing } from '../../shared/theme/theme';
import { PrimaryButton } from '../../shared/ui/PrimaryButton';
import { newId } from './db';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  dayLabel,
  formatVnd,
  groupByDay,
  monthOf,
  prevMonth,
  searchExpenses,
  total,
  type Category,
  type Expense,
  type Month,
} from './domain';
import { useChildren, useExpenses } from './hooks';
import { deleteExpense } from './repo';
import { ReportsScreen } from './ReportsScreen';
import {
  Chip,
  ChildFilter,
  EmptyState,
  ExpenseRow,
  MonthNav,
  SectionHeading,
  Segment,
  styles as ui,
} from './ui';

const MODES = [
  { value: 'list', label: 'Khoản chi' },
  { value: 'reports', label: 'Báo cáo' },
] as const;

// EXPENSES (design uWuj3, empty WCnPi) and the REPORTS mode of the same tab.
export function ExpensesScreen({ navigation, route }: TabProps<'Expenses'>) {
  const current = monthOf(new Date());
  const [month, setMonth] = useState<Month>(current);
  const [mode, setMode] = useState<'list' | 'reports'>('list');
  const [childId, setChildId] = useState<string>();
  const [category, setCategory] = useState<Category>();
  const [query, setQuery] = useState('');
  const kids = useChildren().data ?? [];

  // Drill-down params from HOME / charts.
  const params = route.params;
  useEffect(() => {
    if (!params) return;
    if (params.month) setMonth(params.month);
    if (params.mode) setMode(params.mode);
    if (params.mode === 'reports' || params.category) {
      setQuery('');
      setCategory(params.category);
    }
  }, [params]);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={ui.screenTitle} accessibilityRole="header">
            {mode === 'list' ? 'Chi phí chăm sóc' : 'Báo cáo chi phí'}
          </Text>
          <Text style={ui.muted}>Mỗi khoản chi, một bước đồng hành.</Text>
        </View>
        <Segment options={MODES} value={mode} onChange={setMode} />
        <MonthNav month={month} current={current} onChange={setMonth} />
        <ChildFilter kids={kids} value={childId} onChange={setChildId} />
      </View>
      {mode === 'list' ? (
        <ExpenseList
          month={month}
          childId={childId}
          category={category}
          setCategory={setCategory}
          query={query}
          setQuery={setQuery}
          onEdit={e =>
            navigation.navigate('ExpenseForm', { expenseId: e.id, month })
          }
          onAdd={() => navigation.navigate('ExpenseForm', { category })}
        />
      ) : (
        <ReportsScreen
          month={month}
          childId={childId}
          onCategory={c => {
            // Reports -> list drill-down: same month, that category, no search.
            setQuery('');
            setCategory(c);
            setMode('list');
          }}
          onPreviousMonth={() => {
            setQuery('');
            setCategory(undefined);
            setMonth(prevMonth);
            setMode('list');
          }}
          onBudget={() => navigation.navigate('Budget', { month })}
          onAdd={() => navigation.navigate('ExpenseForm')}
        />
      )}
    </SafeAreaView>
  );
}

function ExpenseList({
  month,
  childId,
  category,
  setCategory,
  query,
  setQuery,
  onEdit,
  onAdd,
}: {
  month: Month;
  childId?: string;
  category?: Category;
  setCategory: (c?: Category) => void;
  query: string;
  setQuery: (q: string) => void;
  onEdit: (e: Expense) => void;
  onAdd: () => void;
}) {
  const { data, error } = useExpenses(month, childId);
  const shown = data
    ? searchExpenses(data, query).filter(
        e => category === undefined || e.category === category,
      )
    : [];
  const filtered = query.trim() !== '' || category !== undefined;

  const confirmDelete = (e: Expense) =>
    Alert.alert(
      'Xóa khoản chi?',
      `“${e.description}” · ${formatVnd(
        e.amountVnd,
      )}. Thao tác này không hoàn tác được.`,
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Xóa khoản chi',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExpense(e.id, await newId());
            } catch {
              Alert.alert(
                'Chưa xóa được',
                'Khoản chi vẫn được giữ nguyên. Vui lòng thử lại.',
              );
            }
          },
        },
      ],
    );

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          style={ui.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm mô tả hoặc ghi chú"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Tìm mô tả hoặc ghi chú"
          returnKeyType="search"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={ui.row}
        >
          <Chip
            label="Tất cả nhóm"
            selected={category === undefined}
            onPress={() => setCategory(undefined)}
          />
          {CATEGORIES.map(c => (
            <Chip
              key={c}
              label={CATEGORY_LABELS[c]}
              selected={category === c}
              onPress={() => setCategory(c)}
            />
          ))}
        </ScrollView>

        {error ? (
          <EmptyState title="Không tải được danh sách chi phí." />
        ) : !data ? null : data.length === 0 ? (
          <EmptyState
            title="Chưa có khoản chi trong tháng này"
            body="Ghi lại khoản chi để theo dõi theo ngày và theo từng con."
            action="Thêm chi phí"
            onAction={onAdd}
          />
        ) : shown.length === 0 ? (
          <EmptyState
            title="Không tìm thấy khoản chi phù hợp"
            action="Xóa bộ lọc"
            onAction={() => {
              setQuery('');
              setCategory(undefined);
            }}
          />
        ) : (
          <>
            <SectionHeading
              title={filtered ? 'Tổng theo bộ lọc' : 'Đã chi trong tháng'}
            />
            <Text style={styles.total}>{formatVnd(total(shown, childId))}</Text>
            <LayoutAnimationConfig skipEntering>
              {groupByDay(shown, childId).map(g => (
                <Animated.View
                  key={g.date}
                  entering={fadeIn}
                  exiting={fadeOut}
                  layout={listLayout}
                >
                  <View style={styles.dayHeader}>
                    <Text style={ui.label}>{dayLabel(g.date, true)}</Text>
                    <Text style={ui.label}>{formatVnd(g.total)}</Text>
                  </View>
                  {g.items.map(e => (
                    <Animated.View
                      key={e.id}
                      entering={fadeIn}
                      exiting={fadeOut}
                      layout={listLayout}
                    >
                      <ExpenseRow
                        expense={e}
                        childId={childId}
                        onPress={() => onEdit(e)}
                        onLongPress={() => confirmDelete(e)}
                      />
                    </Animated.View>
                  ))}
                </Animated.View>
              ))}
            </LayoutAnimationConfig>
            <Text style={ui.muted}>Nhấn giữ một khoản chi để xóa.</Text>
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton label="+ Thêm chi phí" onPress={onAdd} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  // Fixed above the scrolling list: the hairline makes the cut-off edge read as intended.
  header: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  content: { padding: spacing.screen, gap: spacing.lg },
  total: {
    ...StyleSheet.flatten(ui.rowAmount),
    fontSize: 16,
    color: colors.primary,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  footer: { paddingHorizontal: spacing.screen, paddingBottom: spacing.md },
});
