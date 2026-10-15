import { StyleSheet, Text, View } from 'react-native';
import { ArrowLeftRight, CloudOff } from 'lucide-react-native';
import { AllocationDonut, BudgetBar } from '../features/care-cost/charts';
import {
  CATEGORY_LABELS,
  formatVnd,
  type Category,
} from '../features/care-cost/domain';
import { CategoryIcon } from '../features/care-cost/ui';
import { colors, fonts, spacing } from '../shared/theme/theme';

// Illustrations built from the app's own components, so they cannot drift from the real UI.
// Every figure is a made-up example and the frame says so; none of it is stored or counted.

const KIDS = [
  { name: 'Bin', tint: '#568DCF' },
  { name: 'Na', tint: '#D29A65' },
] as const;

const EXAMPLE_TOTALS: Record<Category, number> = {
  medical: 1_400_000,
  medication: 600_000,
  education: 800_000,
  transport: 300_000,
  other: 100_000,
};

function Frame({ children }: { children: React.ReactNode }) {
  return (
    // Decorative: the heading and bullets under it carry the meaning for screen readers.
    <View
      style={styles.frame}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {children}
      <Text style={styles.caption}>Ví dụ minh họa</Text>
    </View>
  );
}

export function SplitArt() {
  const total = 600_000;
  return (
    <Frame>
      <View style={styles.card}>
        <View style={styles.row}>
          <CategoryIcon category="medical" />
          <View style={styles.flex}>
            <Text style={styles.strong}>Trị liệu ngôn ngữ</Text>
            <Text style={styles.small}>
              {CATEGORY_LABELS.medical} · 12 thg 3
            </Text>
          </View>
          <Text style={styles.strong}>{formatVnd(total)}</Text>
        </View>
        <View style={styles.rule} />
        <Text style={styles.small}>Chia cho</Text>
        <View style={styles.splitBar}>
          {KIDS.map(k => (
            <View
              key={k.name}
              style={[styles.flex, { backgroundColor: k.tint }]}
            />
          ))}
        </View>
        {KIDS.map(k => (
          <View key={k.name} style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: `${k.tint}22` }]}>
              <Text style={[styles.initial, { color: k.tint }]}>
                {k.name[0]}
              </Text>
            </View>
            <Text style={[styles.body, styles.flex]}>{k.name}</Text>
            <Text style={styles.strong}>{formatVnd(total / 2)}</Text>
          </View>
        ))}
      </View>
    </Frame>
  );
}

export function BudgetArt() {
  const spent = Object.values(EXAMPLE_TOTALS).reduce((a, b) => a + b, 0);
  return (
    <Frame>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={[styles.strong, styles.flex]}>Tháng 3</Text>
          <Text style={styles.small}>Ngân sách {formatVnd(5_000_000)}</Text>
        </View>
        <BudgetBar budget={5_000_000} spent={spent} />
        <View style={styles.rule} />
        <AllocationDonut totals={EXAMPLE_TOTALS} total={spent} />
      </View>
    </Frame>
  );
}

export function SyncArt() {
  return (
    <Frame>
      <View style={styles.phones}>
        <Phone />
        <View style={styles.link}>
          <ArrowLeftRight size={22} color={colors.primary} />
          <Text style={styles.small}>Trực tiếp</Text>
        </View>
        <Phone />
      </View>
      <View style={styles.chip}>
        <CloudOff size={16} color={colors.primary} />
        <Text style={styles.chipLabel}>Không cloud, không máy chủ</Text>
      </View>
    </Frame>
  );
}

function Phone() {
  return (
    <View style={styles.phone}>
      <View style={styles.avatarDot} />
      <View style={styles.line} />
      <View style={[styles.line, styles.short]} />
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 20,
    backgroundColor: colors.accentSurface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  rule: { height: 1, backgroundColor: colors.divider },
  body: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  strong: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
  },
  splitBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    gap: 2,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: fonts.bodySemiBold, fontSize: 14 },
  phones: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  phone: {
    width: 92,
    height: 120,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  avatarDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  line: {
    alignSelf: 'stretch',
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.track,
  },
  short: { width: '60%' },
  link: { alignItems: 'center', gap: spacing.xs },
  chip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.primary,
  },
});
