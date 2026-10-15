import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BookOpen,
  ChevronRight,
  MapPin,
  Settings,
  Siren,
} from 'lucide-react-native';
import type { TabProps } from '../../app/RootNavigator';
import { dayLabel, localDate } from '../care-cost/domain';
import { Chip, SectionHeading, styles as ui } from '../care-cost/ui';
import { formStyles } from '../family/parts';
import { PrimaryButton } from '../../shared/ui/PrimaryButton';
import { TextField } from '../../shared/ui/TextField';
import { colors, fonts, spacing } from '../../shared/theme/theme';
import { openConversation } from './ai/chat';
import { deleteConversation } from './ai/chatRepo';
import { suggestQuestions } from './ai/context';
import { useAiSetup, useConversations, useSnapshot } from './ai/hooks';
import { NO_SERVER_NOTE } from './parts';

// ASSISTANT (frame TmBXB). Chips fill the box and never send; sending opens CONVERSATION.
export function AssistantScreen({ navigation }: TabProps<'Assistant'>) {
  const { data: setup } = useAiSetup();
  const { data: snapshot } = useSnapshot();
  const { data: conversations = [] } = useConversations();
  const [draft, setDraft] = useState('');

  const suggestions = snapshot ? suggestQuestions(snapshot) : [];
  const open = (id: string | null, prompt?: string) => {
    openConversation(id);
    navigation.navigate('Conversation', prompt ? { prompt } : undefined);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heading}>
          <Text style={ui.screenTitle} accessibilityRole="header">
            Trợ lý Lutra
          </Text>
          <Text style={ui.muted}>
            Hỏi về chi phí chăm sóc dựa trên số liệu trong máy bạn. Trợ lý không
            chẩn đoán và không thay thế bác sĩ.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityHint="Mở trang hỗ trợ khẩn cấp, không cần trợ lý AI"
          onPress={() => navigation.navigate('Urgent')}
          style={styles.urgent}
        >
          <Siren size={22} color={colors.danger} />
          <Text style={styles.urgentText}>Cần hỗ trợ khẩn cấp</Text>
          <ChevronRight size={20} color={colors.danger} />
        </Pressable>

        {setup && !setup.ready ? (
          <View style={[formStyles.card, styles.setup]}>
            <Text style={styles.cardTitle}>Thiết lập trợ lý AI</Text>
            <Text style={formStyles.body13}>
              Trợ lý dùng khóa API của chính gia đình bạn. Dữ liệu đi thẳng từ
              điện thoại tới nhà cung cấp bạn chọn, không qua máy chủ của Lutra
              Hug.
            </Text>
            <PrimaryButton
              label="Thiết lập trợ lý AI"
              onPress={() => navigation.navigate('AiSettings')}
            />
          </View>
        ) : setup ? (
          <>
            <View style={styles.ask}>
              <TextField
                label="Câu hỏi của bạn"
                value={draft}
                onChangeText={setDraft}
                placeholder="Ví dụ: Tháng này mình chi nhiều nhất vào nhóm nào?"
                multiline
                maxLength={2000}
              />
              <PrimaryButton
                label="Gửi câu hỏi"
                disabled={!draft.trim()}
                onPress={() => open(null, draft.trim())}
              />
            </View>

            {suggestions.length > 0 && (
              <View style={styles.section}>
                <SectionHeading title="Gợi ý từ dữ liệu của bạn" />
                <View style={styles.chips}>
                  {suggestions.map(q => (
                    <Chip
                      key={q}
                      label={q}
                      selected={draft === q}
                      onPress={() => setDraft(q)}
                    />
                  ))}
                </View>
              </View>
            )}

            {conversations.length > 0 && (
              <View style={styles.section}>
                <SectionHeading title="Cuộc trò chuyện gần đây" />
                <View style={[formStyles.card, styles.list]}>
                  {conversations.slice(0, 5).map((c, i) => (
                    <Pressable
                      key={c.id}
                      accessibilityRole="button"
                      accessibilityHint="Nhấn giữ để xóa"
                      onPress={() => open(c.id)}
                      onLongPress={() =>
                        Alert.alert('Xóa cuộc trò chuyện?', c.title, [
                          { text: 'Hủy', style: 'cancel' },
                          {
                            text: 'Xóa',
                            style: 'destructive',
                            onPress: () => deleteConversation(c.id),
                          },
                        ])
                      }
                      style={[styles.row, i > 0 && styles.divided]}
                    >
                      <Text style={styles.rowTitle} numberOfLines={2}>
                        {c.title}
                      </Text>
                      <Text style={formStyles.hint}>
                        {dayLabel(localDate(new Date(c.updatedAt)))}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </>
        ) : null}

        <View style={styles.section}>
          <SectionHeading title="Tìm hiểu thêm" />
          <View style={styles.links}>
            <QuickLink
              label="Tìm dịch vụ"
              Icon={MapPin}
              onPress={() => navigation.navigate('ServiceList')}
            />
            <QuickLink
              label="Tài liệu"
              Icon={BookOpen}
              onPress={() => navigation.navigate('ResourceList')}
            />
            <QuickLink
              label="Cài đặt AI"
              Icon={Settings}
              onPress={() => navigation.navigate('AiSettings')}
            />
          </View>
        </View>

        {/* The setup card already says it; repeat it only once the assistant is usable. */}
        {setup?.ready ? (
          <Text style={formStyles.hint}>{NO_SERVER_NOTE}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickLink({
  label,
  Icon,
  onPress,
}: {
  label: string;
  Icon: typeof Siren;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.link}>
      <Icon size={22} color={colors.primary} />
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.section,
    gap: spacing.section,
  },
  heading: { gap: 5 },
  urgent: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 18,
    backgroundColor: colors.dangerSurface,
  },
  urgentText: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.danger,
  },
  setup: { padding: spacing.lg, gap: spacing.md },
  cardTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.ink,
  },
  ask: { gap: spacing.md },
  section: { gap: spacing.md },
  chips: { gap: spacing.sm, alignItems: 'flex-start' },
  list: { paddingHorizontal: spacing.lg, overflow: 'hidden' },
  row: { minHeight: 56, justifyContent: 'center', paddingVertical: spacing.md },
  divided: { borderTopWidth: 1, borderTopColor: colors.divider },
  rowTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  links: { flexDirection: 'row', gap: spacing.sm },
  link: {
    flex: 1,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  linkText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.ink,
    textAlign: 'center',
  },
});
