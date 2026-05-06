import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Ganti nilai di dalam objek firebaseConfig ini dengan konfigurasi asli milik KPP Bapak!
const firebaseConfig = {
  apiKey: "AIzaSyDvSAiFoTeWOLwhkSXwJgl-vJASfs3UfQw",
  authDomain: "remindersuki-095.firebaseapp.com",
  projectId: "remindersuki-095",
  storageBucket: "remindersuki-095.firebasestorage.app",
  messagingSenderId: "277543932067",
  appId: "1:277543932067:web:170ed9b5cea8c55cd22f16",
  measurementId: "G-0PHDJF2VDL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
