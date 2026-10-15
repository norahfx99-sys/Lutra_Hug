import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Lock } from 'lucide-react-native';
import { newId } from '../care-cost/db';
import {
  useAllocationCounts,
  useChildren,
  useOnboarded,
} from '../care-cost/hooks';
import { saveChild, setOnboarded } from '../care-cost/repo';
import { PrimaryButton } from '../../shared/ui/PrimaryButton';
import { TextField, type TextFieldRef } from '../../shared/ui/TextField';
import { colors, fonts, spacing } from '../../shared/theme/theme';
import { FormScreen, Notice, StepProgress, formStyles } from './parts';
import type { ChildFormRoute, FamilyNav } from './routes';
import { validateChildName } from './validation';

// CHILD_FORM: add (myIYB; first child during onboarding) or edit (P1Wpt) via route param childId.
export function ChildFormScreen() {
  const navigation = useNavigation<FamilyNav>();
  const childId = useRoute<ChildFormRoute>().params?.childId;
  const { data: onboarded } = useOnboarded();
  const { data: children } = useChildren();
  const { data: counts } = useAllocationCounts();
  const child = childId ? children?.find(c => c.id === childId) : undefined;
  const firstChild = !childId && onboarded === false;

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const opIds = useRef<Record<string, string>>({});
  const input = useRef<TextFieldRef>(null);

  // Prefill once when the edited child has loaded; later re-reads must not overwrite typing.
  const prefilled = useRef(false);
  useEffect(() => {
    if (child && !prefilled.current) {
      prefilled.current = true;
      setName(child.displayName);
    }
  }, [child]);

  /** One operationId per action key, kept across retries so a replay is a no-op. */
  const persist = async (
    key: string,
    displayName: string,
    isActive?: boolean,
  ) => {
    setBusy(true);
    setSaveFailed(false);
    try {
      opIds.current[key] ??= await newId();
      await saveChild(
        { id: childId, displayName, isActive },
        opIds.current[key],
      );
      // Onboarding ends only once the first child exists; RootNavigator then swaps to Main.
      if (firstChild) await setOnboarded();
      else navigation.goBack();
    } catch {
      setSaveFailed(true); // form keeps its content
      setBusy(false);
    }
  };

  const submit = () => {
    const err = validateChildName(name);
    setError(err);
    if (err) {
      input.current?.focus();
      AccessibilityInfo.announceForAccessibility(err);
      return;
    }
    persist('save', name);
  };

  if (childId && !child) return null; // still loading (or unknown id)

  const shown = child?.displayName ?? '';
  const allocated = (childId && counts?.[childId]) || 0;

  return (
    <FormScreen
      title={
        child
          ? 'Sửa thông tin trẻ'
          : firstChild
          ? 'Thêm trẻ đầu tiên'
          : 'Thêm trẻ'
      }
      subtitle={
        child
          ? 'Đổi tên hoặc ngừng theo dõi. Lịch sử chi phí luôn được giữ.'
          : 'Chỉ cần một tên gọi để ghi và chia chi phí cho từng trẻ.'
      }
    >
      {firstChild ? <StepProgress step={2} /> : null}
      <TextField
        ref={input}
        label="Tên gọi của trẻ"
        placeholder="Nhập tên gọi"
        value={name}
        onChangeText={setName}
        error={error}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      {child ? (
        <View style={[formStyles.card, styles.stop]}>
          <Text style={styles.stopTitle}>
            {child.isActive
              ? `Ngừng theo dõi ${shown}`
              : `${shown} đã ngừng theo dõi`}
          </Text>
          <Text style={formStyles.body13}>
            {shown} vẫn xuất hiện trong lịch sử chi phí cũ nhưng không được chọn
            cho khoản chi mới. Bạn có thể theo dõi lại bất cứ lúc nào.
          </Text>
          {allocated > 0 ? (
            <Text style={formStyles.hint}>
              {shown} có {allocated} khoản chi đã phân bổ nên không thể xoá hẳn.
            </Text>
          ) : null}
        </View>
      ) : (
        <>
          <Notice Icon={Lock}>
            Có thể dùng biệt danh. Không cần ngày sinh, chẩn đoán hay hồ sơ y
            tế. Tên chỉ lưu trên thiết bị của gia đình.
          </Notice>
          {firstChild ? (
            <Text style={formStyles.body13}>
              Có nhiều con? Bạn có thể thêm trẻ khác sau trong mục Hồ sơ trẻ.
            </Text>
          ) : null}
        </>
      )}
      <View style={formStyles.actions}>
        <PrimaryButton
          label={child ? 'Lưu thay đổi' : firstChild ? 'Lưu và bắt đầu' : 'Lưu'}
          onPress={submit}
          disabled={busy || onboarded === undefined}
        />
        {child ? (
          <PrimaryButton
            tone={child.isActive ? 'danger' : 'primary'}
            label={
              child.isActive
                ? `Ngừng theo dõi ${shown}`
                : `Theo dõi lại ${shown}`
            }
            // Stored name: a half-typed rename is not saved with the status change.
            onPress={() =>
              persist(
                child.isActive ? 'stop' : 'resume',
                shown,
                !child.isActive,
              )
            }
            disabled={busy}
          />
        ) : null}
        {saveFailed ? (
          <Text style={formStyles.error} accessibilityLiveRegion="polite">
            Chưa lưu được. Nội dung vẫn giữ nguyên, vui lòng thử lại.
          </Text>
        ) : null}
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  stop: { padding: spacing.lg, gap: 10 },
  stopTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.ink,
  },
});
