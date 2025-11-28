// ============================================
// FILE: src/screens/DashboardScreen.tsx
// ============================================
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const DashboardScreen: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();

  const quickActions = [
    { id: '1', icon: 'list', label: 'Works List', color: '#1976D2' },
    { id: '2', icon: 'file-text', label: 'Estimations', color: '#388E3C' },
    { id: '3', icon: 'flag', label: 'Milestones', color: '#F57C00' },
    { id: '4', icon: 'book', label: 'MBook', color: '#7B1FA2' },
  ];

  const pendingCounts = [
    { label: 'Pending MBooks', count: 12, color: '#D32F2F' },
    { label: 'Pending ASN', count: 5, color: '#0288D1' },
    { label: 'Pending TSN', count: 8, color: '#F57C00' },
    { label: 'Draft Items', count: 3, color: '#7B1FA2' },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Welcome Card */}
      <View
        style={[
          styles.welcomeCard,
          { backgroundColor: theme.colors.card },
          theme.shadows.medium,
        ]}
      >
        <Text style={[styles.greeting, { color: theme.colors.text }]}>
          Welcome back, {user?.employeeName.split(' ')[0]}!
        </Text>
        <Text style={[styles.date, { color: theme.colors.textSecondary }]}>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      {/* Quick Actions */}
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Quick Actions
      </Text>
      <View style={styles.quickActionsGrid}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[
              styles.actionCard,
              { backgroundColor: theme.colors.card },
              theme.shadows.small,
            ]}
          >
            <View
              style={[
                styles.actionIcon,
                { backgroundColor: action.color + '20' },
              ]}
            >
              <Icon name={action.icon} size={24} color={action.color} />
            </View>
            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pending Counts */}
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        Pending Items
      </Text>
      {pendingCounts.map((item, index) => (
        <View
          key={index}
          style={[
            styles.pendingCard,
            { backgroundColor: theme.colors.card },
            theme.shadows.small,
          ]}
        >
          <Text style={[styles.pendingLabel, { color: theme.colors.text }]}>
            {item.label}
          </Text>
          <View style={[styles.countBadge, { backgroundColor: item.color }]}>
            <Text style={styles.countText}>{item.count}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  welcomeCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
    marginBottom: 24,
  },
  actionCard: {
    width: '50%',
    padding: 8,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  pendingLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  countBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default DashboardScreen;
