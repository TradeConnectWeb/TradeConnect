// js/modules/auth.js - Ultimate Authentication Module

import { 
  auth, 
  db,
  analytics,
  showToast,
  logEvent 
} from '../main.js';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  deleteUser,
  onAuthStateChanged,
  updateProfile
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

// User roles constants
const USER_ROLES = {
  BASIC: 'basic',
  ADMIN: 'admin',
  MODERATOR: 'moderator'
};

// Auth event types
const AUTH_EVENTS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  SIGNUP: 'signup',
  VERIFICATION_SENT: 'verification_sent',
  PASSWORD_RESET_SENT: 'password_reset_sent',
  ACCOUNT_DELETED: 'account_deleted',
  PROFILE_UPDATED: 'profile_updated'
};

// Initialize auth state listener
let currentUser = null;
let userProfile = null;

/**
 * Initializes authentication module
 */
export function init() {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    
    if (user) {
      // Load additional user profile data
      userProfile = await loadUserProfile(user.uid);
      logEvent(AUTH_EVENTS.LOGIN, { 
        method: 'email',
        email_verified: user.emailVerified 
      });
    } else {
      userProfile = null;
      logEvent(AUTH_EVENTS.LOGOUT);
    }
  });
}

/**
 * Creates new user account with complete profile
 * @param {string} email 
 * @param {string} password 
 * @param {Object} profile Complete user profile data
 * @returns {Promise<User>}
 */
export async function signupUser(email, password, profile) {
  try {
    // 1. Create auth account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Update auth profile
    await updateProfile(user, {
      displayName: profile.displayName,
      photoURL: profile.photoURL || null
    });

    // 3. Save complete profile to Firestore
    await setDoc(doc(db, "users", user.uid), {
      ...profile,
      emailVerified: false,
      role: USER_ROLES.BASIC,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      loginCount: 0
    });

    // 4. Send verification email
    await sendEmailVerification(user);
    logEvent(AUTH_EVENTS.VERIFICATION_SENT);

    // 5. Analytics and UI feedback
    logEvent(AUTH_EVENTS.SIGNUP, {
      method: 'email',
      role: USER_ROLES.BASIC
    });
    
    showToast('Account created! Please check your email for verification.', 'success');
    
    return user;
  } catch (error) {
    const errorMsg = getAuthErrorMessage(error.code);
    showToast(errorMsg, 'error');
    throw new Error(errorMsg);
  }
}

/**
 * Logs in user with email/password
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<boolean>}
 */
export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Update last login stats
    await updateLoginStats(user.uid);
    
    // Check if email is verified
    if (!user.emailVerified) {
      showToast('Please verify your email address', 'warning');
    }

    logEvent(AUTH_EVENTS.LOGIN, {
      method: 'email',
      email_verified: user.emailVerified
    });
    
    showToast('Login successful!', 'success');
    return true;
  } catch (error) {
    const errorMsg = getAuthErrorMessage(error.code);
    showToast(errorMsg, 'error', 5000);
    return false;
  }
}

/**
 * Logs out current user
 */
export async function logoutUser() {
  try {
    await signOut(auth);
    logEvent(AUTH_EVENTS.LOGOUT);
    showToast('Logged out successfully', 'info');
  } catch (error) {
    showToast('Logout failed. Please try again.', 'error');
    throw error;
  }
}

/**
 * Deletes user account and all associated data
 */
export async function deleteUserAccount() {
  try {
    if (!currentUser) throw new Error('No user logged in');
    
    // Additional cleanup can be added here
    await deleteUser(currentUser);
    
    logEvent(AUTH_EVENTS.ACCOUNT_DELETED);
    showToast('Account deleted successfully', 'info');
  } catch (error) {
    showToast('Account deletion failed: ' + getAuthErrorMessage(error.code), 'error');
    throw error;
  }
}

/**
 * Sends password reset email
 * @param {string} email 
 */
export async function sendResetPasswordEmail(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    logEvent(AUTH_EVENTS.PASSWORD_RESET_SENT);
    showToast('Password reset email sent. Check your inbox.', 'info');
  } catch (error) {
    showToast(getAuthErrorMessage(error.code), 'error');
  }
}

/**
 * Resends verification email
 */
export async function resendVerificationEmail() {
  try {
    if (!currentUser) throw new Error('No user logged in');
    await sendEmailVerification(currentUser);
    logEvent(AUTH_EVENTS.VERIFICATION_SENT);
    showToast('Verification email resent', 'info');
  } catch (error) {
    showToast('Failed to resend verification: ' + getAuthErrorMessage(error.code), 'error');
  }
}

// Helper Functions

async function loadUserProfile(uid) {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}

async function updateLoginStats(uid) {
  const userRef = doc(db, "users", uid);
  await setDoc(userRef, {
    lastLogin: new Date().toISOString(),
    loginCount: firebase.firestore.FieldValue.increment(1)
  }, { merge: true });
}

function getAuthErrorMessage(code) {
  const messages = {
    // Authentication errors
    'auth/invalid-email': 'Invalid email address',
    'auth/user-disabled': 'Account disabled',
    'auth/user-not-found': 'Account not found',
    'auth/wrong-password': 'Incorrect password',
    'auth/email-already-in-use': 'Email already in use',
    'auth/weak-password': 'Password must be at least 6 characters',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    
    // Account verification
    'auth/requires-recent-login': 'Please login again to perform this action',
    
    // Network errors
    'auth/network-request-failed': 'Network error. Please check your connection.'
  };
  
  return messages[code] || 'Authentication failed. Please try again.';
}

// Module exports
export default {
  init,
  signupUser,
  loginUser,
  logoutUser,
  deleteUserAccount,
  sendResetPasswordEmail,
  resendVerificationEmail,
  
  // Getters
  get currentUser() {
    return currentUser;
  },
  
  get userProfile() {
    return userProfile;
  },
  
  get isAuthenticated() {
    return !!currentUser;
  },
  
  get isAdmin() {
    return userProfile?.role === USER_ROLES.ADMIN;
  },
  
  get isVerified() {
    return currentUser?.emailVerified || false;
  }
};