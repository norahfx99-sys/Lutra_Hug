import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeartHandshake } from 'lucide-react-native';
import { openDb } from '../features/care-cost/db';
import { PrimaryButton } from '../shared/ui/PrimaryButton';
import { colors, fonts, spacing, text } from '../shared/theme/theme';

// Opens the encrypted DB before anything reads it: splash while opening, error + retry on failure.
export function Boot({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'opening' | 'ready' | 'failed'>('opening');

  const open = useCallback(() => {
    setState('opening');
    openDb().then(
      () => setState('ready'),
      () => {
        console.error('Database open failed'); // no details: may carry user data
        setState('failed');
      },
    );
  }, []);
  useEffect(open, [open]);

  if (state === 'ready') return children;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.center}>
        <HeartHandshake size={48} color={colors.primary} />
        <Text style={text.displayLg} accessibilityRole="header">
          Lutra Hug
        </Text>
        {state === 'failed' ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Text style={styles.errorTitle}>Chưa mở được dữ liệu</Text>
            <Text style={[text.body, styles.muted]}>
              Sổ chi phí trên máy này chưa mở được. Vui lòng thử lại. Nếu vẫn
              lỗi, hãy khởi động lại ứng dụng.
            </Text>
          </View>
        ) : null}
      </View>
      {state === 'failed' ? (
        <PrimaryButton label="Thử lại" onPress={open} />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.screen },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  error: { gap: spacing.sm, alignItems: 'center' },
  errorTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: colors.ink,
  },
  muted: { color: colors.muted, textAlign: 'center' },
});
