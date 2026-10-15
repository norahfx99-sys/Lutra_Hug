import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Phone, Siren } from 'lucide-react-native';
import { formStyles } from '../family/parts';
import { colors, fonts, radius, spacing } from '../../shared/theme/theme';
import type { AiSettings } from './ai/secure';

/** Shown under a user message that trips the keyword check, before any answer arrives. */
export function EmergencyCard({ onUrgent }: { onUrgent: () => void }) {
  return (
    <View
      style={styles.emergency}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.emergencyHead}>
        <Siren size={20} color={colors.danger} />
        <Text style={styles.emergencyTitle}>
          Nếu đang nguy hiểm, hãy gọi ngay
        </Text>
      </View>
      <Text style={formStyles.body13}>
        Gọi 115 (cấp cứu) hoặc 111 (tổng đài bảo vệ trẻ em). Đừng chờ câu trả
        lời của trợ lý AI.
      </Text>
      <View style={styles.row}>
        <CallButton number="115" />
        <CallButton number="111" />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onUrgent}
        style={styles.linkButton}
      >
        <Text style={styles.link}>Mở trang hỗ trợ khẩn cấp</Text>
      </Pressable>
    </View>
  );
}

function CallButton({ number }: { number: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Gọi ${number}`}
      onPress={() => Linking.openURL(`tel:${number}`).catch(() => {})}
      style={styles.call}
    >
      <Phone size={16} color={colors.onPrimary} />
      <Text style={styles.callText}>Gọi {number}</Text>
    </Pressable>
  );
}

export const hostOf = (url: string) =>
  url
    .trim()
    .replace(/^https?:\/\//i, '')
    .split(/[/?#]/)[0];

/** Plain-language list of what one request contains. Used by the consent dialog and settings. */
export function sentItems(s: AiSettings) {
  return [
    'Câu hỏi bạn gõ và vài tin nhắn gần nhất của cuộc trò chuyện này, kèm bản tóm tắt phần cũ hơn.',
    'Tổng chi phí tháng này và tháng trước, chia theo nhóm, và ngân sách tháng (nếu có).',
    s.shareChildNames
      ? 'Chi phí theo từng trẻ, kèm tên mà bạn đã lưu.'
      : 'Chi phí theo từng trẻ, chỉ ghi "Trẻ 1", "Trẻ 2" (không có tên).',
    s.shareDescriptions
      ? 'Ngày, nhóm, số tiền, mô tả và ghi chú của các khoản chi gần đây.'
      : 'Ngày, nhóm và số tiền của các khoản chi gần đây (không có mô tả, không có ghi chú).',
  ];
}

export const NEVER_SENT =
  'Không bao giờ gửi: khóa API (chỉ dùng để xác thực với nhà cung cấp, lưu trong Keychain của máy), thông tin liên hệ, vị trí.';

export const NO_SERVER_NOTE =
  'Dữ liệu đi thẳng từ điện thoại tới nhà cung cấp AI bạn chọn. Lutra Hug không có máy chủ nào nhận hay lưu nội dung này.';

export const styles = StyleSheet.create({
  emergency: {
    backgroundColor: colors.dangerSurface,
    borderRadius: 18,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emergencyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emergencyTitle: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.danger,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  call: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  callText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.onPrimary,
  },
  linkButton: { minHeight: 48, justifyContent: 'center' },
  link: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.primary },
});
