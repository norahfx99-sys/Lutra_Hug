import { StyleSheet, Text, View } from 'react-native';
import { Info } from 'lucide-react-native';
import { colors, fonts, spacing } from '../theme/theme';

/**
 * Marks screens that run on built-in sample data (no server, no account yet).
 * Use it at the top of every community / mentor / assistant / moderation screen.
 */
export function SampleBanner({
  children = 'Dữ liệu mẫu trên máy này. Chưa kết nối máy chủ hay tài khoản.',
}: {
  children?: string;
}) {
  return (
    <View
      style={styles.box}
      accessible
      accessibilityRole="text"
      accessibilityLabel={children}
    >
      <Info size={16} color={colors.warning} />
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.warningSurface,
  },
  text: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.warning,
  },
});
