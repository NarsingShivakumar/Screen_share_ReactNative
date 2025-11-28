// ============================================
// FILE: src/services/storage.service.ts
// ============================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, ULBEntity } from '../types/api.types';

interface Session {
  user: User;
  token: string;
  selectedULB: ULBEntity | null;
}

class StorageService {
  private readonly KEYS = {
    SESSION: 'session',
    TOKEN: 'token',
    SELECTED_ULB: 'selected_ulb',
    IS_FIRST_LAUNCH: 'is_first_launch',
  };

  async saveSession(session: Session): Promise<void> {
    await AsyncStorage.setItem(this.KEYS.SESSION, JSON.stringify(session));
    await AsyncStorage.setItem(this.KEYS.TOKEN, session.token);
  }

  async getSession(): Promise<Session | null> {
    try {
      const sessionJson = await AsyncStorage.getItem(this.KEYS.SESSION);
      if (sessionJson) {
        return JSON.parse(sessionJson);
      }
      return null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem(this.KEYS.TOKEN);
  }

  async clearSession(): Promise<void> {
    await AsyncStorage.multiRemove([
      this.KEYS.SESSION,
      this.KEYS.TOKEN,
      this.KEYS.SELECTED_ULB,
    ]);
  }

  async saveSelectedULB(ulb: ULBEntity): Promise<void> {
    await AsyncStorage.setItem(this.KEYS.SELECTED_ULB, JSON.stringify(ulb));
  }

  async isFirstLaunch(): Promise<boolean> {
    const value = await AsyncStorage.getItem(this.KEYS.IS_FIRST_LAUNCH);
    if (value === null) {
      await AsyncStorage.setItem(this.KEYS.IS_FIRST_LAUNCH, 'false');
      return true;
    }
    return false;
  }
}

export const storageService = new StorageService();
