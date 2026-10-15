import type { ComponentRef, Ref } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors, fonts, radius, spacing } from '../theme/theme';

type Props = TextInputProps & {
  label: string;
  error?: string | null;
  ref?: Ref<TextFieldRef>;
};

export type TextFieldRef = ComponentRef<typeof TextInput>;

// Design component gyjx4 (Form field). Error per MOTION 4.8: border colour + message, no animation.
export function TextField({ label, error, ref, style, ...input }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.ink,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  inputError: { borderColor: colors.danger },
  error: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.danger,
  },
});
