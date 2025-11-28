// ============================================
// FILE: src/navigation/types.ts
// ============================================
import { NavigatorScreenParams } from '@react-navigation/native';
import { ULBEntity } from '../types/api.types';

export type RootStackParamList = {
  Splash: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  App: NavigatorScreenParams<AppDrawerParamList>;
};

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  ULBSelection: { ulbs: ULBEntity[] };
};

export type AppDrawerParamList = {
  MainTabs: NavigatorScreenParams<MainTabsParamList>;
  WorksList: undefined;
  Estimations: undefined;
  Milestones: undefined;
  MBook: undefined;
  Analytics: undefined;
  Sync: undefined;
  Settings: undefined;
};

export type MainTabsParamList = {
  Dashboard: undefined;
  Notifications: undefined;
  Profile: undefined;
};
