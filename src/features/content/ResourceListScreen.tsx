import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../app/RootNavigator';
import { colors, fonts, spacing } from '../../shared/theme/theme';
import { TextField } from '../../shared/ui/TextField';
import { Chip, EmptyState } from '../care-cost/ui';
import { FormScreen, formStyles } from '../family/parts';
import { SAMPLE_LABEL, resources, sourceLine, topics } from './data';
import { searchResources } from './search';

// RESOURCE_LIST (W2F9o0): topic chips + search over the built-in sample articles.
export function ResourceListScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [topic, setTopic] = useState<string>();
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const pool = topic ? resources.filter(r => r.topic === topic) : resources;
    return query.trim()
      ? searchResources(query, pool).map(h => h.resource)
      : pool;
  }, [topic, query]);

  const clear = () => {
    setTopic(undefined);
    setQuery('');
  };

  return (
    <FormScreen
      title="Thư viện tài liệu"
      subtitle="Bài viết tham khảo chung, không thay thế tư vấn chuyên môn."
    >
      <TextField
        label="Tìm tài liệu"
        placeholder="Nhập tên hoặc chủ đề"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        autoCorrect={false}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label="Tất cả"
          selected={topic === undefined}
          onPress={() => setTopic(undefined)}
        />
        {topics.map(t => (
          <Chip
            key={t}
            label={t}
            selected={topic === t}
            onPress={() => setTopic(t)}
          />
        ))}
      </ScrollView>
      {items.length === 0 ? (
        <EmptyState
          title="Không có tài liệu phù hợp"
          body="Thử từ khóa khác hoặc bỏ bộ lọc chủ đề."
          action="Xóa tìm kiếm và bộ lọc"
          onAction={clear}
        />
      ) : (
        <View style={styles.list}>
          {items.map(r => (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityHint="Mở tài liệu"
              onPress={() =>
                navigation.navigate('ResourceDetail', { resourceId: r.id })
              }
              android_ripple={{ color: colors.divider }}
              style={({ pressed }) => [
                formStyles.card,
                styles.card,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.label}>
                {SAMPLE_LABEL} · {r.topic} · {r.readMinutes} phút đọc
              </Text>
              <Text style={styles.title}>{r.title}</Text>
              <Text style={formStyles.body13}>{r.summary}</Text>
              <Text style={formStyles.hint}>{sourceLine(r.source)}</Text>
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
