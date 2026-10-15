import { StyleSheet, Text, View } from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Info } from 'lucide-react-native';
import type { RootStackParamList } from '../../app/RootNavigator';
import { colors, fonts, spacing } from '../../shared/theme/theme';
import { PrimaryButton } from '../../shared/ui/PrimaryButton';
import { EmptyState } from '../care-cost/ui';
import { FormScreen, Notice, formStyles } from '../family/parts';
import { KIND_LABELS, SAMPLE_LABEL, services } from './data';

// SERVICE_DETAIL (I0OSPK). No call/booking action: sample entries have no real contact channel.
export function ServiceDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { serviceId } =
    useRoute<RouteProp<RootStackParamList, 'ServiceDetail'>>().params;
  const s = services.find(x => x.id === serviceId);

  if (!s) {
    return (
      <FormScreen title="Dịch vụ" subtitle="">
        <EmptyState
          title="Không tìm thấy dịch vụ"
          body="Dịch vụ này không còn trong danh bạ."
        />
      </FormScreen>
    );
  }
  const rows: [string, string][] = [
    ['Hình thức', KIND_LABELS[s.kind]],
    ['Giờ hoạt động', s.hours],
    ['Khu vực', s.area],
    ['Cách liên hệ', s.howToReach],
  ];
  return (
    <FormScreen title={s.name} subtitle={`${SAMPLE_LABEL} · ${s.summary}`}>
      <View style={[formStyles.card, styles.card]}>
        {rows.map(([k, v]) => (
          <View key={k} style={styles.row}>
            <Text style={styles.key}>{k}</Text>
            <Text style={styles.value}>{v}</Text>
          </View>
        ))}
      </View>
      <Notice Icon={Info}>
        Lutra Hug không giới thiệu hay bảo đảm cho đơn vị nào và không đặt lịch
        thay bạn. Bạn tự liên hệ và kiểm tra thông tin trực tiếp với đơn vị.
      </Notice>
      <PrimaryButton
        label="Hỗ trợ khẩn cấp"
        tone="danger"
        onPress={() => navigation.navigate('Urgent')}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.md },
  row: { gap: 2 },
  key: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.muted },
  value: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
});
