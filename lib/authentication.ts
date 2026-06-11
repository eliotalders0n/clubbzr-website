/**
 * Firebase Authentication
 * Club BZR - Experimental Art Community
 *
 * Authentication functions and utilities
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile as firebaseUpdateProfile,
  updateEmail,
  updatePassword,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  User as FirebaseUser,
  UserCredential,
  onAuthStateChanged,
  Unsubscribe,
  AuthError,
  linkWithPopup,
  fetchSignInMethodsForEmail,
} from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

import { auth, db, COLLECTIONS } from './config';
import type { User, UserRole, UserPreferences } from './schema';

// =============================================================================
// TYPES
// =============================================================================

export interface AuthUser extends FirebaseUser {
  role?: UserRole;
}

export interface SignUpData {
  email: string;
  password: string;
  displayName: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface UpdateProfileData {
  displayName?: string;
  photoURL?: string;
  bio?: string;
  location?: string;
  website?: string;
}

export interface AuthResult {
  success: boolean;
  user?: FirebaseUser;
  error?: AuthErrorInfo;
}

export interface AuthErrorInfo {
  code: string;
  message: string;
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

/** Map Firebase error codes to user-friendly messages */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled.',
  'auth/weak-password': 'Please choose a stronger password (at least 6 characters).',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/invalid-credential': 'Invalid credentials. Please check your email and password.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/popup-closed-by-user': 'Sign-in popup was closed before completion.',
  'auth/network-request-failed': 'Network error. Please check your connection.',
  'auth/requires-recent-login': 'Please sign in again to complete this action.',
  'auth/account-exists-with-different-credential':
    'An account already exists with the same email but different sign-in credentials.',
};

/** Parse Firebase auth error into user-friendly format */
const parseAuthError = (error: unknown): AuthErrorInfo => {
  const authError = error as AuthError;
  const code = authError?.code || 'auth/unknown';
  const message = AUTH_ERROR_MESSAGES[code] || authError?.message || 'An unexpected error occurred.';

  return { code, message };
};

// =============================================================================
// USER DOCUMENT OPERATIONS
// =============================================================================

/** Default user preferences */
const DEFAULT_PREFERENCES: UserPreferences = {
  emailNotifications: true,
  pushNotifications: true,
  questReminders: true,
  eventReminders: true,
  communityDigest: 'weekly',
  theme: 'system',
};

/** Create user document in Firestore after authentication */
const createUserDocument = async (
  firebaseUser: FirebaseUser,
  additionalData: Partial<User> = {}
): Promise<User> => {
  const userRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);

  const userData: Omit<User, 'id'> = {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || additionalData.displayName || '',
    photoURL: firebaseUser.photoURL || null,
    role: 'user',
    isOnboarded: false,
    isActive: true,
    preferences: DEFAULT_PREFERENCES,
    createdAt: serverTimestamp(),
    ...additionalData,
  };

  await setDoc(userRef, userData);

  return {
    id: firebaseUser.uid,
    ...userData,
  } as User;
};

/** Get user document from Firestore */
export const getUserDocument = async (uid: string): Promise<User | null> => {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return { id: userSnap.id, ...userSnap.data() } as User;
  }

  return null;
};

/** Check if user document exists */
const userDocumentExists = async (uid: string): Promise<boolean> => {
  const userDoc = await getUserDocument(uid);
  return userDoc !== null;
};

// =============================================================================
// GOOGLE AUTHENTICATION
// =============================================================================

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Sign in with Google
 * Creates user document if first-time user
 */
export const signInWithGoogle = async (): Promise<AuthResult> => {
  try {
    const result: UserCredential = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Check if user document exists, create if not
    const exists = await userDocumentExists(user.uid);
    if (!exists) {
      await createUserDocument(user);
    }

    return { success: true, user };
  } catch (error) {
    return { success: false, error: parseAuthError(error) };
  }
};

/**
 * Link Google account to existing user
 */
export const linkGoogleAccount = async (): Promise<AuthResult> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, error: { code: 'auth/no-user', message: 'No user is currently signed in.' } };
    }

    const result = await linkWithPopup(currentUser, googleProvider);
    return { success: true, user: result.user };
  } catch (error) {
    return { success: false, error: parseAuthError(error) };
  }
};

// =============================================================================
// EMAIL/PASSWORD AUTHENTICATION
// =============================================================================

/**
 * Sign up with email and password
 * Creates user document automatically
 */
export const signUpWithEmail = async (data: SignUpData): Promise<AuthResult> => {
  try {
    const { email, password, displayName } = data;

    // Create Firebase auth user
    const result: UserCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;

    // Update display name in Firebase auth
    await firebaseUpdateProfile(user, { displayName });

    // Create user document in Firestore
    await createUserDocument(user, { displayName });

    // Send email verification
    await sendEmailVerification(user);

    return { success: true, user };
  } catch (error) {
    return { success: false, error: parseAuthError(error) };
  }
};

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (data: SignInData): Promise<AuthResult> => {
  try {
    const { email, password } = data;
    const result: UserCredential = await signInWithEmailAndPassword(auth, email, password);

    return { success: true, user: result.user };
  } catch (error) {
    return { success: false, error: parseAuthError(error) };
  }
};

/**
 * Send password reset email
 */
export const resetPassword = async (email: string): Promise<AuthResult> => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    return { success: false, error: parseAuthError(error) };
  }
};

/**
 * Resend email verification
 */
export const resendEmailVerification = async (): Promise<AuthResult> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: { code: 'auth/no-user', message: 'No user is currently signed in.' } };
    }

    await sendEmailVerification(user);
    return { success: true };
  } catch (error) {
    return { success: false, error: parseAuthError(error) };
  }
};

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

/**
 * Sign out current user
 */
export const signOut = async (): Promise<AuthResult> => {
  try {
    await firebaseSignOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: parseAuthError(error) };
  }
};

/**
 * Get current user
 */
export const getCurrentUser = (): FirebaseUser | null => {
  return auth.currentUser;
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return auth.currentUser !== null;
};

/**
 * Subscribe to auth state changes
 */
export const onAuthStateChange = (
  callback: (user: FirebaseUser | null) => void
): Unsubscribe => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Get sign-in methods for email
 */
export const getSignInMethodsForEmail = async (email: string): Promise<string[]> => {
  try {
    return await fetchSignInMethodsForEmail(auth, email);
  } catch {
    return [];
  }
};

// =============================================================================
// PROFILE UPDATES
// =============================================================================

/**
 * Update user profile (Firebase auth and Firestore)
 */
export const updateProfile = async (data: UpdateProfileData): Promise<AuthResult> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: { code: 'auth/no-user', message: 'No user is currently signed in.' } };
    }

    // Update Firebase auth profile
    const authUpdates: { displayName?: string; photoURL?: string } = {};
    if (data.displayName) authUpdates.displayName = data.displayName;
    if (data.photoURL) authUpdates.photoURL = data.photoURL;

    if (Object.keys(authUpdates).length > 0) {
      await firebaseUpdateProfile(user, authUpdates);
    }

    // Update Firestore document
    const userRef = doc(db, COLLECTIONS.USERS, user.uid);
    await setDoc(
      userRef,
      {
        ...data,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return { success: true, user };
  } catch (error) {
    return { success: false, error: parseAuthError(error) };
  }
};

/**
 * Update user email (requires recent login)
 */
export const updateUserEmail = async (newEmail: string): Promise<AuthResult> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: { code: 'auth/no-user', message: 'No user is currently signed in.' } };
    }

    await updateEmail(user, newEmail);

    // Update Firestore document
    const userRef = doc(db, COLLECTIONS.USERS, user.uid);
    await setDoc(
      userRef,
      {
        email: newEmail,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return { success: true, user };
  } catch (error) {
    return { success: false, error: parseAuthError(error) };
  }
};

/**
 * Update user password (requires recent login)
 */
export const updateUserPassword = async (newPassword: string): Promise<AuthResult> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: { code: 'auth/no-user', message: 'No user is currently signed in.' } };
    }

    await updatePassword(user, newPassword);
    return { success: true, user };
  } catch (error) {
    return { success: false, error: parseAuthError(error) };
  }
};

/**
 * Reauthenticate user with email/password
 */
export const reauthenticate = async (password: string): Promise<AuthResult> => {
  try {
    const user = auth.currentUser;
    if (!user || !user.email) {
      return { success: false, error: { code: 'auth/no-user', message: 'No user is currently signed in.' } };
    }

    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);

    return { success: true, user };
  } catch (error) {
    return { success: false, error: parseAuthError(error) };
  }
};

// =============================================================================
// ACCOUNT DELETION
// =============================================================================

/**
 * Delete user account (Firebase auth and Firestore document)
 * Requires recent authentication
 */
export const deleteAccount = async (): Promise<AuthResult> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: { code: 'auth/no-user', message: 'No user is currently signed in.' } };
    }

    // Delete Firestore user document
    const userRef = doc(db, COLLECTIONS.USERS, user.uid);
    await deleteDoc(userRef);

    // Delete Firebase auth account
    await deleteUser(user);

    return { success: true };
  } catch (error) {
    return { success: false, error: parseAuthError(error) };
  }
};

// =============================================================================
// ROLE MANAGEMENT
// =============================================================================

/**
 * Get user role from Firestore
 */
export const getUserRole = async (uid: string): Promise<UserRole | null> => {
  const userDoc = await getUserDocument(uid);
  return userDoc?.role || null;
};

/**
 * Check if user has required role
 */
export const hasRole = async (uid: string, requiredRoles: UserRole[]): Promise<boolean> => {
  const userRole = await getUserRole(uid);
  if (!userRole) return false;

  // Admin has access to everything
  if (userRole === 'admin') return true;

  return requiredRoles.includes(userRole);
};

/**
 * Update user role (admin only operation)
 */
export const updateUserRole = async (uid: string, newRole: UserRole): Promise<AuthResult> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    await setDoc(
      userRef,
      {
        role: newRole,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return { success: true };
  } catch (error) {
    return { success: false, error: parseAuthError(error) };
  }
};

// =============================================================================
// EXPORTS
// =============================================================================

export { auth };
