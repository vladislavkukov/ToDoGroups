import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB1-vQF6yZbpQbTOp8A5YuMClpg1tPwnvg",
  authDomain: "number1-53561.firebaseapp.com",
  projectId: "number1-53561",
  storageBucket: "number1-53561.firebasestorage.app",
  messagingSenderId: "648133133594",
  appId: "1:648133133594:web:ea272386307d51272e18a3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore(app);

export {app, auth, db};
