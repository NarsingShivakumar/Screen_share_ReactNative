// ============================================
// FILE: src/navigation/AppDrawerNavigator.tsx
// ============================================
import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import BottomTabsNavigator from './BottomTabsNavigator';
import WorksListScreen from '../screens/WorksListScreen';
import DrawerContent from '../components/DrawerContent';
import { AppDrawerParamList } from './types';

const Drawer = createDrawerNavigator<AppDrawerParamList>();

const AppDrawerNavigator: React.FC = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: {
          width: 280,
        },
      }}
    >
      <Drawer.Screen 
        name="MainTabs" 
        component={BottomTabsNavigator}
        options={{ title: 'Home' }}
      />
      <Drawer.Screen 
        name="WorksList" 
        component={WorksListScreen}
        options={{ title: 'Works List' }}
      />
    </Drawer.Navigator>
  );
};

export default AppDrawerNavigator;
