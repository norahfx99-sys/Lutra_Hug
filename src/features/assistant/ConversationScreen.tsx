import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Send, Siren, SquarePen, Square } from 'lucide-react-native';
import type { RootStackParamList } from '../../app/RootNavigator';
import { EmptyState } from '../care-cost/ui';
import { formStyles } from '../family/parts';
import { PrimaryButton } from '../../shared/ui/PrimaryButton';
import { colors, fonts, radius, spacing } from '../../shared/theme/theme';
import {
  answerTurn,
  beginRetry,
  beginTurn,
  openConversation,
  peekOpenConversation,
} from './ai/chat';
import type { Message } from './ai/chatRepo';
import { useAiSetup, useMessages } from './ai/hooks';
import { AiError, toAiError, type AiErrorKind } from './ai/providers';
import { AI_DISCLAIMER, detectEmergency } from './ai/safety';
import { giveConsent } from './ai/secure';
import { ConsentSheet } from './ConsentSheet';
import { EmergencyCard } from './parts';

type Props = NativeStackScreenProps<RootStackParamList, 'Conversation'>;

const NEEDS_SETTINGS: AiErrorKind[] = ['no_key', 'unauthorized'];
const MAX_QUESTION = 2000;

// CONVERSATION (frame cankI). Route param `prompt` = ask this on arrival.
export function ConversationScreen({ navigation, route }: Props) {
  const prompt = route.params?.prompt;
  const insets = useSafeAreaInsets();
  const { data: setup } = useAiSetup();
  const [convId, setConvId] = useState<string | null>(() =>
    prompt ? null : peekOpenConversation(),
  );
  const { data: messages = [] } = useMessages(convId);
  const [draft, setDraft] = useState('');
  const [running, setRunning] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, AiErrorKind>>({});
  const [saveError, setSaveError] = useState(false);
  const [consentFor, setConsentFor] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const prompted = useRef(false);

  useEffect(() => {
    openConversation(null); // the id was captured above; do not leak it to the next visit
    return () => abort.current?.abort();
  }, []);

  const run = async (turn: {
    conversationId: string;
    messageId: string;
    question: string;
  }) => {
    const ctl = (abort.current = new AbortController());
    setRunning(turn.messageId);
    try {
      await answerTurn({ ...turn, signal: ctl.signal });
    } catch (e) {
      setErrors(prev => ({ ...prev, [turn.messageId]: toAiError(e).kind }));
    } finally {
      if (abort.current === ctl) {
        abort.current = null;
        setRunning(null);
      }
    }
  };

  const send = async (question: string) => {
    try {
      setSaveError(false);
      const t = await beginTurn(convId, question);
      setConvId(t.conversationId);
      setDraft('');
      run({ ...t, question });
    } catch {
      // Not stored: the text stays in the composer so nothing is lost.
      setSaveError(true);
    }
  };

  const submit = (text: string) => {
    const question = text.trim();
    if (!question || running || !setup?.ready) return;
    if (setup.consented) send(question);
    else setConsentFor(question);
  };

  useEffect(() => {
    if (!prompt || prompted.current || !setup) return;
    prompted.current = true;
    if (setup.ready) submit(prompt);
    else setDraft(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, setup]);

  const retry = async (m: Message) => {
    if (running || !convId) return;
    try {
      run(await beginRetry(convId, m.id));
    } catch {
      setSaveError(true);
    }
  };

  const startNew = () => {
    abort.current?.abort();
    setConvId(null);
    setErrors({});
    setRunning(null);
  };

  const items = [...messages].reverse();

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <IconButton
            label="Quay lại"
            Icon={ArrowLeft}
            onPress={() => navigation.goBack()}
          />
          <Text style={styles.title} accessibilityRole="header">
            Trò chuyện với Lutra
          </Text>
          <IconButton
            label="Cuộc trò chuyện mới"
            Icon={SquarePen}
            onPress={startNew}
          />
          <IconButton
            label="Hỗ trợ khẩn cấp"
            Icon={Siren}
            tint={colors.danger}
            onPress={() => navigation.navigate('Urgent')}
          />
        </View>

        {items.length === 0 ? (
          <View style={styles.intro}>
            <EmptyState
              title="Hỏi về chi phí chăm sóc"
              body="Mình chỉ dùng số liệu đang có trong máy bạn để trả lời, và sẽ nói rõ khi chưa có dữ liệu. Mình không chẩn đoán hay thay thế bác sĩ."
            />
          </View>
        ) : (
          <FlatList
            style={styles.flex}
            inverted
            data={items}
            keyExtractor={m => m.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Bubble
                m={item}
                running={running === item.id}
                error={errors[item.id]}
                onStop={() => abort.current?.abort()}
                onRetry={() => retry(item)}
                onSettings={() => navigation.navigate('AiSettings')}
                onUrgent={() => navigation.navigate('Urgent')}
              />
            )}
          />
        )}

        <View
          style={[
            styles.composer,
            { paddingBottom: Math.max(insets.bottom, spacing.md) },
          ]}
        >
          {setup && !setup.ready ? (
            <View style={[formStyles.card, styles.setup]}>
              <Text style={styles.setupTitle}>Cần thiết lập trợ lý AI</Text>
              <Text style={formStyles.body13}>
                Nhập khóa API của gia đình bạn để bắt đầu trò chuyện.
              </Text>
              <PrimaryButton
                label="Thiết lập trợ lý AI"
                onPress={() => navigation.navigate('AiSettings')}
              />
            </View>
          ) : (
            <>
              {saveError ? (
                <Text style={formStyles.error} accessibilityLiveRegion="polite">
                  Chưa lưu được tin nhắn. Nội dung vẫn còn trong ô nhập, hãy thử
                  lại.
                </Text>
              ) : null}
              <View style={styles.inputRow}>
                <TextInput
                  accessibilityLabel="Câu hỏi cho trợ lý"
                  style={styles.input}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Hỏi về chi phí hoặc thói quen chăm sóc…"
                  placeholderTextColor={colors.muted}
                  multiline
                  maxLength={MAX_QUESTION}
                />
                {running ? (
                  <IconButton
                    label="Dừng trả lời"
                    Icon={Square}
                    filled
                    onPress={() => abort.current?.abort()}
                  />
                ) : (
                  <IconButton
                    label="Gửi"
                    Icon={Send}
                    filled
                    disabled={!draft.trim() || !setup}
                    onPress={() => submit(draft)}
                  />
                )}
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      {consentFor && setup ? (
        <ConsentSheet
          settings={setup.settings}
          onCancel={() => setConsentFor(null)}
          onPrivacy={() => {
            setConsentFor(null);
            navigation.navigate('AiSettings');
          }}
          onAccept={async () => {
            const q = consentFor;
            setConsentFor(null);
            await giveConsent(setup.settings);
            send(q);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Bubble({
  m,
  running,
  error,
  onStop,
  onRetry,
  onSettings,
  onUrgent,
}: {
  m: Message;
  running: boolean;
  error?: AiErrorKind;
  onStop: () => void;
  onRetry: () => void;
  onSettings: () => void;
  onUrgent: () => void;
}) {
  const mine = m.role === 'user';
  // A 'pending' row nobody is waiting on (app was killed mid-request) is really a failure.
  const failed = m.status === 'failed' || (m.status === 'pending' && !running);
  return (
    <View style={styles.item}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        <Text
          selectable
          accessibilityLabel={`${mine ? 'Bạn' : 'Trợ lý'}: ${m.content}`}
          style={[styles.message, mine && styles.mineText]}
        >
          {m.content}
        </Text>
      </View>
      {!mine ? <Text style={formStyles.hint}>{AI_DISCLAIMER}</Text> : null}
      {mine && detectEmergency(m.content) ? (
        <EmergencyCard onUrgent={onUrgent} />
      ) : null}
      {running ? (
        <View style={styles.status} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.primary} />
          <Text style={formStyles.body13}>Đang trả lời…</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dừng trả lời"
            onPress={onStop}
            style={styles.textButton}
          >
            <Text style={styles.link}>Dừng</Text>
          </Pressable>
        </View>
      ) : null}
      {failed ? (
        <View style={styles.failure} accessibilityLiveRegion="polite">
          <Text style={formStyles.error}>
            {error ? new AiError(error).message : 'Chưa gửi được câu hỏi này.'}
          </Text>
          <View style={styles.status}>
            {error && NEEDS_SETTINGS.includes(error) ? (
              <Pressable
                accessibilityRole="button"
                onPress={onSettings}
                style={styles.textButton}
              >
                <Text style={styles.link}>Mở cài đặt AI</Text>
              </Pressable>
            ) : null}
            {error !== 'no_key' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Thử lại câu hỏi này"
                onPress={onRetry}
                style={styles.textButton}
              >
                <Text style={styles.link}>Thử lại</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function IconButton({
  label,
  Icon,
  onPress,
  tint = colors.primary,
  filled,
  disabled,
}: {
  label: string;
  Icon: typeof Send;
  onPress: () => void;
  tint?: string;
  filled?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.icon, filled && styles.iconFilled, disabled && styles.dim]}
    >
      <Icon size={22} color={filled ? colors.onPrimary : tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  title: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.ink,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFilled: { backgroundColor: colors.primary },
  dim: { opacity: 0.5 },
  intro: { flex: 1, padding: spacing.screen },
  list: { padding: spacing.screen, gap: spacing.lg },
  item: { gap: spacing.sm },
  bubble: { maxWidth: '88%', padding: spacing.md, borderRadius: 18 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  message: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  mineText: { color: colors.onPrimary },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  failure: { gap: spacing.xs },
  textButton: { minHeight: 48, justifyContent: 'center' },
  link: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.primary },
  composer: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.bg,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 140,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
  },
  setup: { padding: spacing.lg, gap: spacing.sm },
  setupTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: colors.ink,
  },
});
