import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useGrow } from '../../shared/motion/useGrow';
import { colors, fonts, spacing } from '../../shared/theme/theme';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  budgetProgress,
  dayLabel,
  formatVnd,
  percentLabel,
  type Category,
} from './domain';
import { CATEGORY_COLORS } from './ui';

// Charts per SCREEN_DESIGN "Danh mục chart"; motion per MOTION 4.10/4.11.
// Only transform/opacity animate; every amount is plain final text (no count-up).

/** A filled bar that grows on mount and tweens on change. ratio is clamped to [0, 1]. */
function Bar({
  ratio,
  color,
  vertical,
  outlined,
}: {
  ratio: number;
  color: string;
  vertical?: boolean;
  outlined?: boolean;
}) {
  const g = useGrow(Math.min(Math.max(ratio, 0), 1));
  const style = useAnimatedStyle(() => ({
    transform: [vertical ? { scaleY: g.value } : { scaleX: g.value }],
  }));
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        vertical ? styles.originBottom : styles.originLeft,
        { backgroundColor: color },
        outlined && styles.outlined,
        style,
      ]}
    />
  );
}

/** CH-BUDGET. Caller handles budget === null (CTA, no bar). */
export function BudgetBar({
  budget,
  spent,
  onPrimary,
}: {
  budget: number;
  spent: number;
  onPrimary?: boolean;
}) {
  const p = budgetProgress(budget, spent);
  const pct = percentLabel(spent, budget);
  const label =
    p.over > 0
      ? `Đã dùng ${pct}% · Vượt ngân sách ${formatVnd(p.over)}`
      : p.remaining === 0
      ? `Đã dùng hết ngân sách${pct === null ? '' : ` · ${pct}%`}`
      : `Đã dùng ${pct}% · Còn ${formatVnd(p.remaining ?? 0)}`;
  const fg = onPrimary ? colors.onPrimary : colors.primary;
  return (
    <View style={styles.gap}>
      <View
        style={[styles.track, onPrimary && styles.trackOnPrimary]}
        accessibilityRole="progressbar"
        accessibilityLabel={`Đã dùng ${formatVnd(
          spent,
        )} trên ngân sách ${formatVnd(budget)}`}
      >
        {p.ratio !== null && p.ratio > 0 && (
          <Bar ratio={p.ratio} color={p.over > 0 ? colors.warning : fg} />
        )}
      </View>
      <Text
        style={[
          styles.budgetText,
          { color: p.over > 0 && !onPrimary ? colors.warning : fg },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const R = 52;
const STROKE = 18;
const C = 2 * Math.PI * R;

/** CH-ALLOCATION doughnut + legend. Caller renders the empty state when total is 0. */
export function AllocationDonut({
  totals,
  total,
  onSelect,
}: {
  totals: Record<Category, number>;
  total: number;
  onSelect?: (c: Category) => void;
}) {
  // Donut reveals once (opacity + scale 0.96 -> 1); later data swaps instantly (MOTION 4.11).
  const g = useGrow(1);
  const reveal = useAnimatedStyle(() => ({
    opacity: g.value,
    transform: [{ scale: 0.96 + 0.04 * g.value }],
  }));
  let offset = 0;
  return (
    <View style={styles.donutRow}>
      <Animated.View style={[styles.donut, reveal]}>
        <Svg width={2 * (R + STROKE / 2)} height={2 * (R + STROKE / 2)}>
          {CATEGORIES.filter(c => totals[c] > 0).map(c => {
            // Full circles via dash arrays: a single category is a whole ring, no zero-length arc.
            const len = (totals[c] / total) * C;
            const el = (
              <Circle
                key={c}
                cx={R + STROKE / 2}
                cy={R + STROKE / 2}
                r={R}
                fill="none"
                stroke={CATEGORY_COLORS[c]}
                strokeWidth={STROKE}
                strokeDasharray={`${len} ${C}`}
                strokeDashoffset={-offset}
                rotation={-90}
                origin={`${R + STROKE / 2}, ${R + STROKE / 2}`}
              />
            );
            offset += len;
            return el;
          })}
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={styles.donutTotal}>{formatVnd(total)}</Text>
          <Text style={styles.small}>Tổng chi</Text>
        </View>
      </Animated.View>
      <View style={styles.legend}>
        {CATEGORIES.map(c => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={`${CATEGORY_LABELS[c]}: ${formatVnd(
              totals[c],
            )}, ${percentLabel(totals[c], total) ?? 0}%. Xem khoản chi`}
            disabled={!onSelect}
            onPress={() => onSelect?.(c)}
            style={styles.legendRow}
          >
            <View
              style={[styles.dot, { backgroundColor: CATEGORY_COLORS[c] }]}
            />
            <Text style={[styles.small, styles.flex]} numberOfLines={1}>
              {CATEGORY_LABELS[c]}
            </Text>
            <Text style={styles.smallStrong}>
              {percentLabel(totals[c], total) ?? 0}%
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** CH-CATEGORY: sorted by amount desc, ties in fixed category order. Zero rows draw no bar. */
export function CategoryBars({
  totals,
  total,
  onSelect,
}: {
  totals: Record<Category, number>;
  total: number;
  onSelect: (c: Category) => void;
}) {
  const rows = [...CATEGORIES].sort((a, b) => totals[b] - totals[a]);
  const max = Math.max(...rows.map(c => totals[c]));
  return (
    <View style={styles.gapLg}>
      {rows.map(c => {
        const pct = percentLabel(totals[c], total);
        const label = `${CATEGORY_LABELS[c]} · ${formatVnd(totals[c])}${
          pct === null ? '' : ` · ${pct}%`
        }`;
        return (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={`${label}. Xem khoản chi`}
            onPress={() => onSelect(c)}
            style={styles.gap}
          >
            <Text style={styles.body}>{label}</Text>
            <View style={styles.barTrack}>
              {totals[c] > 0 && (
                <Bar ratio={totals[c] / max} color={CATEGORY_COLORS[c]} />
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const COLUMN_H = 120;

/** CH-DAILY: one column per elapsed calendar day, zero days included, no future days. */
export function DailyColumns({
  series,
}: {
  series: { date: string; amountVnd: number }[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const max = Math.max(...series.map(d => d.amountVnd), 1);
  const pick = series.find(d => d.date === selected);
  const last = series.length;
  return (
    <View style={styles.gap}>
      <View style={styles.columns}>
        {series.map((d, i) => {
          const day = i + 1;
          return (
            <Pressable
              key={d.date}
              accessibilityRole="button"
              accessibilityLabel={`${dayLabel(d.date, true)}: ${formatVnd(
                d.amountVnd,
              )}`}
              onPress={() => setSelected(d.date)}
              style={styles.columnCell}
            >
              <View style={styles.column}>
                {d.amountVnd > 0 && (
                  <Bar
                    vertical
                    ratio={d.amountVnd / max}
                    color={d.date === selected ? colors.ink : colors.primary}
                  />
                )}
              </View>
              <Text style={styles.axis}>
                {day === 1 || day % 5 === 0 || day === last ? day : ' '}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.small}>
        {pick
          ? `${dayLabel(pick.date, true)}: ${formatVnd(pick.amountVnd)}`
          : `Cao nhất: ${formatVnd(
              max === 1 ? 0 : max,
            )} · chạm cột để xem số tiền`}
      </Text>
    </View>
  );
}

/** CH-COMPARE: paired bars per category on one shared scale; current solid, previous light + outline. */
export function CompareBars({
  current,
  previous,
}: {
  current: Record<Category, number>;
  previous: Record<Category, number>;
}) {
  const max = Math.max(
    ...CATEGORIES.flatMap(c => [current[c], previous[c]]),
    1,
  );
  return (
    <View style={styles.gapLg}>
      {CATEGORIES.map(c => (
        <View
          key={c}
          style={styles.gap}
          accessible
          accessibilityLabel={`${CATEGORY_LABELS[c]}: kỳ này ${formatVnd(
            current[c],
          )}, kỳ trước ${formatVnd(previous[c])}`}
        >
          <Text style={styles.body}>{CATEGORY_LABELS[c]}</Text>
          {[
            [current[c], colors.primary, false],
            [previous[c], colors.accentSurface, true],
          ].map(([v, color, outlined], i) => (
            <View key={i} style={styles.compareRow}>
              <View style={[styles.barTrack, styles.flex]}>
                {(v as number) > 0 && (
                  <Bar
                    ratio={(v as number) / max}
                    color={color as string}
                    outlined={outlined as boolean}
                  />
                )}
              </View>
              <Text style={[styles.small, styles.compareValue]}>
                {formatVnd(v as number)}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: spacing.xs },
  gapLg: { gap: spacing.md },
  outlined: { borderWidth: 1, borderColor: colors.primary },
  originLeft: { transformOrigin: 'left' },
  originBottom: { transformOrigin: 'bottom' },
  center: { alignItems: 'center', justifyContent: 'center' },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.track,
  },
  trackOnPrimary: { backgroundColor: '#FFFFFF44' },
  budgetText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  donut: { width: 2 * R + STROKE, height: 2 * R + STROKE },
  donutTotal: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.ink,
  },
  legend: { flex: 1, gap: spacing.xs },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 24,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  smallStrong: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.ink,
  },
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  barTrack: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: colors.divider,
  },
  columns: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  columnCell: { flex: 1, alignItems: 'center', gap: 2 },
  column: {
    alignSelf: 'stretch',
    height: COLUMN_H,
    borderRadius: 3,
    overflow: 'hidden',
  },
  axis: { fontFamily: fonts.body, fontSize: 10, color: colors.muted },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  compareValue: { width: 96, textAlign: 'right' },
});
