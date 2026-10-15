import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Lock } from 'lucide-react-native';
import type { RootStackParamList } from '../../app/RootNavigator';
import { PrimaryButton } from '../../shared/ui/PrimaryButton';
import { colors, fonts, spacing } from '../../shared/theme/theme';
import { FormScreen, Notice, formStyles } from '../family/parts';
import { wipeLocalData } from './wipe';

const FACTS: [string, string][] = [
  [
    'Dữ liệu nằm trên máy này',
    'Sổ chi phí, hồ sơ trẻ và ngân sách được lưu trong cơ sở dữ liệu trên điện thoại và được mã hóa.',
  ],
  [
    'Không có bản sao lưu đám mây',
    'Lutra Hug không sao lưu lên mạng. Nếu mất cả hai điện thoại, dữ liệu không thể khôi phục.',
  ],
  [
    'Không có máy chủ của Lutra Hug',
    'Ứng dụng không có tài khoản và không gửi dữ liệu của bạn tới máy chủ nào của chúng tôi.',
  ],
  [
    'Đồng bộ gần chỉ khi bạn bắt đầu',
    'Dữ liệu chỉ đi sang điện thoại còn lại khi bạn tự mở đồng bộ gần và ghép nối hai máy.',
  ],
];

// PRIVACY (frame uYpli), local-only version: explains where data lives and offers a full wipe.
export function PrivacyScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const wipe = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await wipeLocalData(); // on success the root navigator swaps screens
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  const confirm = () =>
    Alert.alert(
      'Xóa toàn bộ dữ liệu trên máy?',
      'Sẽ xóa gia đình, thiết bị, hồ sơ trẻ, khoản chi, ngân sách, nhật ký thay đổi và xung đột trên điện thoại này. Không thể hoàn tác.\n\nNếu máy này đã ghép nối với điện thoại khác, dữ liệu trên máy kia KHÔNG bị xóa. Bạn cần tạo lại cặp ghép nối sau khi xóa.',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xóa', style: 'destructive', onPress: wipe },
      ],
    );

  return (
    <FormScreen
      title="Dữ liệu của bạn"
      subtitle="Dữ liệu gia đình được giữ riêng tư ngay trên điện thoại."
    >
      <Notice Icon={Lock}>
        Chỉ bạn nắm dữ liệu này. Vì không có máy chủ, cũng không ai khôi phục hộ
        được khi bạn mất máy.
      </Notice>
      <View style={[formStyles.card, styles.list]}>
        {FACTS.map(([title, body], i) => (
          <View key={title} style={[styles.fact, i > 0 && styles.divided]}>
            <Text style={styles.factTitle}>{title}</Text>
            <Text style={formStyles.body13}>{body}</Text>
          </View>
        ))}
      </View>
      <View style={styles.ai}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Trợ lý AI (tùy chọn)
        </Text>
        <Text style={formStyles.body13}>
          Nếu bạn bật trợ lý AI bằng khóa API của riêng mình, câu hỏi và bản tóm
          tắt dữ liệu trên máy sẽ được gửi tới nhà cung cấp AI mà bạn chọn.
          Ngoài ra không có gì khác rời khỏi điện thoại.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('AiSettings')}
          style={styles.link}
        >
          <Text style={styles.linkText}>Mở cài đặt trợ lý AI</Text>
        </Pressable>
      </View>
      <View style={styles.danger}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Xóa dữ liệu
        </Text>
        <Text style={formStyles.body13}>
          Xóa vĩnh viễn mọi dữ liệu gia đình trên máy này và quay lại bước tạo
          gia đình.
        </Text>
        {failed ? (
          <Text style={formStyles.error} accessibilityLiveRegion="polite">
            Không xóa được dữ liệu. Hãy thử lại.
          </Text>
        ) : null}
        <PrimaryButton
          tone="danger"
          label="Xóa toàn bộ dữ liệu trên máy"
          disabled={busy}
          onPress={confirm}
        />
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg },
  fact: { paddingVertical: spacing.lg, gap: 4 },
  divided: { borderTopWidth: 1, borderTopColor: colors.divider },
  factTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.ink,
  },
  ai: { gap: spacing.md },
  link: { minHeight: 48, justifyContent: 'center' },
  linkText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.primary,
  },
  danger: { gap: spacing.md },
  sectionTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: colors.ink,
  },
});
