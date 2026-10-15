import { useEffect, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeIn, useAnimatedStyle } from 'react-native-reanimated';
import {
  CircleCheck,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react-native';
import type { RootStackParamList } from '../../app/RootNavigator';
import { dayLabel, localDate } from '../care-cost/domain';
import { getOnboarded, setOnboarded } from '../care-cost/repo';
import { SampleBanner } from '../../shared/ui/SampleBanner';
import { appTransport } from './appTransport';
import { duration, easing } from '../../shared/motion/tokens';
import { useGrow } from '../../shared/motion/useGrow';
import { PrimaryButton } from '../../shared/ui/PrimaryButton';
import { colors, fonts, radius, spacing } from '../../shared/theme/theme';
import { FormScreen, Notice, formStyles } from '../family/parts';
import { useSyncInfo } from './hooks';
import {
  PROTOCOL_STEPS,
  useSyncSession,
  type FailReason,
  type NearbyTransport,
  type Progress,
  type SyncInfo,
} from './session';

const pad = (n: number) => String(n).padStart(2, '0');
const lastSyncLabel = (at: number | null) => {
  if (at == null) return 'Chưa đồng bộ lần nào';
  const d = new Date(at);
  return `Đồng bộ lần cuối: ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}, ${dayLabel(localDate(d), true)}`;
};

// Only reasons where trying again can change the outcome offer a retry.
const FAILURES: Record<
  FailReason,
  { title: string; body: string; retry: boolean }
> = {
  unavailable: {
    title: 'Chưa có kết nối Nearby',
    body: 'Bản này chưa có kết nối Nearby nên chưa thể đồng bộ với điện thoại khác. Dữ liệu trên máy này vẫn nguyên vẹn.',
    retry: false,
  },
  permission: {
    title: 'Chưa có quyền Nearby',
    body: 'Cần cho phép Bluetooth và thiết bị lân cận để tìm điện thoại thứ hai. Ứng dụng chỉ hỏi khi bạn mở đồng bộ.',
    retry: true,
  },
  mismatch: {
    title: 'Mã không khớp',
    body: 'Đã ngắt kết nối và chưa trao đổi dữ liệu nào. Hãy đặt hai máy sát nhau rồi thử lại.',
    retry: true,
  },
  rejected: {
    title: 'Máy kia không xác nhận mã',
    body: 'Đã ngắt kết nối và chưa trao đổi dữ liệu nào. Hãy thử lại khi cả hai máy đã mở màn hình này.',
    retry: true,
  },
  dropped: {
    title: 'Phiên đồng bộ bị gián đoạn',
    body: 'Kết nối bị ngắt giữa chừng. Phần dữ liệu nhận dở không được ghi vào máy này, nên không có gì bị mất hoặc nhân đôi. Thử lại để tiếp tục.',
    retry: true,
  },
  family: {
    title: 'Hai máy thuộc hai gia đình khác nhau',
    body: 'Ứng dụng không tự gộp hai gia đình. Chưa có dữ liệu nào được thay đổi.',
    retry: false,
  },
  limit: {
    title: 'Gia đình đã đủ 2 điện thoại',
    body: 'Mỗi gia đình ghép tối đa 2 điện thoại. Chưa có dữ liệu nào được gửi sang máy thứ ba.',
    retry: false,
  },
  'no-family': {
    title: 'Chưa máy nào có gia đình',
    body: 'Một trong hai máy cần tạo gia đình trước; máy còn lại chọn "Tham gia gia đình".',
    retry: false,
  },
  unknown: {
    title: 'Đồng bộ chưa hoàn tất',
    body: 'Có lỗi khi đồng bộ. Thay đổi dở dang đã được hoàn tác, thử lại sẽ không tạo bản sao.',
    retry: true,
  },
};

// SYNC_DEVICES (frames XsVbD idle, szQWx searching, hGUyB verifying, E3ad0B transferring,
// R8LJLY done, qro6d interrupted). The transport prop exists for tests and for the native module.
export function SyncDevicesScreen({
  transport = appTransport,
}: {
  transport?: NearbyTransport;
}) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { state, session } = useSyncSession(transport);
  const { data: info } = useSyncInfo();

  // A phone that joined an existing family by sync has its children already: finish onboarding.
  useEffect(() => {
    if (state.step !== 'done') return;
    getOnboarded().then(done => (done ? undefined : setOnboarded()));
  }, [state.step]);

  let body: ReactNode;
  switch (state.step) {
    case 'idle':
      body = info ? <Idle info={info} onStart={session.start} /> : null;
      break;
    case 'searching':
      body = (
        <Section
          busy
          title="Đang tìm điện thoại gần đây"
          text="Mở màn hình Đồng bộ gần trên điện thoại còn lại và đặt hai máy sát nhau."
        >
          {state.peers.map(p => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`Kết nối với ${p.name}`}
              disabled={state.connecting}
              onPress={() => session.connect(p.id)}
              style={[formStyles.card, styles.peer]}
            >
              <Text style={styles.peerName}>{p.name}</Text>
              <Text style={formStyles.body13}>
                {state.connecting ? 'Đang kết nối…' : 'Chạm để kết nối'}
              </Text>
            </Pressable>
          ))}
          <LinkButton label="Hủy" onPress={session.cancel} />
        </Section>
      );
      break;
    case 'verifying':
      body = (
        <Section
          title="Kiểm tra mã xác minh"
          text={`Mã này phải giống hệt mã đang hiện trên ${state.peer.name}. Chỉ xác nhận khi hai mã giống nhau.`}
        >
          <View style={[formStyles.card, styles.codeCard]}>
            <Text
              style={styles.code}
              accessibilityLabel={`Mã xác minh ${state.code
                .split('')
                .join(' ')}`}
            >
              {state.code}
            </Text>
          </View>
          {state.waiting ? (
            <View accessibilityLiveRegion="polite" style={styles.waiting}>
              <ActivityIndicator color={colors.primary} />
              <Text style={formStyles.body13}>Đang chờ máy kia xác nhận…</Text>
            </View>
          ) : (
            <View style={formStyles.actions}>
              <PrimaryButton
                label="Mã khớp"
                onPress={() => session.confirm(true)}
              />
              <PrimaryButton
                label="Mã không khớp"
                tone="danger"
                onPress={() => session.confirm(false)}
              />
            </View>
          )}
          <LinkButton label="Hủy" onPress={session.cancel} />
        </Section>
      );
      break;
    case 'transferring':
      body = (
        <Section
          title="Đang đồng bộ"
          text="Giữ hai máy sát nhau và để ứng dụng mở cho đến khi xong."
        >
          <TransferBar progress={state.progress} />
          <LinkButton label="Dừng đồng bộ" onPress={session.cancel} />
        </Section>
      );
      break;
    case 'done':
      body = (
        <ResultCard
          Icon={CircleCheck}
          color={colors.primary}
          title={state.firstPairing ? 'Đã ghép máy' : 'Đồng bộ xong'}
        >
          <Text style={styles.resultLine}>
            {state.applied > 0
              ? `Đã áp dụng ${state.applied} thay đổi`
              : state.conflictsLeft > 0
              ? 'Chưa áp dụng thay đổi nào vì có xung đột'
              : 'Hai máy đã khớp, không có thay đổi mới'}
          </Text>
          <Text style={styles.resultLine}>
            {state.conflictsLeft > 0
              ? `Còn ${state.conflictsLeft} xung đột cần chọn`
              : 'Không còn xung đột'}
          </Text>
          {state.conflictsLeft > 0 ? (
            <PrimaryButton
              label="Giải quyết xung đột"
              onPress={() => navigation.navigate('SyncConflicts')}
            />
          ) : null}
          <LinkButton label="Xong" onPress={() => navigation.goBack()} />
        </ResultCard>
      );
      break;
    case 'error': {
      const f = FAILURES[state.reason];
      body = (
        <ResultCard Icon={TriangleAlert} color={colors.warning} title={f.title}>
          <Text style={formStyles.body13}>{f.body}</Text>
          {transport.dev && state.detail ? (
            <Text style={formStyles.hint}>{state.detail}</Text>
          ) : null}
          {f.retry ? (
            <PrimaryButton label="Thử lại" onPress={session.start} />
          ) : null}
          <LinkButton label="Đóng" onPress={() => navigation.goBack()} />
        </ResultCard>
      );
    }
  }

  return (
    <FormScreen
      title="Đồng bộ gần"
      subtitle="Chuyển dữ liệu trực tiếp giữa hai điện thoại ở gần nhau, không qua máy chủ."
    >
      {transport.dev ? (
        <SampleBanner>
          Bản phát triển: kết nối thử qua cổng TCP (adb), không phải Nearby và
          không có xác thực.
        </SampleBanner>
      ) : null}
      {body}
    </FormScreen>
  );
}

function Idle({ info, onStart }: { info: SyncInfo; onStart: () => void }) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <>
      <View style={[formStyles.card, styles.status]}>
        <Text style={styles.statusTitle} accessibilityRole="header">
          {info.peer
            ? `Đã ghép với ${info.peer.name}`
            : info.hasFamily
            ? 'Chưa ghép điện thoại thứ hai'
            : 'Máy này chưa có gia đình'}
        </Text>
        <Text style={formStyles.body13}>
          {info.peer
            ? lastSyncLabel(info.peer.lastSyncAt)
            : info.hasFamily
            ? 'Mời điện thoại thứ hai để cả hai cùng xem một sổ chi phí.'
            : 'Tạo gia đình mới, hoặc tham gia gia đình đã có trên điện thoại kia.'}
        </Text>
        {info.openConflicts > 0 ? (
          <LinkButton
            label={`Còn ${info.openConflicts} xung đột cần chọn`}
            onPress={() => navigation.navigate('SyncConflicts')}
          />
        ) : null}
      </View>
      <View style={formStyles.actions}>
        <PrimaryButton
          label={
            info.peer
              ? 'Đồng bộ ngay'
              : info.hasFamily
              ? 'Mời điện thoại thứ hai'
              : 'Tham gia gia đình'
          }
          onPress={onStart}
        />
        {info.hasFamily ? null : (
          <LinkButton
            label="Hoặc tạo gia đình mới trên máy này"
            onPress={() => navigation.navigate('FamilySetup')}
          />
        )}
      </View>
      <Notice Icon={ShieldCheck}>
        Mỗi gia đình ghép tối đa 2 điện thoại. Cả hai máy cần mở màn hình này
        cùng lúc. Khi bắt đầu, điện thoại sẽ hỏi quyền Bluetooth và thiết bị lân
        cận. Không có máy chủ nên mất cả hai điện thoại là không còn bản sao.
      </Notice>
    </>
  );
}

function Section({
  title,
  text,
  busy,
  children,
}: {
  title: string;
  text: string;
  busy?: boolean;
  children?: ReactNode;
}) {
  return (
    <View style={styles.section} accessibilityLiveRegion="polite">
      {busy ? <ActivityIndicator color={colors.primary} size="large" /> : null}
      <Text style={styles.statusTitle} accessibilityRole="header">
        {title}
      </Text>
      <Text style={formStyles.body13}>{text}</Text>
      {children}
    </View>
  );
}

// The step count is real (messages that crossed the link); change counts appear once known.
function TransferBar({ progress }: { progress: Progress }) {
  const g = useGrow(progress.step / PROTOCOL_STEPS);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: g.value }] }));
  return (
    <View style={styles.transfer}>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityLabel="Tiến độ đồng bộ"
        accessibilityValue={{ min: 0, max: PROTOCOL_STEPS, now: progress.step }}
      >
        <Animated.View style={[styles.fill, fill]} />
      </View>
      <Text style={styles.statusTitle}>
        Bước {progress.step}/{PROTOCOL_STEPS}
      </Text>
      {progress.sent != null || progress.received != null ? (
        <Text style={formStyles.body13}>
          {[
            progress.sent != null && `Đã gửi ${progress.sent} thay đổi`,
            progress.received != null &&
              `Đã nhận ${progress.received} thay đổi`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}

function ResultCard({
  Icon,
  color,
  title,
  children,
}: {
  Icon: LucideIcon;
  color: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(duration.slow).easing(easing.enter)}
      style={[formStyles.card, styles.result]}
      accessibilityLiveRegion="polite"
    >
      <Icon size={28} color={color} />
      <Text style={styles.statusTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </Animated.View>
  );
}

function LinkButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.linkButton}
    >
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  status: { padding: spacing.lg, gap: spacing.sm },
  statusTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.ink,
  },
  section: { gap: spacing.lg },
  peer: { padding: spacing.lg, gap: 2, minHeight: 56 },
  peerName: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink },
  codeCard: { padding: spacing.xl, alignItems: 'center' },
  code: {
    fontFamily: fonts.display,
    fontSize: 40,
    letterSpacing: 6,
    color: colors.ink,
  },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  transfer: { gap: spacing.sm },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.track,
  },
  fill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.primary,
    transformOrigin: 'left',
  },
  result: { padding: spacing.lg, gap: spacing.md, borderRadius: radius.lg },
  resultLine: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  linkButton: { minHeight: 48, justifyContent: 'center' },
  link: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.primary },
});
