import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

/**
 * Must match ESP32 FIREBASE_HOST in SmartSprinklerIoT/config.h:
 * sistemzalivanje-default-rtdb.europe-west1.firebasedatabase.app
 */
const firebaseConfig = {
  apiKey: "AIzaSyC0039OXDbhmjGZgxrKY2uKKqarn2KSOvE",
  authDomain: "sistemzalivanje.firebaseapp.com",
  databaseURL: "https://sistemzalivanje-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "sistemzalivanje",
  storageBucket: "sistemzalivanje.firebasestorage.app",
  messagingSenderId: "983649039756",
  appId: "1:983649039756:web:7cbd124b6b8efa744652a9",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app, firebaseConfig.databaseURL);

export { database };
