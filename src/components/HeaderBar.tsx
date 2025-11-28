// ============================================
// FILE: src/components/HeaderBar.tsx
// ============================================
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { DrawerHeaderProps } from '@react-navigation/drawer';
import { BottomTabHeaderProps } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

type HeaderBarProps = DrawerHeaderProps | BottomTabHeaderProps;

const HeaderBar: React.FC<HeaderBarProps> = ({ navigation, route, options }) => {
  const { theme } = useTheme();
  const { user, selectedULB } = useAuth();

  const title = options.title || route.name;

  return (
    <>
      <StatusBar
        barStyle={theme.dark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.primary}
      />
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <View style={styles.headerContent}>
          {/* Left: Menu Button */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.openDrawer()}
          >
            <Icon name="menu" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Center: Title & ULB */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            {selectedULB && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {selectedULB.ulbName}
              </Text>
            )}
          </View>

          {/* Right: Search/Notification Icons */}
          <View style={styles.rightActions}>
            <TouchableOpacity style={styles.iconButton}>
              <Icon name="search" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Icon name="bell" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* User Info Bar (like Android header) */}
        {user && (
          <View style={styles.userInfoBar}>
            <View style={styles.userInfo}>
              <Icon name="user" size={16} color="#FFFFFF" />
              <Text style={styles.userName} numberOfLines={1}>
                {user.employeeName}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Icon name="briefcase" size={16} color="#FFFFFF" />
              <Text style={styles.designation} numberOfLines={1}>
                {user.designation}
              </Text>
            </View>
          </View>
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingTop: StatusBar.currentHeight || 0,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 2,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userName: {
    fontSize: 13,
    color: '#FFFFFF',
    marginLeft: 6,
    fontWeight: '500',
  },
  designation: {
    fontSize: 12,
    color: '#FFFFFF',
    marginLeft: 6,
  },
});

export default HeaderBar;
