import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { Check, ChevronLeft } from 'lucide-react-native';
import type { RootStackParamList } from '../../app/RootNavigator';
import { colors, fonts, spacing } from '../../shared/theme/theme';
import { PrimaryButton } from '../../shared/ui/PrimaryButton';
import { newId } from './db';
import {
  CATEGORIES,
  groupAmountInput,
  groupThousands,
  CATEGORY_LABELS,
  dayLabel,
  formatVnd,
  localDate,
  monthOf,
  parseVnd,
  splitEvenly,
  type Allocation,
  type Category,
  type Child,
  type Expense,
} from './domain';
import { useChildren, useExpenses } from './hooks';
import { ValidationError, deleteExpense, saveExpense } from './repo';
import { CategoryIcon, Chip, EmptyState, Segment, styles as ui } from './ui';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseForm'>;

const SPLIT = [
  { value: 'even', label: 'Chia đều' },
  { value: 'manual', label: 'Tự nhập' },
] as const;

const toDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// EXPENSE_FORM (design m1a8H, split state iWHm3): one form for add and edit from every entry point.
export function ExpenseFormScreen({ navigation, route }: Props) {
  const { expenseId, month, category } = route.params ?? {};
  const kids = useChildren();
  // Editing reads the month the caller came from; the repo has no by-id read.
  const list = useExpenses(month ?? monthOf(new Date()));
  // Pinned once found: after a delete or a move to another month the row leaves this list,
  // but the open form must stay mounted until it navigates back.
  const found = useRef<Expense>(undefined);
  found.current =
    (expenseId ? list.data?.find(e => e.id === expenseId) : undefined) ??
    found.current;
  const existing = found.current;

  const back = (
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
  );

  if (kids.error || (expenseId && list.error))
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          {back}
          <EmptyState title="Không tải được dữ liệu." />
        </View>
      </SafeAreaView>
    );
  if (!kids.data || (expenseId && !list.data)) return null;
  if (expenseId && !existing)
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          {back}
          <EmptyState title="Khoản chi không còn tồn tại" />
        </View>
      </SafeAreaView>
    );

  return (
    <Form
      key={existing?.id ?? 'new'}
      initial={existing}
      initialCategory={category}
      kids={kids.data}
      navigation={navigation}
      back={back}
    />
  );
}

function Form({
  initial,
  initialCategory,
  kids,
  navigation,
  back,
}: {
  initial?: Expense;
  initialCategory?: Category;
  kids: Child[];
  navigation: Props['navigation'];
  back: React.ReactNode;
}) {
  const today = localDate(new Date());
  // Inactive children stay pickable only on an expense that already has them.
  const pickable = kids.filter(
    c => c.isActive || initial?.allocations.some(a => a.childId === c.id),
  );
  const active = kids.filter(c => c.isActive);

  const start = {
    amount: initial ? groupThousands(String(initial.amountVnd)) : '',
    date: initial?.spentOn ?? today,
    description: initial?.description ?? '',
    note: initial?.note ?? '',
    category: initial?.category ?? initialCategory ?? null,
    picked:
      initial?.allocations.map(a => a.childId) ??
      (active.length === 1 ? [active[0].id] : []),
    split: (initial &&
    initial.allocations.length > 1 &&
    JSON.stringify(
      splitEvenly(
        initial.amountVnd,
        initial.allocations.map(a => a.childId),
      ),
    ) !== JSON.stringify(initial.allocations)
      ? 'manual'
      : 'even') as 'even' | 'manual',
    manual: Object.fromEntries(
      (initial?.allocations ?? []).map(a => [a.childId, String(a.amountVnd)]),
    ) as Record<string, string>,
  };
  const startJson = useRef(JSON.stringify(start)).current;
  const [s, setS] = useState(start);
  const set = <K extends keyof typeof start>(k: K, v: (typeof start)[K]) =>
    setS(p => ({ ...p, [k]: v }));

  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [done, setDone] = useState(false);
  const operation = useRef<string | null>(null);
  const amountRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const descriptionRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const amount = parseVnd(s.amount);
  const picked = [...new Set(s.picked)].sort();
  const allocations: Allocation[] =
    picked.length === 1
      ? [{ childId: picked[0], amountVnd: amount ?? 0 }]
      : s.split === 'even'
      ? splitEvenly(amount ?? 0, picked)
      : picked.map(childId => ({
          childId,
          amountVnd: parseVnd(s.manual[childId] ?? '') ?? NaN,
        }));
  const allocSum = allocations.reduce((t, a) => t + a.amountVnd, 0);

  const errors = {
    amount:
      amount === null || amount <= 0
        ? 'Số tiền phải là số nguyên dương, ví dụ 450.000'
        : undefined,
    description: s.description.trim() ? undefined : 'Vui lòng nhập mô tả',
    category: s.category ? undefined : 'Vui lòng chọn danh mục',
    children: picked.length ? undefined : 'Chọn ít nhất một trẻ',
    split:
      picked.length > 1 && s.split === 'manual' && amount !== null
        ? Number.isNaN(allocSum)
          ? 'Mỗi phần phải là số nguyên không âm'
          : allocSum !== amount
          ? `Tổng phân bổ phải bằng số tiền (đang lệch ${formatVnd(
              allocSum - amount,
              true,
            )})`
          : undefined
        : undefined,
  };
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);

  const dirty = JSON.stringify(s) !== startJson;
  usePreventRemove(dirty && !done, ({ data }) => {
    if (saving) return; // wait for the write result before leaving
    Alert.alert('Bỏ thay đổi?', 'Nội dung bạn vừa nhập chưa được lưu.', [
      { text: 'Tiếp tục chỉnh sửa', style: 'cancel' },
      {
        text: 'Bỏ thay đổi',
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });
  useEffect(() => {
    if (done) navigation.goBack();
  }, [done, navigation]);

  const save = async () => {
    if (saving) return;
    setSubmitted(true);
    setFormError(undefined);
    const first = Object.values(errors).find(Boolean);
    if (first) {
      if (errors.amount) amountRef.current?.focus();
      else if (errors.description) descriptionRef.current?.focus();
      AccessibilityInfo.announceForAccessibility(first);
      return;
    }
    setSaving(true);
    try {
      operation.current ??= await newId(); // kept across retries: a replay is a no-op
      await saveExpense(
        {
          id: initial?.id,
          amountVnd: amount!,
          spentOn: s.date,
          description: s.description,
          category: s.category!,
          note: s.note,
          allocations,
        },
        operation.current,
      );
      AccessibilityInfo.announceForAccessibility('Đã lưu trên thiết bị');
      setDone(true);
    } catch (e) {
      setFormError(
        e instanceof ValidationError
          ? e.errors.join('\n')
          : 'Chưa lưu được khoản chi. Nội dung vẫn được giữ, vui lòng thử lại.',
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    initial &&
    Alert.alert(
      'Xóa khoản chi?',
      `“${initial.description}” · ${formatVnd(
        initial.amountVnd,
      )}. Thao tác này không hoàn tác được.`,
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Xóa khoản chi',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExpense(initial.id, await newId());
              setDone(true);
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

  const pickDate = () =>
    DateTimePickerAndroid.open({
      value: toDate(s.date),
      mode: 'date',
      maximumDate: new Date(),
      onValueChange: (_, d) => set('date', localDate(d)),
    });

  const toggleChild = (id: string) =>
    set(
      'picked',
      picked.includes(id) ? picked.filter(x => x !== id) : [...picked, id],
    );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {back}
        <Text style={ui.screenTitle} accessibilityRole="header">
          {initial ? 'Sửa chi phí' : 'Thêm chi phí'}
        </Text>

        <Field label="Số tiền (đồng)" error={show('amount')}>
          <TextInput
            ref={amountRef}
            style={[ui.input, styles.amount, show('amount') && ui.inputError]}
            value={s.amount}
            onChangeText={v => set('amount', groupAmountInput(v))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Số tiền, đồng"
          />
        </Field>

        <Field label="Ngày phát sinh">
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={toDate(s.date)}
              mode="date"
              display="compact"
              maximumDate={new Date()}
              onValueChange={(_, d) => set('date', localDate(d))}
              style={styles.iosDate}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ngày phát sinh ${dayLabel(
                s.date,
                true,
              )}. Đổi ngày`}
              onPress={pickDate}
              style={[ui.input, styles.dateButton]}
            >
              <Text style={styles.value}>{dayLabel(s.date, true)}</Text>
            </Pressable>
          )}
        </Field>

        <Field label="Mô tả" error={show('description')}>
          <TextInput
            ref={descriptionRef}
            style={[ui.input, show('description') && ui.inputError]}
            value={s.description}
            onChangeText={v => set('description', v)}
            placeholder="Ví dụ: Buổi trị liệu hành vi"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Mô tả"
          />
        </Field>

        <Field label="Danh mục" error={show('category')}>
          <View style={styles.categories}>
            {CATEGORIES.map(c => {
              const on = s.category === c;
              return (
                <Pressable
                  key={c}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => set('category', c)}
                  style={[styles.category, on && styles.categoryOn]}
                >
                  <CategoryIcon category={c} />
                  <Text style={[styles.value, ui.flex]}>
                    {CATEGORY_LABELS[c]}
                  </Text>
                  {on && <Check color={colors.primary} size={16} />}
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Chi cho trẻ nào?" error={show('children')}>
          {pickable.length === 0 ? (
            <EmptyState
              title="Chưa có trẻ đang theo dõi"
              body="Thêm hồ sơ trẻ trước khi ghi chi phí."
              action="Thêm trẻ"
              onAction={() => navigation.navigate('ChildForm')}
            />
          ) : (
            <View style={[ui.row, styles.wrap]}>
              {pickable.map(c => (
                <Chip
                  key={c.id}
                  label={c.displayName}
                  selected={picked.includes(c.id)}
                  onPress={() => toggleChild(c.id)}
                />
              ))}
            </View>
          )}
        </Field>

        {picked.length > 1 && (
          <View style={styles.split}>
            <Segment
              options={SPLIT}
              value={s.split}
              onChange={v => set('split', v)}
            />
            {allocations.map(a => {
              const child = kids.find(k => k.id === a.childId);
              return (
                <View key={a.childId} style={styles.splitRow}>
                  <Text style={[styles.value, ui.flex]}>
                    {child?.displayName}
                  </Text>
                  {s.split === 'even' ? (
                    <Text style={ui.rowAmount}>{formatVnd(a.amountVnd)}</Text>
                  ) : (
                    <TextInput
                      style={[ui.input, styles.share]}
                      value={s.manual[a.childId] ?? ''}
                      onChangeText={v =>
                        set('manual', { ...s.manual, [a.childId]: v })
                      }
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                      accessibilityLabel={`Phần của ${child?.displayName}, đồng`}
                    />
                  )}
                </View>
              );
            })}
            <Text style={ui.muted}>
              {s.split === 'even'
                ? 'Chia đều: phần lẻ được cộng 1 đồng lần lượt cho từng trẻ để tổng luôn khớp.'
                : `Tổng phân bổ: ${
                    Number.isNaN(allocSum) ? '—' : formatVnd(allocSum)
                  } / ${formatVnd(amount ?? 0)}`}
            </Text>
            {show('split') && <Text style={ui.error}>{show('split')}</Text>}
          </View>
        )}

        <Field label="Ghi chú (không bắt buộc)">
          <TextInput
            style={[ui.input, styles.note]}
            value={s.note}
            onChangeText={v => set('note', v)}
            multiline
            placeholder="Thêm ghi chú"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Ghi chú"
          />
        </Field>

        {formError && (
          <Text style={ui.error} accessibilityLiveRegion="polite">
            {formError}
          </Text>
        )}
        <PrimaryButton
          label={saving ? 'Đang lưu…' : 'Lưu chi phí'}
          onPress={save}
        />
        {initial && (
          <Pressable
            accessibilityRole="button"
            onPress={remove}
            style={styles.delete}
          >
            <Text style={styles.deleteText}>Xóa khoản chi</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={ui.label}>{label}</Text>
      {children}
      {error && <Text style={ui.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.screen,
    gap: spacing.section,
    paddingBottom: spacing.xl,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
  },
  field: { gap: spacing.sm },
  amount: { fontFamily: fonts.bodySemiBold, fontSize: 28, minHeight: 64 },
  value: { fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  dateButton: { justifyContent: 'center' },
  iosDate: { alignSelf: 'flex-start' },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  category: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  categoryOn: {
    borderColor: colors.primary,
    backgroundColor: colors.accentSurface,
  },
  wrap: { flexWrap: 'wrap' },
  split: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  share: { width: 140, textAlign: 'right' },
  note: { minHeight: 72, paddingTop: spacing.md, textAlignVertical: 'top' },
  delete: { alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  deleteText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.danger,
  },
});
