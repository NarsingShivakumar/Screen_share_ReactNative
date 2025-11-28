// ============================================
// FILE: src/context/AuthContext.tsx
// ============================================
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, LoginCredentials } from '../services/auth.service';
import { storageService } from '../services/storage.service';
import { User, ULBEntity } from '../types/api.types';


interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  selectedULB: ULBEntity | null;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  selectULB: (ulb: ULBEntity) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    token: null,
    selectedULB: null,
    error: null,
  });

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const session = await storageService.getSession();
      if (session) {
        setState({
          isLoading: false,
          isAuthenticated: true,
          user: session.user,
          token: session.token,
          selectedULB: session.selectedULB,
          error: null,
        });
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Session restoration error:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const login = async (credentials: LoginCredentials) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await authService.login(credentials);

      await storageService.saveSession({
        user: response,
        token: response.token,
        selectedULB: null,
      });

      setState({
        isLoading: false,
        isAuthenticated: true,
        user: response,
        token: response.token,
        selectedULB: null,
        error: null,
      });
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Login failed',
      }));
      throw error;
    }
  };

  const logout = async () => {
    try {
      await storageService.clearSession();
      setState({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        token: null,
        selectedULB: null,
        error: null,
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const selectULB = async (ulb: ULBEntity) => {
    try {
      await storageService.saveSelectedULB(ulb);
      setState(prev => ({ ...prev, selectedULB: ulb }));
    } catch (error) {
      console.error('ULB selection error:', error);
    }
  };

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, selectULB, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
