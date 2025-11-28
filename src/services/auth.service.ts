// ============================================
// FILE: src/services/auth.service.ts
// ============================================
import { apiClient } from './api';
import { LoginRequest, LoginResponse } from '../types/api.types';
import DeviceInfo from 'react-native-device-info';
import Geolocation from '@react-native-community/geolocation';

export interface LoginCredentials {
  username: string;
  password: string;
}

class AuthService {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      // Get device info
      const deviceId = await DeviceInfo.getUniqueId();
      const deviceModel = DeviceInfo.getModel();
      const versionName = DeviceInfo.getVersion();

      // Get location
      const location = await this.getCurrentLocation();

      // Get FCM token (placeholder - implement later)
      const fcmToken = 'mock-fcm-token';

      // Build request matching Android LoginRequestEntity
      const request: LoginRequest = {
        employeeId: credentials.username,
        password: credentials.password,
        regId: fcmToken,
        deviceModel,
        deviceId,
        versionName,
        mobileIpAddress: '0.0.0.0', // Get from network info if needed
        mobileLastLocation: location,
      };

      // Call login API (matching Android APIService.validatelogin)
      const response = await apiClient.post<LoginResponse>('/validatelogin', request);

      return response;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid username or password');
      } else if (error.response?.status === 409) {
        throw new Error('Session already open on another device');
      } else if (error.response?.status === 404) {
        throw new Error('No works assigned to this user');
      } else if (error.response?.status === 423) {
        throw new Error('Account is locked');
      }
      throw new Error(error.message || 'Login failed. Please try again.');
    }
  }

  private getCurrentLocation(): Promise<string> {
    return new Promise((resolve) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          resolve(`${latitude},${longitude}`);
        },
        (error) => {
          console.error('Location error:', error);
          resolve('0.0,0.0'); // Default location
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    });
  }
}

export const authService = new AuthService();
