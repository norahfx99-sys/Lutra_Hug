import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Routes these screens use. RootNavigator's RootStackParamList must contain the same entries.
export type FamilyRoutes = {
  FamilySetup: undefined;
  FirstChild: undefined;
  JoinSync: undefined;
  ChildForm: { childId?: string } | undefined;
  Children: undefined;
};

export type FamilyNav = NativeStackNavigationProp<FamilyRoutes>;
export type ChildFormRoute = RouteProp<FamilyRoutes, 'ChildForm'>;
