import { useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Banknote,
  Languages,
  ShieldCheck,
  Smartphone,
  type LucideIcon,
} from 'lucide-react-native';
import { newId } from '../care-cost/db';
import { createFamily } from '../care-cost/repo';
import { PrimaryButton } from '../../shared/ui/PrimaryButton';
import { TextField, type TextFieldRef } from '../../shared/ui/TextField';
import { colors, fonts, spacing } from '../../shared/theme/theme';
import { FormScreen, Notice, StepProgress, formStyles } from './parts';
import type { FamilyNav } from './routes';
import { validateDeviceName } from './validation';

const DEFAULTS: [LucideIcon, string, string][] = [
  [Banknote, 'Đơn vị tiền', 'VND'],
  [Languages, 'Ngôn ngữ', 'Tiếng Việt'],
  [Smartphone, 'Thiết bị trong gia đình', 'Tối đa 2'],
];

// FAMILY_SETUP (frame muJxs), onboarding step 1/2. Does not mark onboarding done: FirstChild does.
export function FamilySetupScreen() {
  const navigation = useNavigation<FamilyNav>();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const opId = useRef<string | null>(null);
  const input = useRef<TextFieldRef>(null);

  const submit = async () => {
    const err = validateDeviceName(name);
    setError(err);
    if (err) {
      input.current?.focus();
      AccessibilityInfo.announceForAccessibility(err);
      return;
    }
    setBusy(true);
    setSaveFailed(false);
    try {
      opId.current ??= await newId(); // kept across retries
      await createFamily(name.trim(), opId.current);
      navigation.navigate('FirstChild');
    } catch {
      setSaveFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen
      title="Tạo gia đình trên máy này"
      subtitle="Không cần tài khoản. Sổ chi phí của gia đình được lưu ngay trên điện thoại này."
    >
      <StepProgress step={1} />
      <View style={styles.fieldGroup}>
        <TextField
          ref={input}
          label="Tên thiết bị này"
          placeholder="Điện thoại của mẹ"
          value={name}
          onChangeText={setName}
          error={error}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <Text style={formStyles.hint}>
          Tên này giúp nhận ra máy khi đồng bộ với điện thoại thứ hai.
        </Text>
      </View>
      <View style={[formStyles.card, styles.defaults]}>
        {DEFAULTS.map(([Icon, label, value], i) => (
          <View key={label} style={i > 0 && styles.divided}>
            <View style={styles.row}>
              <Icon size={20} color={colors.muted} />
              <Text style={styles.rowLabel}>{label}</Text>
              <Text style={styles.rowValue}>{value}</Text>
            </View>
          </View>
        ))}
      </View>
      <Notice Icon={ShieldCheck}>
        Dữ liệu chỉ nằm trên thiết bị và được mã hoá. Không có máy chủ hay sao
        lưu đám mây — mất cả hai điện thoại nghĩa là không còn bản sao để khôi
        phục.
      </Notice>
      <View style={formStyles.actions}>
        <PrimaryButton label="Tạo gia đình" onPress={submit} disabled={busy} />
        {saveFailed ? (
          <Text style={formStyles.error} accessibilityLiveRegion="polite">
            Chưa tạo được gia đình. Vui lòng thử lại.
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('JoinSync')}
          style={styles.join}
        >
          <Text style={styles.joinLabel}>
            Đã có gia đình trên điện thoại khác? Tham gia bằng đồng bộ gần
          </Text>
        </Pressable>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  join: { minHeight: 48, justifyContent: 'center' },
  joinLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.primary,
    textAlign: 'center',
  },
  fieldGroup: { gap: spacing.sm },
  defaults: { paddingVertical: spacing.xs, paddingHorizontal: spacing.lg },
  divided: { borderTopWidth: 1, borderTopColor: colors.divider },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  rowValue: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink },
});
