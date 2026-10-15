import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formStyles } from '../family/parts';
import { PrimaryButton } from '../../shared/ui/PrimaryButton';
import { colors, fonts, spacing } from '../../shared/theme/theme';
import { buildContext } from './ai/context';
import { renderDataBlock } from './ai/promptBuilder';
import type { AiSettings } from './ai/secure';
import { NEVER_SENT, NO_SERVER_NOTE, hostOf, sentItems } from './parts';

/** First-send consent: lists exactly what leaves the phone and where it goes. */
export function ConsentSheet({
  settings,
  onAccept,
  onCancel,
  onPrivacy,
}: {
  settings: AiSettings;
  onAccept: () => void;
  onCancel: () => void;
  onPrivacy: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const showPreview = async () => {
    try {
      setFailed(false);
      setPreview(renderDataBlock(await buildContext(settings)));
    } catch {
      setFailed(true);
    }
  };

  return (
    <Modal visible animationType="fade" onRequestClose={onCancel}>
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title} accessibilityRole="header">
            Trước khi gửi lần đầu
          </Text>
          <Text style={formStyles.body13}>
            Câu hỏi sẽ được gửi tới {hostOf(settings.baseUrl)} bằng khóa API của
            gia đình bạn. Mỗi lần hỏi gồm:
          </Text>
          {sentItems(settings).map(t => (
            <Text key={t} style={formStyles.body13}>
              {'• '}
              {t}
            </Text>
          ))}
          <Text style={formStyles.body13}>{NEVER_SENT}</Text>
          <Text style={formStyles.body13}>{NO_SERVER_NOTE}</Text>

          <Pressable
            accessibilityRole="button"
            onPress={showPreview}
            style={styles.linkButton}
          >
            <Text style={styles.link}>Xem trước nội dung gửi đi</Text>
          </Pressable>
          {failed ? (
            <Text style={formStyles.error}>Không dựng được bản xem trước.</Text>
          ) : null}
          {preview ? (
            <View style={[formStyles.card, styles.preview]}>
              <Text selectable style={styles.previewText}>
                {preview}
              </Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={onPrivacy}
            style={styles.linkButton}
          >
            <Text style={styles.link}>Đổi những gì được gửi</Text>
          </Pressable>
        </ScrollView>
        <View style={styles.actions}>
          <PrimaryButton label="Đồng ý và gửi" onPress={onAccept} />
          <PrimaryButton label="Không gửi" tone="danger" onPress={onCancel} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.screen,
    gap: spacing.md,
  },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 22, color: colors.ink },
  actions: { padding: spacing.screen, gap: spacing.md },
  preview: { padding: spacing.md },
  previewText: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.ink,
  },
  linkButton: { minHeight: 48, justifyContent: 'center' },
  link: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.primary },
});
