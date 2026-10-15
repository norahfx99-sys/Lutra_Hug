import {
  createBottomTabNavigator,
  type BottomTabScreenProps,
} from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useReducedMotion } from 'react-native-reanimated';
import { House, MessagesSquare, Wallet } from 'lucide-react-native';
import { BudgetScreen } from '../features/care-cost/BudgetScreen';
import type { Category, Month } from '../features/care-cost/domain';
import { ExpenseFormScreen } from '../features/care-cost/ExpenseFormScreen';
import { ExpensesScreen } from '../features/care-cost/ExpensesScreen';
import { useOnboarded } from '../features/care-cost/hooks';
import { ChildFormScreen } from '../features/family/ChildFormScreen';
import { ChildrenScreen } from '../features/family/ChildrenScreen';
import { FamilySetupScreen } from '../features/family/FamilySetupScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { AssistantScreen } from '../features/assistant/AssistantScreen';
import { AiSettingsScreen } from '../features/assistant/AiSettingsScreen';
import { ConversationScreen } from '../features/assistant/ConversationScreen';
import { ResourceDetailScreen } from '../features/content/ResourceDetailScreen';
import { ResourceListScreen } from '../features/content/ResourceListScreen';
import { ServiceDetailScreen } from '../features/content/ServiceDetailScreen';
import { ServiceListScreen } from '../features/content/ServiceListScreen';
import { UrgentScreen } from '../features/content/UrgentScreen';
import { ConflictsScreen } from '../features/nearby-sync/ConflictsScreen';
import { SyncDevicesScreen } from '../features/nearby-sync/SyncDevicesScreen';
import { PrivacyScreen } from '../features/settings/PrivacyScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { colors, fonts } from '../shared/theme/theme';
import { WalkthroughScreen } from './WalkthroughScreen';
import { WelcomeScreen } from './WelcomeScreen';

export type TabParamList = {
  Home: undefined;
  /** Each param, when present, is applied once on arrival (drill-down from HOME/charts). */
  Expenses:
    | { month?: Month; category?: Category; mode?: 'list' | 'reports' }
    | undefined;
  Assistant: undefined;
};

export type RootStackParamList = {
  Welcome: undefined;
  Walkthrough: undefined;
  FamilySetup: undefined;
  JoinSync: undefined; // SyncDevices during onboarding; own name so the Main swap drops it
  FirstChild: undefined; // ChildForm during onboarding; its own name so the Main swap drops it
  ChildForm: { childId?: string } | undefined;
  Children: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  ExpenseForm:
    | { expenseId?: string; month?: Month; category?: Category }
    | undefined;
  Budget: { month: Month };
  SyncConflicts: undefined;
  SyncDevices: undefined;
  Settings: undefined;
  Privacy: undefined;
  ResourceList: undefined;
  ResourceDetail: { resourceId: string };
  ServiceList: undefined;
  ServiceDetail: { serviceId: string };
  Urgent: undefined;
  Conversation: { prompt?: string } | undefined;
  AiSettings: undefined;
};

export type TabProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

type TabIconProps = { color: string; size: number };
const HomeIcon = ({ color, size }: TabIconProps) => (
  <House color={color} size={size} />
);
const ExpensesIcon = ({ color, size }: TabIconProps) => (
  <Wallet color={color} size={size} />
);
const AssistantIcon = ({ color, size }: TabIconProps) => (
  <MessagesSquare color={color} size={size} />
);

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'none', // MOTION 4.3
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Trang chủ', tabBarIcon: HomeIcon }}
      />
      <Tab.Screen
        name="Expenses"
        component={ExpensesScreen}
        options={{ title: 'Chi phí', tabBarIcon: ExpensesIcon }}
      />
      <Tab.Screen
        name="Assistant"
        component={AssistantScreen}
        options={{ title: 'Trợ lý AI', tabBarIcon: AssistantIcon }}
      />
    </Tab.Navigator>
  );
}

// Onboarding: Welcome -> Walkthrough -> FamilySetup -> FirstChild -> Main.
// The family screens own the writes (createFamily, first saveChild, setOnboarded);
// setOnboarded emits, useOnboarded flips and this stack swaps to Main.
export function RootNavigator() {
  const reduced = useReducedMotion();
  const { data: onboarded, error } = useOnboarded();
  // ponytail: no splash/error screen yet; blank while the encrypted DB opens.
  if (error) console.error('Database open failed');
  if (onboarded === undefined) return null;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: reduced ? 'fade' : 'default', // MOTION 4.1
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      {onboarded ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="ExpenseForm" component={ExpenseFormScreen} />
          <Stack.Screen name="Budget" component={BudgetScreen} />
          <Stack.Screen name="Children" component={ChildrenScreen} />
          <Stack.Screen name="ChildForm" component={ChildFormScreen} />
          <Stack.Screen name="SyncConflicts" component={ConflictsScreen} />
          <Stack.Screen name="SyncDevices" component={SyncDevicesScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Privacy" component={PrivacyScreen} />
          <Stack.Screen name="ResourceList" component={ResourceListScreen} />
          <Stack.Screen
            name="ResourceDetail"
            component={ResourceDetailScreen}
          />
          <Stack.Screen name="ServiceList" component={ServiceListScreen} />
          <Stack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
          <Stack.Screen name="Urgent" component={UrgentScreen} />
          <Stack.Screen name="Conversation" component={ConversationScreen} />
          <Stack.Screen name="AiSettings" component={AiSettingsScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Walkthrough" component={WalkthroughScreen} />
          <Stack.Screen name="FamilySetup" component={FamilySetupScreen} />
          <Stack.Screen name="JoinSync" component={SyncDevicesScreen} />
          <Stack.Screen name="FirstChild" component={ChildFormScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
