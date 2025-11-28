// ============================================
// FILE: App.tsx
// ============================================
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { SafeAreaView } from 'react-native-safe-area-context';
import permissionService from './src/services/permissionService';

const App: React.FC = () => {
  const [permissionsGranted, setPermissionsGranted] = useState<boolean>(false)
  const [checkingPermissions, setCheckingPermissions] = useState<boolean>(false)

  useEffect( () => {
    checkPermissions();
  }, []);

  const checkPermissions = async (): Promise<void> => {
    const hasPermission: boolean = await permissionService.checkStoragePermission();
    if (hasPermission) {
      setPermissionsGranted(true);
    } else {
      const granted: boolean = await permissionService.requestStoragePermission();
      setPermissionsGranted(granted);
    }

  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} >
      <ThemeProvider>
        <AuthProvider>
          <StatusBar translucent backgroundColor="transparent" />
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

export default App;
