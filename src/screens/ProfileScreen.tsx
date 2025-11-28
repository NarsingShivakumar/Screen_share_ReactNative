// ============================================
// FILE: src/screens/ProfileScreen.tsx
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

const ProfileScreen: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();

  const InfoRow: React.FC<{ icon: string; label: string; value: string }> = ({
    icon,
    label,
    value,
  }) => (
    <View style={styles.infoRow}>
      <Icon name={icon} size={20} color={theme.colors.primary} />
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>
          {label}
        </Text>
        <Text style={[styles.infoValue, { color: theme.colors.text }]}>
          {value}
        </Text>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Profile Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.colors.card },
          theme.shadows.medium,
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
          <Icon name="user" size={40} color="#FFFFFF" />
        </View>
        <Text style={[styles.name, { color: theme.colors.text }]}>
          {user?.employeeName}
        </Text>
        <Text style={[styles.designation, { color: theme.colors.textSecondary }]}>
          {user?.designation}
        </Text>
      </View>

      {/* Profile Info */}
      <View
        style={[
          styles.infoCard,
          { backgroundColor: theme.colors.card },
          theme.shadows.small,
        ]}
      >
        <InfoRow icon="mail" label="Email" value={user?.email || 'N/A'} />
        <InfoRow icon="phone" label="Mobile" value={user?.mobileNumber || 'N/A'} />
        <InfoRow
          icon="briefcase"
          label="Department"
          value={user?.department || 'N/A'}
        />
        <InfoRow
          icon="credit-card"
          label="Employee ID"
          value={user?.employeeId || 'N/A'}
        />
      </View>

      {/* Actions */}
      <TouchableOpacity
        style={[
          styles.actionButton,
          { backgroundColor: theme.colors.card },
          theme.shadows.small,
        ]}
      >
        <Icon name="settings" size={20} color={theme.colors.text} />
        <Text style={[styles.actionText, { color: theme.colors.text }]}>
          Account Settings
        </Text>
        <Icon name="chevron-right" size={20} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.actionButton,
          { backgroundColor: theme.colors.card },
          theme.shadows.small,
        ]}
      >
        <Icon name="lock" size={20} color={theme.colors.text} />
        <Text style={[styles.actionText, { color: theme.colors.text }]}>
          Change Password
        </Text>
        <Icon name="chevron-right" size={20} color={theme.colors.textSecondary} />
      </TouchableOpacity>
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
  header: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  designation: {
    fontSize: 14,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  infoContent: {
    marginLeft: 16,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 16,
  },
});

export default ProfileScreen;
