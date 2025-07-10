// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCxaOGeOvHwS5dnPHRTpw3Lwn2surjXP1E",
  authDomain: "tradeconnect-3c728.firebaseapp.com",
  projectId: "tradeconnect-3c728",
  storageBucket: "tradeconnect-3c728.appspot.com",
  messagingSenderId: "299665603548",
  appId: "1:299665603548:web:9ff10af44cd41605382d19",
  databaseURL: "https://tradeconnect-3c728-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Enable offline persistence (optional)
enableIndexedDbPersistence(db).catch((err) => {
  console.warn("Firestore offline persistence failed:", err.code);
});

export { app, auth, db, storage };
