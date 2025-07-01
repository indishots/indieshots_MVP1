import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { authManager, AuthState, AuthUser } from "@/lib/authManager";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  authState: AuthState;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, isPremiumCoupon?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<{ success: boolean }>;
  enableAuth: () => void;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an UltimateAuthProvider');
  }
  return context;
};

export const UltimateAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authData, setAuthData] = useState<{
    user: AuthUser | null;
    authState: AuthState;
  }>({
    user: null,
    authState: 'loading'
  });

  // Prevent infinite loops with single state update
  const updateAuthState = useCallback((state: AuthState, userData: AuthUser | null) => {
    setAuthData(prev => {
      // Only update if there's actually a change
      if (prev.authState === state && prev.user === userData) {
        return prev;
      }
      return { user: userData, authState: state };
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;
    
    const handleAuthChange = (state: AuthState, userData: AuthUser | null) => {
      if (!mounted) return;
      
      // Debounce state updates to prevent rapid changes
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (mounted) {
          updateAuthState(state, userData);
        }
      }, 10);
    };

    const unsubscribe = authManager.onAuthStateChange(handleAuthChange);
    
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [updateAuthState]);

  // Memoize auth functions to prevent recreating on every render
  const signIn = useCallback(async (email: string, password: string) => {
    authManager.enableAuth();
    const result = await authManager.signInWithEmail(email, password);
    return result.success ? { success: true } : { success: false, error: result.error };
  }, []);

  const signUp = useCallback(async (email: string, password: string, isPremiumCoupon?: boolean) => {
    const result = await authManager.signUpWithEmail(email, password, isPremiumCoupon);
    return result.success ? { success: true } : { success: false, error: result.error };
  }, []);

  const logout = useCallback(async () => {
    return await authManager.logout();
  }, []);

  const enableAuth = useCallback(() => {
    authManager.enableAuth();
  }, []);

  const refreshUserData = useCallback(async () => {
    await authManager.refreshFromDatabase();
  }, []);

  // Memoize the entire context value to prevent unnecessary re-renders
  const contextValue = useMemo<AuthContextType>(() => ({
    user: authData.user,
    loading: authData.authState === 'loading',
    isAuthenticated: authData.authState === 'authenticated',
    authState: authData.authState,
    signIn,
    signUp,
    logout,
    enableAuth,
    refreshUserData,
  }), [authData, signIn, signUp, logout, enableAuth, refreshUserData]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};