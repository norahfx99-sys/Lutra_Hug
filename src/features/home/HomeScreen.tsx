import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  PiggyBank,
  Plus,
  RefreshCw,
  Settings,
  TriangleAlert,
  Users,
} from 'lucide-react-native';
import type { TabProps } from '../../app/RootNavigator';
import { AllocationDonut, BudgetBar } from '../care-cost/charts';
import {
  categoryTotals,
  formatVnd,
  monthOf,
  recentExpenses,
  total,
} from '../care-cost/domain';
import { useChildren, useExpenses, useMonthlyBudget } from '../care-cost/hooks';
import { useConflicts } from '../nearby-sync/hooks';
import {
  ChildFilter,
  EmptyState,
  ExpenseRow,
  SectionHeading,
  styles as ui,
} from '../care-cost/ui';
import { usePressScale } from '../../shared/motion/usePressScale';
import Animated from 'react-native-reanimated';
import { colors, fonts, spacing } from '../../shared/theme/theme';

// HOME (design V2hIJ, empty vhxmq). Community/AI tiles and resource highlight are out of slice 1.
export function HomeScreen({ navigation }: TabProps<'Home'>) {
  // ponytail: month is read per render; a re-render after midnight on the 1st picks the new month.
  const month = monthOf(new Date());
  const [childId, setChildId] = useState<string>();
  const kids = useChildren().data ?? [];
  const conflicts = useConflicts().data ?? []; // empty until a sync finds concurrent edits
  const { data: expenses, error } = useExpenses(month, childId);
  const budget = useMonthlyBudget(month).data;

  const spent = expenses ? total(expenses, childId) : 0;
  const openList = () =>
    navigation.navigate('Expenses', { month, mode: 'list' });

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <View style={styles.flex}>
            <Text style={ui.screenTitle} accessibilityRole="header">
              Chào bạn, hôm nay
            </Text>
            <Text style={ui.muted}>Cùng chăm sóc con, từng chút một.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cài đặt"
            onPress={() => navigation.navigate('Settings')}
            hitSlop={4}
            style={styles.settings}
          >
            <Settings size={22} color={colors.primary} />
          </Pressable>
        </View>

        <ChildFilter kids={kids} value={childId} onChange={setChildId} />

        <Pressable
          accessibilityRole="button"
          accessibilityHint="Mở danh sách chi phí tháng này"
          onPress={openList}
          style={ui.card}
        >
          <Text style={ui.overline}>
            CHI PHÍ CHĂM SÓC · THÁNG {Number(month.slice(5))}
          </Text>
          {error ? (
            <Text style={ui.error}>Không tải được dữ liệu chi phí.</Text>
          ) : (
            <Text style={ui.bigAmount}>
              {expenses ? formatVnd(spent) : ' '}
            </Text>
          )}
          {childId !== undefined ? (
            <Text style={ui.muted}>
              Phần chi cho trẻ này. Ngân sách áp dụng cho cả gia đình.
            </Text>
          ) : budget === null ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => navigation.navigate('Budget', { month })}
            >
              <Text style={ui.muted}>Chưa đặt ngân sách</Text>
              <Text style={ui.link}>Đặt ngân sách</Text>
            </Pressable>
          ) : budget !== undefined && expenses ? (
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Mở ngân sách tháng"
              onPress={() => navigation.navigate('Budget', { month })}
            >
              <BudgetBar budget={budget} spent={spent} />
            </Pressable>
          ) : null}
        </Pressable>

        {conflicts.length > 0 && (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('SyncConflicts')}
            style={styles.conflict}
          >
            <TriangleAlert size={20} color={colors.warning} />
            <Text style={styles.conflictText}>
              {conflicts.length} bản ghi bị sửa đồng thời, cần chọn bản giữ
            </Text>
          </Pressable>
        )}

        <View style={styles.actions}>
          <Action
            label="Thêm chi phí"
            Icon={Plus}
            onPress={() => navigation.navigate('ExpenseForm')}
          />
          <Action
            label="Ngân sách"
            Icon={PiggyBank}
            onPress={() => navigation.navigate('Budget', { month })}
          />
          <Action
            label="Hồ sơ trẻ"
            Icon={Users}
            onPress={() => navigation.navigate('Children')}
          />
          <Action
            label="Đồng bộ"
            Icon={RefreshCw}
            onPress={() => navigation.navigate('SyncDevices')}
          />
        </View>

        {expenses && expenses.length === 0 && (
          <EmptyState
            title="Chưa có khoản chi nào trong tháng này"
            body="Ghi lại khoản chi đầu tiên để thấy chi phí đang đi đâu."
            action="Thêm chi phí đầu tiên"
            onAction={() => navigation.navigate('ExpenseForm')}
          />
        )}

        {expenses && expenses.length > 0 && (
          <>
            <SectionHeading
              title="Chi phí đang đi đâu?"
              action="Báo cáo"
              onAction={() =>
                navigation.navigate('Expenses', { month, mode: 'reports' })
              }
            />
            <AllocationDonut
              totals={categoryTotals(expenses, childId)}
              total={spent}
              onSelect={category =>
                navigation.navigate('Expenses', {
                  month,
                  category,
                  mode: 'list',
                })
              }
            />
            <SectionHeading
              title="Khoản chi gần đây"
              action="Xem tất cả"
              onAction={openList}
            />
            <View>
              {recentExpenses(expenses, 5).map(e => (
                <ExpenseRow
                  key={e.id}
                  expense={e}
                  childId={childId}
                  onPress={() =>
                    navigation.navigate('ExpenseForm', {
                      expenseId: e.id,
                      month,
                    })
                  }
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({
  label,
  Icon,
  onPress,
}: {
  label: string;
  Icon: typeof Plus;
  onPress: () => void;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.flex}
    >
      <Animated.View style={[styles.action, animatedStyle]}>
        <View style={styles.actionIcon}>
          <Icon color={colors.primary} size={20} />
        </View>
        <Text style={styles.actionLabel}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.screen,
    paddingBottom: spacing.xl,
    gap: spacing.section,
  },
  flex: { flex: 1 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  settings: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conflict: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: colors.warningSurface,
  },
  conflictText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.warning,
  },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.ink,
    textAlign: 'center',
  },
});
