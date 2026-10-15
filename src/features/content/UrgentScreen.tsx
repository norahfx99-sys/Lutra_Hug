import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Phone, ShieldAlert } from 'lucide-react-native';
import { colors, fonts, spacing } from '../../shared/theme/theme';
import { FormScreen, Notice, formStyles } from '../family/parts';

// The ONLY numbers this screen may show: Vietnamese national numbers.
export const URGENT_NUMBERS = [
  {
    number: '115',
    label: 'Cấp cứu y tế',
    hint: 'Khi cần xe cấp cứu hoặc có nguy cơ tức thời.',
  },
  {
    number: '111',
    label: 'Tổng đài quốc gia bảo vệ trẻ em',
    hint: 'Khi một trẻ cần được bảo vệ hoặc hỗ trợ.',
  },
  {
    number: '113',
    label: 'Công an',
    hint: 'Khi có nguy hiểm về an ninh, an toàn.',
  },
] as const;

// URGENT (rjJiR): fixed copy, works offline. Nothing is dialled until the user taps a row.
export function UrgentScreen() {
  const [failed, setFailed] = useState(false);
  const call = async (n: string) => {
    setFailed(false);
    try {
      await Linking.openURL(`tel:${n}`);
    } catch {
      setFailed(true);
    }
  };

  return (
    <FormScreen
      title="Hỗ trợ khẩn cấp"
      subtitle="Nếu bạn hoặc trẻ đang gặp nguy hiểm, hãy liên hệ ngay các số dưới đây."
    >
      <Notice Icon={ShieldAlert}>
        Lutra Hug không phải dịch vụ cấp cứu và không chẩn đoán. Ứng dụng không
        tự gọi và không gửi vị trí của bạn.
      </Notice>
      <View style={styles.list}>
        {URGENT_NUMBERS.map(n => (
          <Pressable
            key={n.number}
            accessibilityRole="button"
            accessibilityLabel={`Gọi ${n.number}, ${n.label}`}
            accessibilityHint="Mở ứng dụng gọi điện, chưa tự gọi"
            onPress={() => call(n.number)}
            android_ripple={{ color: colors.divider }}
            style={({ pressed }) => [
              formStyles.card,
              styles.row,
              pressed && styles.pressed,
            ]}
          >
            <Phone size={22} color={colors.danger} />
            <View style={styles.flex}>
              <Text style={styles.name}>
                {n.number} · {n.label}
              </Text>
              <Text style={formStyles.hint}>{n.hint}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      {failed && (
        <Text style={formStyles.error} accessibilityRole="alert">
          Không mở được ứng dụng gọi điện. Bạn hãy bấm số trực tiếp trên điện
          thoại.
        </Text>
      )}
      <Text style={formStyles.hint}>
        Các số trên là số quốc gia. Lutra Hug không thêm đường dây nào khác.
      </Text>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    minHeight: 64,
  },
  pressed: { backgroundColor: colors.dangerSurface },
  flex: { flex: 1, gap: 3 },
  name: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink },
});
