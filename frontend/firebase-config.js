/**
 * Firebase configuration and Realtime Database setup.
 * Replace placeholder values with your Firebase project credentials.
 */

const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

/** Root path for all sprinkler data in Realtime Database */
const DB_PATHS = {
  ROOT: "sprinkler",
  MOISTURE: "sprinkler/moisture",
  PUMP: "sprinkler/pump",
  MODE: "sprinkler/mode",
};

/** Allowed values for pump and mode fields */
const SYSTEM_VALUES = {
  PUMP: {
    ON: "ON",
    OFF: "OFF",
  },
  MODE: {
    AUTO: "AUTO",
    MANUAL: "MANUAL",
  },
};

let database = null;

/**
 * Initializes Firebase and returns the Realtime Database reference.
 * @returns {firebase.database.Database | null}
 */
function initFirebase() {
  if (typeof firebase === "undefined") {
    console.error("Firebase SDK not loaded. Add the Firebase scripts to index.html.");
    return null;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }

  database = firebase.database();
  return database;
}

/**
 * Returns the initialized database instance.
 * @returns {firebase.database.Database | null}
 */
function getDatabase() {
  return database;
}
