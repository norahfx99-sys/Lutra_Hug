import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale } from '../motion/usePressScale';
import { colors, fonts, radius, spacing } from '../theme/theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** 'danger': white outlined button with danger label (P1Wpt "Ngừng theo dõi"). */
  tone?: 'primary' | 'secondary' | 'danger';
};

// Design component NePTf: 52 high, radius 16, lh-primary.
export function PrimaryButton({
  label,
  onPress,
  disabled,
  tone = 'primary',
}: Props) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const danger = tone === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Animated.View
        style={[
          styles.button,
          tone !== 'primary' && styles.outline,
          disabled && styles.disabled,
          animatedStyle,
        ]}
      >
        <Text
          style={[
            styles.label,
            tone === 'secondary' && styles.secondaryLabel,
            danger && styles.dangerLabel,
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  disabled: { opacity: 0.6 },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.onPrimary,
  },
  secondaryLabel: { fontSize: 15, color: colors.primary },
  dangerLabel: { fontSize: 15, color: colors.danger },
});
