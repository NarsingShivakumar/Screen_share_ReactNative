// ============================================
// FILE: src/context/ThemeContext.tsx
// ============================================
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme, Theme } from '../theme/theme';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  mode: ThemeMode;
  colorScheme: 'light' | 'dark';
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('system');
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  );

  // Load saved theme mode on mount
  useEffect(() => {
    loadThemeMode();
  }, []);

  // Listen to system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme: newScheme }) => {
      if (mode === 'system' && newScheme) {
        setColorScheme(newScheme === 'dark' ? 'dark' : 'light');
      }
    });

    return () => subscription.remove();
  }, [mode]);

  const loadThemeMode = async () => {
    try {
      const savedMode = await AsyncStorage.getItem('theme_mode');
      if (savedMode) {
        setThemeMode(savedMode as ThemeMode);
      }
    } catch (error) {
      console.error('Error loading theme mode:', error);
    }
  };

  const setThemeMode = (newMode: ThemeMode) => {
    setMode(newMode);
    
    if (newMode === 'system') {
      const systemScheme = Appearance.getColorScheme();
      setColorScheme(systemScheme === 'dark' ? 'dark' : 'light');
    } else {
      setColorScheme(newMode);
    }

    AsyncStorage.setItem('theme_mode', newMode);
  };

  const toggleTheme = () => {
    const newMode = colorScheme === 'light' ? 'dark' : 'light';
    setThemeMode(newMode);
  };

  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        mode,
        colorScheme,
        toggleTheme,
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
