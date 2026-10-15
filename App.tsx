import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Boot } from './src/app/Boot';
import { RootNavigator } from './src/app/RootNavigator';
import { colors } from './src/shared/theme/theme';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.surface,
    text: colors.ink,
    border: colors.divider,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <Boot>
        <NavigationContainer theme={navTheme}>
          <RootNavigator />
        </NavigationContainer>
      </Boot>
    </SafeAreaProvider>
  );
}
