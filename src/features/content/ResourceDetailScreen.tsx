import { StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Info } from 'lucide-react-native';
import type { RootStackParamList } from '../../app/RootNavigator';
import { colors, fonts, spacing } from '../../shared/theme/theme';
import { EmptyState } from '../care-cost/ui';
import { FormScreen, Notice, formStyles } from '../family/parts';
import { SAMPLE_LABEL, resources, sourceLine } from './data';

// RESOURCE_DETAIL (ve8wA): sections plus source and review date.
export function ResourceDetailScreen() {
  const { resourceId } =
    useRoute<RouteProp<RootStackParamList, 'ResourceDetail'>>().params;
  const r = resources.find(x => x.id === resourceId);

  if (!r) {
    return (
      <FormScreen title="Tài liệu" subtitle="">
        <EmptyState
          title="Không tìm thấy tài liệu"
          body="Tài liệu này không còn trong thư viện."
        />
      </FormScreen>
    );
  }
  return (
    <FormScreen
      title={r.title}
      subtitle={`${SAMPLE_LABEL} · ${r.topic} · ${r.readMinutes} phút đọc`}
    >
      <Notice Icon={Info}>
        Bài viết chung, không phải lời khuyên y khoa và không thay thế chuyên
        gia. Khi cần, hãy liên hệ người có chuyên môn.
      </Notice>
      {r.sections.map(s => (
        <View key={s.heading} style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">
            {s.heading}
          </Text>
          <Text style={styles.body}>{s.body}</Text>
        </View>
      ))}
      <Text style={formStyles.hint}>{sourceLine(r.source)}</Text>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  heading: { fontFamily: fonts.bodySemiBold, fontSize: 18, color: colors.ink },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink,
  },
});
