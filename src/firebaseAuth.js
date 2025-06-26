// src/firebaseAuth.js
import { getFirebaseApp } from './firebase'; // kung meron kang firebase.js na nag-iinitialize ng Firebase app
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

let auth;

async function initAuth() {
  if (!auth) {
    const app = await getFirebaseApp();
    auth = getAuth(app);
  }
  return auth;
}

export async function login(email, password) {
  const auth = await initAuth();
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signup(email, password) {
  const auth = await initAuth();
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  const auth = await initAuth();
  return signOut(auth);
}
