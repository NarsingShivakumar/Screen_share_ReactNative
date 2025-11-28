// ============================================
// FILE: src/screens/SplashScreen.tsx
// ============================================
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { storageService } from '../services/storage.service';
import { useAuth } from '../context/AuthContext';

const SplashScreen: React.FC = () => {
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const logoScale = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animations
    Animated.sequence([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 10,
        friction: 2,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Navigation logic handled by AuthContext
    // This screen will be replaced by RootNavigator based on auth state
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            backgroundColor: theme.colors.card,
            transform: [{ scale: logoScale }],
          },
          theme.shadows.large,
        ]}
      >
        <Image
          source={require('../assets/images/gpms_logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
      <Animated.View style={{ opacity: textOpacity }}>
        <Text style={[styles.title, { color: theme.colors.text }]}>GPMS</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Government Project Management System
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default SplashScreen;
