import { useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import type { RootStackParamList } from '../../app/RootNavigator';
import { colors, spacing } from '../../shared/theme/theme';
import { PrimaryButton } from '../../shared/ui/PrimaryButton';
import { BudgetBar } from './charts';
import { newId } from './db';
import {
  formatVnd,
  monthOf,
  groupAmountInput,
  parseVnd,
  prevMonth,
  total,
  type Month,
} from './domain';
import { useExpenses, useMonthlyBudget } from './hooks';
import { setMonthlyBudget } from './repo';
import { MonthNav, styles as ui } from './ui';

type Props = NativeStackScreenProps<RootStackParamList, 'Budget'>;

// BUDGET (design oxprG): one family budget per month; totals show the saved value until a save commits.
export function BudgetScreen({ navigation, route }: Props) {
  const [month, setMonth] = useState<Month>(route.params.month);
  const saved = useMonthlyBudget(month);
  const previous = useMonthlyBudget(prevMonth(month)).data;
  const expenses = useExpenses(month).data;
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const operation = useRef<string | null>(null);

  const spent = expenses ? total(expenses) : undefined;

  const changeMonth = (m: Month) => {
    setMonth(m);
    setDraft('');
    setError(undefined);
    operation.current = null;
  };

  const save = async () => {
    const amount = parseVnd(draft);
    if (amount === null || amount <= 0) {
      setError('Ngân sách phải là số tiền nguyên dương, ví dụ 1.500.000');
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      // Same operationId across retries of one submit; a fresh one after success.
      operation.current ??= await newId();
      await setMonthlyBudget(month, amount, operation.current);
      operation.current = null;
      setDraft('');
      AccessibilityInfo.announceForAccessibility('Đã lưu trên thiết bị');
    } catch {
      setError(
        'Chưa lưu được ngân sách. Nội dung vẫn được giữ, vui lòng thử lại.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          hitSlop={12}
          onPress={navigation.goBack}
          style={styles.back}
        >
          <ChevronLeft color={colors.primary} size={20} />
          <Text style={ui.link}>Quay lại</Text>
        </Pressable>
        <View>
          <Text style={ui.screenTitle} accessibilityRole="header">
            Ngân sách tháng
          </Text>
          <Text style={ui.muted}>
            Một kế hoạch chi phù hợp cho gia đình bạn.
          </Text>
        </View>
        <MonthNav
          month={month}
          current={monthOf(new Date())}
          onChange={changeMonth}
        />

        <View style={ui.card}>
          <Text style={ui.label}>Ngân sách đã lưu</Text>
          {saved.error ? (
            <Text style={ui.error}>Không tải được ngân sách.</Text>
          ) : saved.data === undefined ? (
            <Text style={ui.bigAmount}> </Text>
          ) : saved.data === null ? (
            <Text style={styles.unset}>Chưa đặt ngân sách</Text>
          ) : (
            <Text style={[ui.bigAmount, styles.primary]}>
              {formatVnd(saved.data)}
            </Text>
          )}
          {spent !== undefined && (
            <Text style={styles.body}>Đã chi {formatVnd(spent)}</Text>
          )}
          {saved.data != null && spent !== undefined && (
            <BudgetBar budget={saved.data} spent={spent} />
          )}
        </View>

        <View style={styles.field}>
          <Text style={ui.label}>
            {saved.data == null ? 'Ngân sách tháng này' : 'Ngân sách mới'}
          </Text>
          <TextInput
            style={[ui.input, error !== undefined && ui.inputError]}
            value={draft}
            onChangeText={v => setDraft(groupAmountInput(v))}
            keyboardType="number-pad"
            placeholder="Ví dụ 1.500.000"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Ngân sách tháng, đồng"
          />
          {error && (
            <Text style={ui.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}
          {previous != null && (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setDraft(String(previous))}
            >
              <Text style={ui.link}>
                Dùng ngân sách tháng trước ({formatVnd(previous)})
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.notice}>
          <Text style={ui.muted}>
            Ngân sách mới chỉ có hiệu lực sau khi lưu. Ngân sách áp dụng cho cả
            gia đình, gồm mọi nhóm chi phí; tháng khác không bị thay đổi.
          </Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton
          label={saving ? 'Đang lưu…' : 'Lưu ngân sách'}
          onPress={() => !saving && save()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.screen, gap: spacing.section },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
  },
  primary: { color: colors.primary },
  unset: { ...StyleSheet.flatten(ui.emptyTitle), color: colors.muted },
  body: { ...StyleSheet.flatten(ui.muted), color: colors.ink, fontSize: 15 },
  field: { gap: spacing.sm },
  notice: {
    backgroundColor: colors.accentSurface,
    borderRadius: 18,
    padding: spacing.lg,
  },
  footer: { paddingHorizontal: spacing.screen, paddingBottom: spacing.md },
});
