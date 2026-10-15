import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Bus,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  GraduationCap,
  Pill,
  Stethoscope,
} from 'lucide-react-native';
import { duration, easing } from '../../shared/motion/tokens';
import { colors, fonts, radius, spacing } from '../../shared/theme/theme';
import {
  CATEGORY_LABELS,
  addMonths,
  amountFor,
  dayLabel,
  formatVnd,
  monthLabel,
  type Category,
  type Child,
  type Expense,
  type Month,
} from './domain';

// Category colour is keyed by code, never by sorted position (SCREEN_DESIGN, colour rules).
export const CATEGORY_COLORS: Record<Category, string> = {
  medical: '#568DCF',
  medication: '#9785BB',
  education: '#D29A65',
  transport: '#65A695',
  other: '#9AA9AF',
};

const CATEGORY_ICONS = {
  medical: Stethoscope,
  medication: Pill,
  education: GraduationCap,
  transport: Bus,
  other: Ellipsis,
} as const;

export function CategoryIcon({ category }: { category: Category }) {
  const Icon = CATEGORY_ICONS[category];
  return (
    <View
      style={[
        styles.icon,
        { backgroundColor: `${CATEGORY_COLORS[category]}22` },
      ]}
    >
      <Icon color={CATEGORY_COLORS[category]} size={18} />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={8}
      style={[styles.chip, selected && styles.chipOn]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** "Cả gia đình" + every child; `undefined` = whole family. */
export function ChildFilter({
  kids,
  value,
  onChange,
}: {
  kids: Child[];
  value?: string;
  onChange: (childId?: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <Chip
        label="Cả gia đình"
        selected={value === undefined}
        onPress={() => onChange(undefined)}
      />
      {kids.map(c => (
        <Chip
          key={c.id}
          label={c.displayName}
          selected={value === c.id}
          onPress={() => onChange(c.id)}
        />
      ))}
    </ScrollView>
  );
}

export function MonthNav({
  month,
  current,
  onChange,
}: {
  month: Month;
  current: Month;
  onChange: (m: Month) => void;
}) {
  const canNext = month < current;
  return (
    <View style={styles.monthNav}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tháng trước"
        hitSlop={12}
        onPress={() => onChange(addMonths(month, -1))}
      >
        <ChevronLeft color={colors.ink} size={22} />
      </Pressable>
      <Text style={styles.monthText} accessibilityRole="header">
        {monthLabel(month)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tháng sau"
        accessibilityState={{ disabled: !canNext }}
        disabled={!canNext}
        hitSlop={12}
        onPress={() => onChange(addMonths(month, 1))}
      >
        <ChevronRight color={canNext ? colors.ink : colors.track} size={22} />
      </Pressable>
    </View>
  );
}

/** Two-option segmented control; indicator slides by translateX (MOTION 4.4). */
export function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = options.findIndex(o => o.value === value);
  const x = useSharedValue(0);
  useEffect(() => {
    const to = (index * width) / options.length;
    x.value = reduced
      ? to
      : withTiming(to, { duration: duration.slow, easing: easing.standard });
  }, [index, width, options.length, reduced, x]);
  const indicator = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));
  return (
    <View
      style={styles.segment}
      onLayout={(e: LayoutChangeEvent) =>
        setWidth(e.nativeEvent.layout.width - 8)
      }
    >
      {width > 0 && (
        <Animated.View
          style={[
            styles.segmentIndicator,
            { width: width / options.length },
            indicator,
          ]}
        />
      )}
      {options.map(o => (
        <Pressable
          key={o.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: o.value === value }}
          style={styles.segmentItem}
          onPress={() => onChange(o.value)}
        >
          <Text
            style={[
              styles.segmentText,
              o.value === value && styles.segmentTextOn,
            ]}
          >
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function SectionHeading({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {action && (
        <Pressable accessibilityRole="button" hitSlop={12} onPress={onAction}>
          <Text style={styles.link}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function ExpenseRow({
  expense,
  childId,
  onPress,
  onLongPress,
}: {
  expense: Expense;
  childId?: string;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const amount = amountFor(expense, childId);
  const meta = `${dayLabel(expense.spentOn)} · ${
    CATEGORY_LABELS[expense.category]
  }`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${expense.description}, ${meta}, ${formatVnd(
        amount,
      )}`}
      accessibilityHint={onLongPress ? 'Nhấn giữ để xóa' : undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={{ color: colors.divider }}
      style={({ pressed }) => [styles.expenseRow, pressed && styles.pressed]}
    >
      <CategoryIcon category={expense.category} />
      <View style={styles.flex}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {expense.description}
        </Text>
        <Text style={styles.rowMeta}>{meta}</Text>
      </View>
      <Text style={styles.rowAmount}>{formatVnd(amount)}</Text>
    </Pressable>
  );
}

export function EmptyState({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body && <Text style={styles.muted}>{body}</Text>}
      {action && (
        <Pressable accessibilityRole="button" hitSlop={12} onPress={onAction}>
          <Text style={styles.link}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  chipOn: {
    backgroundColor: colors.accentSurface,
    borderColor: colors.accentSurface,
  },
  chipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.muted,
  },
  chipTextOn: { color: colors.primary },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.ink,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#E7EFF1',
    borderRadius: 14,
    padding: 4,
  },
  segmentIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  segmentItem: {
    flex: 1,
    minHeight: 39,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.muted,
  },
  segmentTextOn: { color: colors.primary },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    lineHeight: 26,
    color: colors.ink,
    flexShrink: 1,
  },
  link: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.primary },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 60,
  },
  pressed: { backgroundColor: colors.accentSurface },
  rowTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  rowMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  rowAmount: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.ink,
  },
  muted: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.ink,
  },
  card: {
    backgroundColor: colors.accentSurface,
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  overline: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.primary,
  },
  bigAmount: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 34,
    lineHeight: 42,
    color: colors.ink,
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
  },
  inputError: { borderColor: colors.danger },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.danger },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.muted },
  screenTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 27,
    lineHeight: 34,
    color: colors.ink,
  },
});
