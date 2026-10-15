import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import { BackBar } from '../../shared/ui/BackBar';
import { colors, fonts, spacing, text } from '../../shared/theme/theme';

// Shared layout of muJxs / myIYB / P1Wpt / bnCOs: back bar, heading, column with gap 24.
export function FormScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <BackBar />
        <View style={styles.heading}>
          <Text style={text.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Onboarding "Bước n / 2" with the wide current-step dot. */
export function StepProgress({ step }: { step: 1 | 2 }) {
  return (
    <View style={styles.progress}>
      <View style={styles.dots}>
        {[1, 2].map(i => (
          <View key={i} style={[styles.dot, i === step && styles.dotCurrent]} />
        ))}
      </View>
      <Text style={styles.small}>Bước {step} / 2</Text>
    </View>
  );
}

export function Notice({
  Icon,
  children,
}: {
  Icon: LucideIcon;
  children: string;
}) {
  return (
    <View style={styles.notice}>
      <Icon size={20} color={colors.primary} />
      <Text style={[styles.subtitle, styles.flex]}>{children}</Text>
    </View>
  );
}

export const formStyles = StyleSheet.create({
  hint: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
  body13: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  actions: { gap: spacing.md },
  error: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.danger },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 16,
  },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.section,
    gap: spacing.section,
  },
  heading: { gap: 5 },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
  },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.track },
  dotCurrent: { width: 24, backgroundColor: colors.primary },
  small: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },
  notice: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 18,
    backgroundColor: colors.accentSurface,
  },
  flex: { flex: 1 },
});
