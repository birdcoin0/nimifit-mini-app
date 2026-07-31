import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDdVEt1xRoTX8q0V9wFlvdwts0xg6FjbEI",
  authDomain: "nimifit.firebaseapp.com",
  projectId: "nimifit",
  storageBucket: "nimifit.firebasestorage.app",
  messagingSenderId: "683519544082",
  appId: "1:683519544082:web:d48bec148ad1e511b2c1cb",
  measurementId: "G-9W5ZEDFZTZ",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
<<<<<<< HEAD
export const functions = getFunctions(app, "us-central1");
=======
export const functions = getFunctions(app, "us-central1");
>>>>>>> 4b28bce01523a6bf9e46fa66c3da679c9f094068
