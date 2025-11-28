// ============================================
// FILE: src/components/DrawerContent.tsx
// ============================================
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const DrawerContent: React.FC<DrawerContentComponentProps> = (props) => {
  const { theme, colorScheme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const menuItems = [
    { name: 'MainTabs', icon: 'home', label: 'Home' },
    { name: 'WorksList', icon: 'list', label: 'Works List' },
    { name: 'Estimations', icon: 'file-text', label: 'Estimations' },
    { name: 'Milestones', icon: 'flag', label: 'Milestones' },
    { name: 'MBook', icon: 'book', label: 'Check Measure (MBook)' },
    { name: 'Analytics', icon: 'bar-chart-2', label: 'Analytics' },
    { name: 'Sync', icon: 'refresh-cw', label: 'Sync Data' },
  ];

  const handleLogout = async () => {
    await logout();
    props.navigation.closeDrawer();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.card }]}>
            <Icon name="user" size={32} color={theme.colors.primary} />
          </View>
        </View>
        <Text style={styles.userName}>{user?.employeeName}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <Text style={styles.userDesignation}>{user?.designation}</Text>
      </View>

      {/* Menu Items */}
      <DrawerContentScrollView {...props} style={styles.menuContainer}>
        {menuItems.map((item) => {
          const isFocused = props.state.routes[props.state.index]?.name === item.name;
          return (
            <TouchableOpacity
              key={item.name}
              style={[
                styles.menuItem,
                isFocused && { backgroundColor: theme.colors.primary + '20' },
              ]}
              onPress={() => props.navigation.navigate(item.name as any)}
            >
              <Icon
                name={item.icon}
                size={22}
                color={isFocused ? theme.colors.primary : theme.colors.text}
              />
              <Text
                style={[
                  styles.menuLabel,
                  { color: isFocused ? theme.colors.primary : theme.colors.text },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

        {/* Theme Toggle */}
        <TouchableOpacity style={styles.menuItem} onPress={toggleTheme}>
          <Icon
            name={colorScheme === 'dark' ? 'sun' : 'moon'}
            size={22}
            color={theme.colors.text}
          />
          <Text style={[styles.menuLabel, { color: theme.colors.text }]}>
            {colorScheme === 'dark' ? 'Light Theme' : 'Dark Theme'}
          </Text>
        </TouchableOpacity>

        {/* Settings */}
        <TouchableOpacity style={styles.menuItem}>
          <Icon name="settings" size={22} color={theme.colors.text} />
          <Text style={[styles.menuLabel, { color: theme.colors.text }]}>
            Settings
          </Text>
        </TouchableOpacity>
      </DrawerContentScrollView>

      {/* Logout */}
      <TouchableOpacity
        style={[styles.logoutButton, { borderTopColor: theme.colors.border }]}
        onPress={handleLogout}
      >
        <Icon name="log-out" size={22} color={theme.colors.error} />
        <Text style={[styles.logoutText, { color: theme.colors.error }]}>
          Logout
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 40,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 2,
  },
  userDesignation: {
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  menuContainer: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  menuLabel: {
    fontSize: 15,
    marginLeft: 16,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: 8,
    marginHorizontal: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderTopWidth: 1,
  },
  logoutText: {
    fontSize: 15,
    marginLeft: 16,
    fontWeight: '600',
  },
});

export default DrawerContent;
