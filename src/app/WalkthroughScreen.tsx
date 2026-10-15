import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useReducedMotion,
  useScrollOffset,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check } from 'lucide-react-native';
import { PrimaryButton } from '../shared/ui/PrimaryButton';
import { colors, fonts, spacing, text } from '../shared/theme/theme';
import type { RootStackParamList } from './RootNavigator';
import { BudgetArt, SplitArt, SyncArt } from './WalkthroughArt';

type Props = NativeStackScreenProps<RootStackParamList, 'Walkthrough'>;

const PAGES = [
  {
    Art: SplitArt,
    title: 'Chi phí theo từng con',
    body: 'Ghi khoản chi, chọn trẻ được chi và chia cho nhiều trẻ khi cần.',
    points: [
      'Chia đều hoặc nhập từng phần',
      'Mỗi con có tổng chi riêng',
      'Tổng gia đình không bị tính trùng',
    ],
  },
  {
    Art: BudgetArt,
    title: 'Ngân sách cả nhà',
    body: 'Đặt ngân sách tháng cho gia đình và xem tiền đang đi đâu.',
    points: [
      'Còn lại bao nhiêu, vượt bao nhiêu',
      'Báo cáo theo nhóm chi và theo từng con',
      'So sánh với tháng trước',
    ],
  },
  {
    Art: SyncArt,
    title: 'Dữ liệu ở trên máy bạn',
    body: 'Không sao lưu lên cloud. Hai điện thoại ở gần nhau đồng bộ trực tiếp với nhau, không qua máy chủ.',
    points: [
      'Không cần tài khoản',
      'Dữ liệu được mã hóa trên điện thoại',
      'Mất cả hai máy: không có bản sao lưu',
    ],
  },
];

const DOT = 8;
const DOT_ACTIVE_SCALE = 3.5; // active dot is 28 wide, via scaleX (MOTION 4.5)

export function WalkthroughScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const offset = useScrollOffset(scrollRef);
  const [page, setPage] = useState(0);
  const isLast = page === PAGES.length - 1;

  const finish = () => navigation.navigate('FamilySetup');

  const next = () => {
    if (isLast) {
      return finish();
    }
    scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: !reduced });
    setPage(page + 1);
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Text style={styles.brand}>Lutra Hug</Text>
        <Pressable
          accessibilityRole="button"
          onPress={finish}
          hitSlop={12}
          style={styles.skip}
        >
          <Text style={styles.skipLabel}>Bỏ qua</Text>
        </Pressable>
      </View>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
      >
        {PAGES.map(({ Art, title, body, points }) => (
          // Own vertical scroll: large text sizes must not push the content off screen.
          <ScrollView
            key={title}
            style={{ width }}
            contentContainerStyle={styles.page}
            showsVerticalScrollIndicator={false}
          >
            <Art />
            <Text style={text.displayLg} accessibilityRole="header">
              {title}
            </Text>
            <Text style={[text.body, styles.muted]}>{body}</Text>
            <View style={styles.points}>
              {points.map(point => (
                <View key={point} style={styles.point}>
                  <View style={styles.tick}>
                    <Check size={14} color={colors.primary} />
                  </View>
                  <Text style={[text.body, styles.pointText]}>{point}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        ))}
      </Animated.ScrollView>
      <View style={styles.footer}>
        <View style={styles.dots}>
          {PAGES.map((p, i) => (
            <Dot key={p.title} index={i} offset={offset} width={width} />
          ))}
        </View>
        <PrimaryButton label={isLast ? 'Bắt đầu' : 'Tiếp tục'} onPress={next} />
        <Text style={styles.stepCount}>
          {page + 1} / {PAGES.length}
        </Text>
      </View>
    </SafeAreaView>
  );
}

type DotProps = { index: number; offset: SharedValue<number>; width: number };

// Tracks the finger directly (user-driven), so it stays on under reduced motion (MOTION 4.5).
function Dot({ index, offset, width }: DotProps) {
  const style = useAnimatedStyle(() => {
    const input = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      opacity: interpolate(
        offset.value,
        input,
        [0.35, 1, 0.35],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          scaleX: interpolate(
            offset.value,
            input,
            [1, DOT_ACTIVE_SCALE, 1],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });
  return (
    <View
      style={styles.dotSlot}
      accessible
      accessibilityLabel={`Trang ${index + 1} / ${PAGES.length}`}
    >
      <Animated.View style={[styles.dot, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.section,
    paddingTop: spacing.sm,
  },
  brand: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 20,
    color: colors.primary,
  },
  skip: { minHeight: 44, justifyContent: 'center' },
  skipLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.primary,
  },
  page: {
    paddingHorizontal: spacing.section,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.xl - spacing.sm,
  },
  points: { gap: spacing.md },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tick: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointText: { flex: 1, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.muted },
  footer: {
    paddingHorizontal: spacing.section,
    paddingBottom: 28,
    gap: spacing.section,
  },
  stepCount: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  // Slot reserves the widened size so scaleX never overlaps neighbours.
  dotSlot: { width: DOT * DOT_ACTIVE_SCALE, alignItems: 'center' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.primary,
  },
});
