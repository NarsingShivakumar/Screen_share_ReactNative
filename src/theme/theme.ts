// ============================================
// FILE: src/theme/theme.ts
// ============================================
export interface Theme {
    dark: boolean;
    colors: {
      primary: string;
      primaryDark: string;
      background: string;
      card: string;
      text: string;
      textSecondary: string;
      border: string;
      notification: string;
      error: string;
      success: string;
      warning: string;
      info: string;
      surface: string;
      disabled: string;
      placeholder: string;
      backdrop: string;
    };
    spacing: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
    };
    borderRadius: {
      sm: number;
      md: number;
      lg: number;
      xl: number;
    };
    shadows: {
      small: {
        shadowColor: string;
        shadowOffset: { width: number; height: number };
        shadowOpacity: number;
        shadowRadius: number;
        elevation: number;
      };
      medium: {
        shadowColor: string;
        shadowOffset: { width: number; height: number };
        shadowOpacity: number;
        shadowRadius: number;
        elevation: number;
      };
      large: {
        shadowColor: string;
        shadowOffset: { width: number; height: number };
        shadowOpacity: number;
        shadowRadius: number;
        elevation: number;
      };
    };
    typography: {
      h1: { fontSize: number; fontWeight: '700' | '600' | '500' };
      h2: { fontSize: number; fontWeight: '700' | '600' | '500' };
      h3: { fontSize: number; fontWeight: '700' | '600' | '500' };
      body: { fontSize: number; fontWeight: '400' | '500' };
      caption: { fontSize: number; fontWeight: '400' | '500' };
      button: { fontSize: number; fontWeight: '600' | '700' };
    };
  }
  
  export const lightTheme: Theme = {
    dark: false,
    colors: {
      primary: '#1976D2', // Material Blue 700
      primaryDark: '#1565C0',
      background: '#F5F5F5',
      card: '#FFFFFF',
      text: '#212121',
      textSecondary: '#757575',
      border: '#E0E0E0',
      notification: '#FF5722',
      error: '#D32F2F',
      success: '#388E3C',
      warning: '#F57C00',
      info: '#0288D1',
      surface: '#FFFFFF',
      disabled: '#BDBDBD',
      placeholder: '#9E9E9E',
      backdrop: 'rgba(0, 0, 0, 0.5)',
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    },
    borderRadius: {
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
    },
    shadows: {
      small: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      },
      medium: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 4,
      },
      large: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
      },
    },
    typography: {
      h1: { fontSize: 32, fontWeight: '700' },
      h2: { fontSize: 24, fontWeight: '600' },
      h3: { fontSize: 20, fontWeight: '600' },
      body: { fontSize: 16, fontWeight: '400' },
      caption: { fontSize: 14, fontWeight: '400' },
      button: { fontSize: 16, fontWeight: '600' },
    },
  };
  
  export const darkTheme: Theme = {
    dark: true,
    colors: {
      primary: '#42A5F5', // Material Blue 400
      primaryDark: '#1E88E5',
      background: '#121212',
      card: '#1E1E1E',
      text: '#FFFFFF',
      textSecondary: '#B0B0B0',
      border: '#2C2C2C',
      notification: '#FF6E40',
      error: '#EF5350',
      success: '#66BB6A',
      warning: '#FFA726',
      info: '#29B6F6',
      surface: '#1E1E1E',
      disabled: '#616161',
      placeholder: '#757575',
      backdrop: 'rgba(0, 0, 0, 0.7)',
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    },
    borderRadius: {
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
    },
    shadows: {
      small: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 2,
      },
      medium: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 4,
      },
      large: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 8,
      },
    },
    typography: {
      h1: { fontSize: 32, fontWeight: '700' },
      h2: { fontSize: 24, fontWeight: '600' },
      h3: { fontSize: 20, fontWeight: '600' },
      body: { fontSize: 16, fontWeight: '400' },
      caption: { fontSize: 14, fontWeight: '400' },
      button: { fontSize: 16, fontWeight: '600' },
    },
  };
  