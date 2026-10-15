import { StyleSheet, Text, View } from 'react-native';
import { newId, getDb } from '../care-cost/db';
import { CATEGORY_LABELS, formatVnd, type Category } from '../care-cost/domain';
import { PrimaryButton } from '../../shared/ui/PrimaryButton';
import { colors, fonts, spacing } from '../../shared/theme/theme';
import { FormScreen, formStyles } from '../family/parts';
import { resolveConflict, type OpenConflict } from './engine';
import { useConflicts } from './hooks';

type Side = OpenConflict['remote'];

const KIND = {
  family: 'Gia đình',
  child: 'Hồ sơ trẻ',
  expense: 'Khoản chi',
  monthly_budget: 'Ngân sách tháng',
} as const;

// Shows only fields the user can recognise; the full payload never reaches logs.
function describe(side: Side | null) {
  if (!side) return 'Bên này chưa có bản ghi';
  if (side.op === 'delete') return 'Đã xóa';
  const p = side.payload;
  if ('displayName' in p)
    return `${p.displayName}${p.isActive ? '' : ' · ngừng theo dõi'}`;
  if ('description' in p)
    return `${p.description} · ${formatVnd(p.amountVnd)} · ${p.spentOn} · ${
      CATEGORY_LABELS[p.category as Category]
    }`;
  return `Tháng ${p.month}/${p.year} · ${formatVnd(p.amountVnd)}`;
}

// SYNC_CONFLICTS: records both phones edited from the same version. Nothing is overwritten
// until the user picks a side; the pick is written as a new change and synced back.
export function ConflictsScreen() {
  const { data: conflicts, error } = useConflicts();

  const pick = async (c: OpenConflict, choice: 'local' | 'remote') => {
    try {
      await resolveConflict(getDb(), c.id, choice, await newId());
    } catch {
      // ponytail: silent; the card stays, so the user can tap again.
    }
  };

  return (
    <FormScreen
      title="Xung đột đồng bộ"
      subtitle="Hai điện thoại cùng sửa một bản ghi. Chọn bản muốn giữ; để nhập lại, chọn một bản rồi sửa bằng biểu mẫu thường."
    >
      {error ? (
        <Text style={formStyles.error}>Không đọc được danh sách xung đột.</Text>
      ) : conflicts && conflicts.length === 0 ? (
        <View style={[formStyles.card, styles.card]}>
          <Text style={styles.title}>Không còn xung đột</Text>
          <Text style={formStyles.body13}>
            Mọi thay đổi đã được đồng bộ giữa hai điện thoại.
          </Text>
        </View>
      ) : (
        conflicts?.map(c => (
          <View key={c.id} style={[formStyles.card, styles.card]}>
            <Text style={styles.title} accessibilityRole="header">
              {KIND[c.entityType]}
            </Text>
            <Text style={styles.label}>Bản trên máy này</Text>
            <Text style={styles.value}>{describe(c.local)}</Text>
            <Text style={styles.label}>Bản trên máy kia</Text>
            <Text style={styles.value}>{describe(c.remote)}</Text>
            <PrimaryButton
              label="Giữ bản trên máy này"
              onPress={() => pick(c, 'local')}
              disabled={!c.local}
            />
            <PrimaryButton
              label="Giữ bản trên máy kia"
              onPress={() => pick(c, 'remote')}
            />
          </View>
        ))
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.sm },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  value: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
});
