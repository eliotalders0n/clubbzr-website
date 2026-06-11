/**
 * Authentication Context
 * Club BZR - Experimental Art Community
 *
 * Provides authentication state management throughout the app
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { User as FirebaseUser } from 'firebase/auth';

import {
  onAuthStateChange,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  resetPassword,
  updateProfile,
  reauthenticate,
  deleteAccount,
  getUserDocument,
  getUserRole,
  hasRole,
  type AuthResult,
  type SignUpData,
  type SignInData,
  type UpdateProfileData,
  type AuthErrorInfo,
} from '../../lib/authentication';
import type { User, UserRole } from '../../lib/schema';

// =============================================================================
// TYPES
// =============================================================================

export interface AuthState {
  /** Firebase auth user */
  firebaseUser: FirebaseUser | null;
  /** Firestore user document with extended profile */
  user: User | null;
  /** Loading state during auth operations */
  loading: boolean;
  /** Initial auth check completed */
  initialized: boolean;
  /** Current error if any */
  error: AuthErrorInfo | null;
}

export interface AuthActions {
  /** Sign in with Google */
  signInWithGoogle: () => Promise<AuthResult>;
  /** Sign in with email/password */
  signInWithEmail: (data: SignInData) => Promise<AuthResult>;
  /** Sign up with email/password */
  signUpWithEmail: (data: SignUpData) => Promise<AuthResult>;
  /** Sign out current user */
  signOut: () => Promise<AuthResult>;
  /** Send password reset email */
  resetPassword: (email: string) => Promise<AuthResult>;
  /** Update user profile */
  updateProfile: (data: UpdateProfileData) => Promise<AuthResult>;
  /** Reauthenticate user */
  reauthenticate: (password: string) => Promise<AuthResult>;
  /** Delete user account */
  deleteAccount: () => Promise<AuthResult>;
  /** Refresh user data from Firestore */
  refreshUser: () => Promise<void>;
  /** Clear current error */
  clearError: () => void;
  /** Check if user has specific role(s) */
  hasRole: (roles: UserRole[]) => boolean;
}

export interface AuthContextValue extends AuthState, AuthActions {}

// =============================================================================
// CONTEXT
// =============================================================================

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// =============================================================================
// PROVIDER
// =============================================================================

export interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<AuthErrorInfo | null>(null);

  // Fetch user document from Firestore
  const fetchUserDocument = useCallback(async (uid: string): Promise<User | null> => {
    try {
      return await getUserDocument(uid);
    } catch (err) {
      console.error('Error fetching user document:', err);
      return null;
    }
  }, []);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        const userDoc = await fetchUserDocument(fbUser.uid);
        setUser(userDoc);
      } else {
        setUser(null);
      }

      setInitialized(true);
    });

    return () => unsubscribe();
  }, [fetchUserDocument]);

  // Wrapper for auth operations with loading/error handling
  const withAuthOperation = useCallback(
    async (operation: () => Promise<AuthResult>): Promise<AuthResult> => {
      setLoading(true);
      setError(null);

      try {
        const result = await operation();

        if (!result.success && result.error) {
          setError(result.error);
        }

        // Refresh user document after successful operation
        if (result.success && result.user) {
          const userDoc = await fetchUserDocument(result.user.uid);
          setUser(userDoc);
        }

        return result;
      } catch (err) {
        const errorInfo: AuthErrorInfo = {
          code: 'unknown',
          message: 'An unexpected error occurred.',
        };
        setError(errorInfo);
        return { success: false, error: errorInfo };
      } finally {
        setLoading(false);
      }
    },
    [fetchUserDocument]
  );

  // Auth actions
  const handleSignInWithGoogle = useCallback(async () => {
    return withAuthOperation(signInWithGoogle);
  }, [withAuthOperation]);

  const handleSignInWithEmail = useCallback(
    async (data: SignInData) => {
      return withAuthOperation(() => signInWithEmail(data));
    },
    [withAuthOperation]
  );

  const handleSignUpWithEmail = useCallback(
    async (data: SignUpData) => {
      return withAuthOperation(() => signUpWithEmail(data));
    },
    [withAuthOperation]
  );

  const handleSignOut = useCallback(async () => {
    const result = await withAuthOperation(signOut);
    if (result.success) {
      setUser(null);
    }
    return result;
  }, [withAuthOperation]);

  const handleResetPassword = useCallback(
    async (email: string) => {
      return withAuthOperation(() => resetPassword(email));
    },
    [withAuthOperation]
  );

  const handleUpdateProfile = useCallback(
    async (data: UpdateProfileData) => {
      return withAuthOperation(() => updateProfile(data));
    },
    [withAuthOperation]
  );

  const handleReauthenticate = useCallback(
    async (password: string) => {
      return withAuthOperation(() => reauthenticate(password));
    },
    [withAuthOperation]
  );

  const handleDeleteAccount = useCallback(async () => {
    const result = await withAuthOperation(deleteAccount);
    if (result.success) {
      setUser(null);
    }
    return result;
  }, [withAuthOperation]);

  const refreshUser = useCallback(async () => {
    if (firebaseUser) {
      setLoading(true);
      const userDoc = await fetchUserDocument(firebaseUser.uid);
      setUser(userDoc);
      setLoading(false);
    }
  }, [firebaseUser, fetchUserDocument]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const checkHasRole = useCallback(
    (roles: UserRole[]): boolean => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      return roles.includes(user.role);
    },
    [user]
  );

  // Memoize context value
  const value = useMemo<AuthContextValue>(
    () => ({
      // State
      firebaseUser,
      user,
      loading,
      initialized,
      error,
      // Actions
      signInWithGoogle: handleSignInWithGoogle,
      signInWithEmail: handleSignInWithEmail,
      signUpWithEmail: handleSignUpWithEmail,
      signOut: handleSignOut,
      resetPassword: handleResetPassword,
      updateProfile: handleUpdateProfile,
      reauthenticate: handleReauthenticate,
      deleteAccount: handleDeleteAccount,
      refreshUser,
      clearError,
      hasRole: checkHasRole,
    }),
    [
      firebaseUser,
      user,
      loading,
      initialized,
      error,
      handleSignInWithGoogle,
      handleSignInWithEmail,
      handleSignUpWithEmail,
      handleSignOut,
      handleResetPassword,
      handleUpdateProfile,
      handleReauthenticate,
      handleDeleteAccount,
      refreshUser,
      clearError,
      checkHasRole,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to access auth context
 */
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

/**
 * Hook to get current user (throws if not authenticated)
 */
export const useRequiredAuth = (): AuthContextValue & { user: User; firebaseUser: FirebaseUser } => {
  const auth = useAuth();

  if (!auth.user || !auth.firebaseUser) {
    throw new Error('useRequiredAuth must be used when user is authenticated');
  }

  return auth as AuthContextValue & { user: User; firebaseUser: FirebaseUser };
};

// =============================================================================
// PROTECTED ROUTE WRAPPER
// =============================================================================

export interface ProtectedRouteProps {
  children: ReactNode;
  /** Required roles (user passes if they have any of these) */
  requiredRoles?: UserRole[];
  /** Fallback component when loading */
  loadingFallback?: ReactNode;
  /** Fallback component when not authenticated */
  unauthenticatedFallback?: ReactNode;
  /** Fallback component when unauthorized (wrong role) */
  unauthorizedFallback?: ReactNode;
  /** Callback when redirect is needed */
  onRedirect?: (reason: 'unauthenticated' | 'unauthorized') => void;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
  loadingFallback = null,
  unauthenticatedFallback = null,
  unauthorizedFallback = null,
  onRedirect,
}) => {
  const { user, loading, initialized, hasRole } = useAuth();

  // Still initializing
  if (!initialized || loading) {
    return <>{loadingFallback}</>;
  }

  // Not authenticated
  if (!user) {
    onRedirect?.('unauthenticated');
    return <>{unauthenticatedFallback}</>;
  }

  // Check role-based access
  if (requiredRoles && requiredRoles.length > 0 && !hasRole(requiredRoles)) {
    onRedirect?.('unauthorized');
    return <>{unauthorizedFallback}</>;
  }

  return <>{children}</>;
};

// =============================================================================
// ROLE-BASED COMPONENT WRAPPER
// =============================================================================

export interface RoleGuardProps {
  children: ReactNode;
  /** Required roles */
  roles: UserRole[];
  /** Fallback when user doesn't have required role */
  fallback?: ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  roles,
  fallback = null,
}) => {
  const { hasRole, user } = useAuth();

  if (!user || !hasRole(roles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

// =============================================================================
// EXPORTS
// =============================================================================

export { AuthContext };
