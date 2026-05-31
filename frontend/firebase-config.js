import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyC0039OXDbhmjGZgxrKY2uKKqarn2KSOvE",
  authDomain: "smartsprinkleriot-d2e5c.firebaseapp.com",
  databaseURL: "https://smartsprinkleriot-d2e5c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "smartsprinkleriot-d2e5c",
  storageBucket: "smartsprinkleriot-d2e5c.firebasestorage.app",
  messagingSenderId: "983649039756",
  appId: "1:983649039756:web:7cbd124b6b8efa744652a9"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database };