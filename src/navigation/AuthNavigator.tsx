// ============================================
// FILE: src/navigation/AuthNavigator.tsx
// ============================================
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import ULBSelectionScreen from '../screens/ULBSelectionScreen';
import { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ULBSelection" component={ULBSelectionScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
