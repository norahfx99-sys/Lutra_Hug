import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../app/RootNavigator';
import { colors, fonts, spacing } from '../../shared/theme/theme';
import { Chip, EmptyState } from '../care-cost/ui';
import { FormScreen, formStyles } from '../family/parts';
import { KIND_LABELS, SAMPLE_LABEL, services, type ServiceKind } from './data';

// SERVICE_LIST (vu29F): built-in directory with kind filter.
export function ServiceListScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [kind, setKind] = useState<ServiceKind>();
  const items = kind ? services.filter(s => s.kind === kind) : services;

  return (
    <FormScreen
      title="Dịch vụ hỗ trợ"
      subtitle="Danh bạ mẫu để minh họa. Lutra Hug không đặt lịch thay bạn."
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label="Tất cả"
          selected={kind === undefined}
          onPress={() => setKind(undefined)}
        />
        {(Object.keys(KIND_LABELS) as ServiceKind[]).map(k => (
          <Chip
            key={k}
            label={KIND_LABELS[k]}
            selected={kind === k}
            onPress={() => setKind(k)}
          />
        ))}
      </ScrollView>
      {items.length === 0 ? (
        <EmptyState
          title="Chưa có dịch vụ phù hợp"
          body="Thử chọn hình thức khác."
          action="Xem tất cả"
          onAction={() => setKind(undefined)}
        />
      ) : (
        <View style={styles.list}>
          {items.map(s => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityHint="Mở thông tin dịch vụ"
              onPress={() =>
                navigation.navigate('ServiceDetail', { serviceId: s.id })
              }
              android_ripple={{ color: colors.divider }}
              style={({ pressed }) => [
                formStyles.card,
                styles.card,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.label}>
                {SAMPLE_LABEL} · {KIND_LABELS[s.kind]}
              </Text>
              <Text style={styles.title}>{s.name}</Text>
              <Text style={formStyles.body13}>{s.summary}</Text>
              <Text style={formStyles.hint}>Khu vực: {s.area}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: spacing.sm },
  list: { gap: spacing.md },
  card: { padding: spacing.lg, gap: spacing.sm, minHeight: 48 },
  pressed: { backgroundColor: colors.bg },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.primary,
  },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink },
});
