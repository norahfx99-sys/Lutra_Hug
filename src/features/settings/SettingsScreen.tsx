import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight } from 'lucide-react-native';
import type { RootStackParamList } from '../../app/RootNavigator';
import { getDb } from '../care-cost/db';
import { useQuery } from '../care-cost/hooks';
import { colors, fonts, spacing } from '../../shared/theme/theme';
import { FormScreen, formStyles } from '../family/parts';

// Only routes that take no params.
type Route =
  | 'Children'
  | 'SyncDevices'
  | 'Privacy'
  | 'AiSettings'
  | 'ResourceList'
  | 'ServiceList'
  | 'Urgent';

const DATA: [Route, string, string][] = [
  ['Children', 'Hồ sơ trẻ', 'Thêm, sửa hoặc ngừng theo dõi'],
  ['SyncDevices', 'Đồng bộ gần', 'Ghép nối và đồng bộ với điện thoại còn lại'],
  ['Privacy', 'Dữ liệu và quyền riêng tư', 'Nơi lưu dữ liệu, xóa dữ liệu'],
];
const HELP: [Route, string, string][] = [
  ['AiSettings', 'Trợ lý AI', 'Bật, tắt và khóa API của bạn'],
  ['ResourceList', 'Thư viện tài liệu', 'Nội dung mẫu'],
  ['ServiceList', 'Dịch vụ hỗ trợ', 'Danh bạ mẫu'],
  ['Urgent', 'Cần hỗ trợ gấp', 'Số điện thoại và hướng dẫn chung'],
];

const loadDeviceName = async () => {
  const { rows } = await getDb().execute(
    'SELECT display_name FROM device LIMIT 1',
  );
  return rows[0] ? String(rows[0].display_name) : null;
};

// SETTINGS (frame Y7Icxi), local-only: no account rows, only what this phone really has.
export function SettingsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: deviceName } = useQuery(loadDeviceName, []);

  const group = (title: string, rows: [Route, string, string][]) => (
    <Section title={title}>
      {rows.map(([route, label, hint], i) => (
        <Pressable
          key={route}
          accessibilityRole="button"
          accessibilityHint={hint}
          onPress={() => navigation.navigate(route)}
          android_ripple={{ color: colors.divider }}
          style={({ pressed }) => [
            styles.row,
            i > 0 && styles.divided,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.details}>
            <Text style={styles.label}>{label}</Text>
            <Text style={formStyles.hint}>{hint}</Text>
          </View>
          <ChevronRight size={20} color={colors.muted} />
        </Pressable>
      ))}
    </Section>
  );

  return (
    <FormScreen
      title="Hồ sơ và cài đặt"
      subtitle="Mọi thứ ở đây áp dụng cho điện thoại này."
    >
      <Section title="Thiết bị">
        <View style={styles.row}>
          <View style={styles.details}>
            <Text style={styles.label}>Tên thiết bị</Text>
            <Text style={formStyles.hint}>
              {deviceName ?? 'Chưa đặt tên thiết bị'}
            </Text>
          </View>
        </View>
      </Section>
      {group('Dữ liệu gia đình', DATA)}
      {group('Hỗ trợ', HELP)}
    </FormScreen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={[formStyles.card, styles.list]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  sectionTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: colors.ink,
  },
  list: { paddingHorizontal: spacing.lg, overflow: 'hidden' },
  divided: { borderTopWidth: 1, borderTopColor: colors.divider },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  pressed: { backgroundColor: colors.bg },
  details: { flex: 1, gap: 3 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
});
