import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { ChevronRight } from 'lucide-react-native';
import {
  useAllocationCounts,
  useChildren,
  useExpenses,
} from '../care-cost/hooks';
import { saveChild } from '../care-cost/repo';
import { newId } from '../care-cost/db';
import { forChild, monthOf, total, type Child } from '../care-cost/domain';
import { fadeIn, fadeOut, listLayout } from '../../shared/motion/presets';
import { PrimaryButton } from '../../shared/ui/PrimaryButton';
import { colors, fonts, spacing } from '../../shared/theme/theme';
import { FormScreen, formStyles } from './parts';
import type { FamilyNav } from './routes';

// Avatar tints from the category palette (bnCOs); 22 = ~13% alpha background.
const AVATAR = ['#568DCF', '#9785BB', '#D29A65', '#65A695'];

// ponytail: local VND format; switch to the shared money formatter once care-cost has one.
const vnd = (n: number) =>
  `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} đ`;

// CHILDREN (frame bnCOs): active and stopped children, resume tracking, add.
export function ChildrenScreen() {
  const navigation = useNavigation<FamilyNav>();
  const month = monthOf(new Date());
  const { data: children, error } = useChildren();
  const { data: expenses } = useExpenses(month);
  const { data: counts } = useAllocationCounts();

  const active = children?.filter(c => c.isActive) ?? [];
  const stopped = children?.filter(c => !c.isActive) ?? [];
  const monthLabel = `Tháng ${Number(month.slice(5))}`;

  const resume = async (c: Child) => {
    try {
      await saveChild(
        { id: c.id, displayName: c.displayName, isActive: true },
        await newId(),
      );
    } catch {
      // ponytail: silent; the row stays under "Đã ngừng theo dõi" so the user can tap again.
    }
  };

  const open = (c: Child) =>
    navigation.navigate('ChildForm', { childId: c.id });

  return (
    <FormScreen
      title="Hồ sơ trẻ"
      subtitle="Mỗi khoản chi có thể chia cho một hoặc nhiều trẻ."
    >
      {error ? (
        <Text style={formStyles.error}>Không đọc được danh sách trẻ.</Text>
      ) : children && children.length === 0 ? (
        <View style={[formStyles.card, styles.empty]}>
          <Text style={styles.emptyTitle}>Chưa có trẻ nào</Text>
          <Text style={formStyles.body13}>
            Thêm một tên gọi để bắt đầu ghi và chia chi phí cho từng trẻ.
          </Text>
        </View>
      ) : children ? (
        // Rows fade in/out on later changes only, never on first render (MOTION 4.6).
        <LayoutAnimationConfig skipEntering>
          <Section title="Đang theo dõi" count={active.length}>
            {active.map((c, i) => {
              const own = expenses ? forChild(expenses, c.id) : [];
              return (
                <Row
                  key={c.id}
                  child={c}
                  first={i === 0}
                  tint={AVATAR[i % AVATAR.length]}
                  meta={
                    expenses
                      ? `${monthLabel} · ${vnd(total(own, c.id))} · ${
                          own.length
                        } khoản chi`
                      : ' '
                  }
                  onPress={() => open(c)}
                />
              );
            })}
          </Section>
          {stopped.length ? (
            <>
              <Section title="Đã ngừng theo dõi" count={stopped.length}>
                {stopped.map((c, i) => (
                  <Row
                    key={c.id}
                    child={c}
                    first={i === 0}
                    meta={`Lịch sử được giữ · ${
                      counts?.[c.id] ?? 0
                    } khoản chi cũ`}
                    onPress={() => open(c)}
                    onResume={() => resume(c)}
                  />
                ))}
              </Section>
              <Text style={formStyles.hint}>
                Trẻ đã ngừng theo dõi vẫn có trong báo cáo cũ nhưng không được
                chọn cho khoản chi mới.
              </Text>
            </>
          ) : null}
        </LayoutAnimationConfig>
      ) : null}
      <PrimaryButton
        label="Thêm trẻ"
        onPress={() => navigation.navigate('ChildForm')}
      />
    </FormScreen>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.count}>{count} trẻ</Text>
      </View>
      <Animated.View layout={listLayout} style={[formStyles.card, styles.list]}>
        {count ? (
          children
        ) : (
          <Text style={[formStyles.body13, styles.none]}>Chưa có trẻ nào.</Text>
        )}
      </Animated.View>
    </View>
  );
}

type RowProps = {
  child: Child;
  first: boolean;
  meta: string;
  tint?: string; // undefined = stopped (grey avatar)
  onPress: () => void;
  onResume?: () => void;
};

function Row({ child, first, meta, tint, onPress, onResume }: RowProps) {
  return (
    <Animated.View
      entering={fadeIn}
      exiting={fadeOut}
      layout={listLayout}
      style={!first && styles.divided}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Mở thông tin trẻ"
        onPress={onPress}
        android_ripple={{ color: colors.divider }}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View
          style={[
            styles.avatar,
            { backgroundColor: tint ? `${tint}22` : colors.track },
          ]}
        >
          <Text style={[styles.initial, { color: tint ?? colors.muted }]}>
            {child.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.details}>
          <Text style={[styles.name, !tint && styles.nameStopped]}>
            {child.displayName}
          </Text>
          <Text style={formStyles.hint}>{meta}</Text>
        </View>
        {onResume ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Theo dõi lại ${child.displayName}`}
            onPress={onResume}
            hitSlop={12}
          >
            <Text style={styles.action}>Theo dõi lại</Text>
          </Pressable>
        ) : (
          <ChevronRight size={20} color={colors.muted} />
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: colors.ink,
  },
  count: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.primary,
  },
  list: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  divided: { borderTopWidth: 1, borderTopColor: colors.divider },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  pressed: { backgroundColor: colors.bg },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: fonts.bodySemiBold, fontSize: 16 },
  details: { flex: 1, gap: 3 },
  name: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  nameStopped: { color: colors.muted },
  action: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.primary,
  },
  none: { paddingVertical: spacing.md },
  empty: { padding: spacing.lg, gap: spacing.sm },
  emptyTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.ink,
  },
});
