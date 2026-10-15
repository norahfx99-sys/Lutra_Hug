import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { colors, fonts } from '../theme/theme';

// "Back navigation" row of the slice-1 frames: back arrow (when there is somewhere to go) + brand.
export function BackBar() {
  const navigation = useNavigation();
  return (
    <View style={styles.bar}>
      {navigation.canGoBack() ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={() => navigation.goBack()}
          hitSlop={11}
        >
          <ArrowLeft size={22} color={colors.primary} />
        </Pressable>
      ) : (
        <View />
      )}
      <Text style={styles.brand}>Lutra Hug</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },
});
