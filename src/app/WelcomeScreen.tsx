import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ChartPie,
  ChevronRight,
  HeartHandshake,
  Smartphone,
  Wallet,
} from 'lucide-react-native';
import { PrimaryButton } from '../shared/ui/PrimaryButton';
import { colors, fonts, spacing, text } from '../shared/theme/theme';
import type { RootStackParamList } from './RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const ROWS = [
  {
    Icon: Wallet,
    title: 'Chi phí theo từng con',
    body: 'Ghi khoản chi và chia cho từng trẻ',
  },
  {
    Icon: ChartPie,
    title: 'Ngân sách và báo cáo',
    body: 'Ngân sách tháng chung cho cả nhà',
  },
  {
    Icon: Smartphone,
    title: 'Dữ liệu ở trên máy bạn',
    body: 'Đồng bộ trực tiếp hai điện thoại, không cloud',
  },
];

// ONBOARD (frame xzTS5). Photo and "Điều khoản · Quyền riêng tư" omitted (remote image, no pages yet).
export function WelcomeScreen({ navigation }: Props) {
  const next = () => navigation.navigate('Walkthrough');
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text style={text.title} accessibilityRole="header">
            {'Chăm sóc con,\nrõ từng khoản chi'}
          </Text>
          <Text style={styles.brand}>Lutra Hug</Text>
        </View>
        <View style={styles.statement}>
          <HeartHandshake size={48} color={colors.primary} />
          <Text style={styles.statementTitle}>
            {'Từng ngày,\ntừng điều nhỏ.'}
          </Text>
          <Text style={styles.statementBody}>
            Ghi chi phí chăm sóc cho từng con. Dữ liệu nằm trên điện thoại của
            bạn, không sao lưu lên cloud.
          </Text>
        </View>
        <View>
          {ROWS.map(({ Icon, title, body }) => (
            <Pressable
              key={title}
              accessibilityRole="button"
              onPress={next}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Icon size={22} color={colors.primary} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{title}</Text>
                <Text style={styles.rowBody}>{body}</Text>
              </View>
              <ChevronRight size={18} color={colors.primary} />
            </Pressable>
          ))}
        </View>
        <PrimaryButton label="Bắt đầu" onPress={next} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.section,
    paddingBottom: spacing.section,
    gap: spacing.section,
  },
  brand: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  statement: {
    backgroundColor: colors.accentSurface,
    borderRadius: 18,
    padding: 18,
    gap: spacing.md,
  },
  statementTitle: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 40,
    color: colors.primary,
  },
  statementBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  pressed: { opacity: 0.7 },
  rowText: { flex: 1, gap: spacing.xs },
  rowTitle: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink },
  rowBody: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
});
