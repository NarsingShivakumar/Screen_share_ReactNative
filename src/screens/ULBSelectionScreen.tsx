// ============================================
// FILE: src/screens/ULBSelectionScreen.tsx
// ============================================
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { AuthStackParamList } from '../navigation/types';
import { ULBEntity } from '../types/api.types';

type ULBSelectionRouteProp = RouteProp<AuthStackParamList, 'ULBSelection'>;

const ULBSelectionScreen: React.FC = () => {
  const { theme } = useTheme();
  const { user, selectULB } = useAuth();
  const navigation = useNavigation();
  const route = useRoute<ULBSelectionRouteProp>();

  const ulbs = user?.ulbList || [];

  const handleSelectULB = async (ulb: ULBEntity) => {
    await selectULB(ulb);
    // Navigation to App handled by RootNavigator
  };

  const renderULBItem = ({ item }: { item: ULBEntity }) => (
    <TouchableOpacity
      style={[
        styles.ulbCard,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
        theme.shadows.medium,
      ]}
      onPress={() => handleSelectULB(item)}
    >
      <View style={styles.ulbInfo}>
        <Text style={[styles.ulbName, { color: theme.colors.text }]}>
          {item.ulbName}
        </Text>
        <Text style={[styles.designation, { color: theme.colors.textSecondary }]}>
          {item.designationName}
        </Text>
        <View style={styles.worksBadge}>
          <Icon name="briefcase" size={14} color={theme.colors.primary} />
          <Text style={[styles.worksCount, { color: theme.colors.primary }]}>
            {item.totalWorks} Works
          </Text>
        </View>
      </View>
      <Icon name="chevron-right" size={24} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Select ULB & Designation
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Choose the ULB and designation you want to work with
        </Text>
      </View>

      <FlatList
        data={ulbs}
        renderItem={renderULBItem}
        keyExtractor={(item) => item.employeeDesignationId}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  ulbCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  ulbInfo: {
    flex: 1,
  },
  ulbName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  designation: {
    fontSize: 14,
    marginBottom: 8,
  },
  worksBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  worksCount: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
});

export default ULBSelectionScreen;
