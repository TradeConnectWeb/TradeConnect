// src/firebase.js
import { initializeApp } from "firebase/app";

export async function getFirebaseApp() {
  const response = await fetch("/firebase-config");
  const config = await response.json();
  const app = initializeApp(config);
  return app;
}
