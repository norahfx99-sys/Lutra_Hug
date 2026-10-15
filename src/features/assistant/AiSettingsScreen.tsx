import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { Chip, Segment } from '../care-cost/ui';
import { FormScreen, Notice, formStyles } from '../family/parts';
import { PrimaryButton } from '../../shared/ui/PrimaryButton';
import { TextField } from '../../shared/ui/TextField';
import { colors, fonts, spacing } from '../../shared/theme/theme';
import { deleteAllConversations } from './ai/chatRepo';
import { useAiSetup } from './ai/hooks';
import {
  AiError,
  DEFAULT_BASE_URL,
  createProvider,
  toAiError,
  validateBaseUrl,
  type ProviderKind,
} from './ai/providers';
import {
  HISTORY_WINDOWS,
  clearApiKey,
  getApiKey,
  saveApiKey,
  saveSettings,
  type AiSettings,
} from './ai/secure';
import { NEVER_SENT, NO_SERVER_NOTE, sentItems } from './parts';

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI tương thích' },
  { value: 'anthropic', label: 'Anthropic' },
] as const;

const MODEL_EXAMPLE: Record<ProviderKind, string> = {
  openai: 'ví dụ: gpt-4o-mini',
  anthropic: 'ví dụ: claude-sonnet-4-5',
};

type Test = { state: 'idle' | 'running' | 'ok' | 'fail'; message?: string };

// AI_SETTINGS (no design frame): same form kit as the family screens.
export function AiSettingsScreen() {
  const { data, error } = useAiSetup();
  const [form, setForm] = useState<AiSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [errors, setErrors] = useState<{ url?: string; model?: string }>({});
  const [status, setStatus] = useState<string | null>(null);
  const [test, setTest] = useState<Test>({ state: 'idle' });
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (data && !form) setForm(data.settings);
  }, [data, form]);
  useEffect(() => () => abort.current?.abort(), []);

  if (!form)
    return (
      <FormScreen
        title="Trợ lý AI"
        subtitle="Dùng khóa API của chính gia đình bạn."
      >
        {error ? (
          <Text style={formStyles.error}>Không đọc được cài đặt.</Text>
        ) : (
          <></>
        )}
      </FormScreen>
    );

  const set = (patch: Partial<AiSettings>) => {
    setForm({ ...form, ...patch });
    setStatus(null);
  };
  const pickProvider = (kind: ProviderKind) =>
    set({
      provider: kind,
      baseUrl:
        !form.baseUrl.trim() || form.baseUrl === DEFAULT_BASE_URL[form.provider]
          ? DEFAULT_BASE_URL[kind]
          : form.baseUrl,
    });

  const validate = () => {
    const e = {
      url: validateBaseUrl(form.baseUrl) ?? undefined,
      model: form.model.trim() ? undefined : 'Vui lòng nhập tên mô hình.',
    };
    setErrors(e);
    return !e.url && !e.model;
  };

  const save = async () => {
    if (!validate()) return;
    try {
      await saveSettings(form);
      if (apiKey.trim()) await saveApiKey(apiKey);
      setApiKey(''); // the key leaves React state as soon as it is in the keychain
      setStatus(
        data?.hasKey || apiKey.trim()
          ? 'Đã lưu cài đặt.'
          : 'Đã lưu cài đặt. Cần thêm khóa API để dùng trợ lý.',
      );
    } catch {
      setStatus('Chưa lưu được. Nội dung bạn nhập vẫn còn, hãy thử lại.');
    }
  };

  const runTest = async () => {
    if (!validate()) return;
    abort.current?.abort();
    const ctl = (abort.current = new AbortController());
    setTest({ state: 'running' });
    try {
      const key = apiKey.trim() || (await getApiKey());
      if (!key) throw new AiError('no_key');
      const provider = createProvider({
        kind: form.provider,
        baseUrl: form.baseUrl,
        model: form.model.trim(),
        apiKey: key,
        timeoutMs: 20_000,
      });
      await provider.chat({
        system: 'Bạn là bộ kiểm tra kết nối.',
        messages: [{ role: 'user', content: 'Trả lời đúng một từ: OK' }],
        signal: ctl.signal,
      });
      setTest({ state: 'ok', message: 'Kết nối thành công.' });
    } catch (e) {
      const err = toAiError(e);
      if (err.kind !== 'aborted')
        setTest({ state: 'fail', message: err.message });
    }
  };

  const confirm = (title: string, body: string, onOk: () => Promise<void>) =>
    Alert.alert(title, body, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => onOk() },
    ]);

  return (
    <FormScreen
      title="Trợ lý AI"
      subtitle="Dùng khóa API của chính gia đình bạn. Lutra Hug không có máy chủ AI riêng."
    >
      <View style={[formStyles.card, styles.explain]}>
        <Text style={styles.heading} accessibilityRole="header">
          Điều gì rời khỏi điện thoại?
        </Text>
        <Text style={formStyles.body13}>
          Mỗi lần hỏi, ứng dụng gửi tới nhà cung cấp AI bạn chọn:
        </Text>
        {sentItems(form).map(t => (
          <Text key={t} style={formStyles.body13}>
            {'• '}
            {t}
          </Text>
        ))}
        <Text style={formStyles.body13}>{NEVER_SENT}</Text>
        <Text style={formStyles.body13}>{NO_SERVER_NOTE}</Text>
      </View>

      <Segment
        options={PROVIDERS}
        value={form.provider}
        onChange={pickProvider}
      />
      <TextField
        label="Địa chỉ máy chủ"
        value={form.baseUrl}
        onChangeText={v => set({ baseUrl: v })}
        placeholder={DEFAULT_BASE_URL[form.provider]}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        error={errors.url}
      />
      <TextField
        label="Tên mô hình"
        value={form.model}
        onChangeText={v => set({ model: v })}
        placeholder={MODEL_EXAMPLE[form.provider]}
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.model}
      />
      <View style={styles.keyBlock}>
        <TextField
          label="Khóa API"
          value={apiKey}
          onChangeText={v => {
            setApiKey(v);
            setStatus(null);
          }}
          placeholder={
            data?.hasKey
              ? 'Đã lưu trong Keychain. Nhập để thay.'
              : 'Dán khóa API'
          }
          secureTextEntry={!showKey}
          autoCapitalize="none"
          autoCorrect={false}
          // Keep the key out of keyboard suggestions and autofill history.
          autoComplete="off"
          importantForAutofill="no"
          textContentType="none"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showKey ? 'Ẩn khóa API' : 'Hiện khóa API'}
          onPress={() => setShowKey(v => !v)}
          style={styles.linkButton}
        >
          <Text style={styles.link}>{showKey ? 'Ẩn khóa' : 'Hiện khóa'}</Text>
        </Pressable>
        <Text style={formStyles.hint}>
          Khóa chỉ được lưu trong Keychain/Keystore của máy này, không lưu vào
          cơ sở dữ liệu và không đưa vào nội dung gửi đi.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading} accessibilityRole="header">
          Quyền riêng tư
        </Text>
        <Toggle
          label="Gửi tên của trẻ"
          hint="Tắt: trợ lý chỉ thấy “Trẻ 1”, “Trẻ 2”."
          value={form.shareChildNames}
          onChange={v => set({ shareChildNames: v })}
        />
        <Toggle
          label="Gửi mô tả và ghi chú khoản chi"
          hint="Tắt: trợ lý chỉ thấy nhóm và số tiền."
          value={form.shareDescriptions}
          onChange={v => set({ shareDescriptions: v })}
        />
        <Text style={styles.label}>Số tin nhắn gần nhất gửi nguyên văn</Text>
        <View style={styles.chips}>
          {HISTORY_WINDOWS.map(n => (
            <Chip
              key={n}
              label={`${n} tin`}
              selected={form.historyWindow === n}
              onPress={() => set({ historyWindow: n })}
            />
          ))}
        </View>
        <Text style={formStyles.hint}>
          Phần cũ hơn được tóm tắt lại để tiết kiệm lượt gọi.
        </Text>
      </View>

      {status ? <Notice Icon={ShieldCheck}>{status}</Notice> : null}

      <View style={formStyles.actions}>
        <PrimaryButton label="Lưu cài đặt" onPress={save} />
        <PrimaryButton
          label={
            test.state === 'running' ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'
          }
          tone="secondary"
          disabled={test.state === 'running'}
          onPress={runTest}
        />
        {test.message ? (
          <Text
            accessibilityLiveRegion="polite"
            style={test.state === 'ok' ? styles.ok : formStyles.error}
          >
            {test.message}
          </Text>
        ) : null}
        <PrimaryButton
          label="Xóa khóa API"
          tone="danger"
          disabled={!data?.hasKey}
          onPress={() =>
            confirm(
              'Xóa khóa API?',
              'Trợ lý sẽ ngừng hoạt động cho tới khi bạn nhập khóa mới.',
              async () => {
                await clearApiKey();
                setTest({ state: 'idle' });
                setStatus('Đã xóa khóa API khỏi máy.');
              },
            )
          }
        />
        <PrimaryButton
          label="Xóa lịch sử trò chuyện"
          tone="danger"
          onPress={() =>
            confirm(
              'Xóa lịch sử trò chuyện?',
              'Mọi cuộc trò chuyện với trợ lý trên máy này sẽ bị xóa. Không thể hoàn tác.',
              async () => {
                await deleteAllConversations();
                setStatus('Đã xóa lịch sử trò chuyện.');
              },
            )
          }
        />
      </View>
    </FormScreen>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggle}>
      <View style={styles.flex}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={formStyles.hint}>{hint}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.track }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  explain: { padding: spacing.lg, gap: spacing.sm },
  heading: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
  keyBlock: { gap: spacing.sm },
  section: { gap: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
  },
  toggleLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
  },
  flex: { flex: 1, gap: 2 },
  linkButton: { minHeight: 48, justifyContent: 'center' },
  link: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.primary },
  ok: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.primary },
});
