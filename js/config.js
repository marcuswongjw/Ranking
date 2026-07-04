// Initialize Firebase client configuration
const firebaseConfig = {
  apiKey: "AIzaSyAVRW-zObUX1H7dx84MCsO8YN0bGJ2w9vw",
  authDomain: "opti-ranking.firebaseapp.com",
  projectId: "opti-ranking",
  storageBucket: "opti-ranking.firebasestorage.app",
  messagingSenderId: "777147150283",
  appId: "1:777147150283:web:9648d19657d4cdaaac904e",
  measurementId: "G-4GSYE7EX8Y"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// App Constants & Configuration Defaults
const ADMIN_EMAIL = 'marcuswongjw@gmail.com';

// These default values are mutable and synced dynamically with Cloud Firestore settings
const COMP_YEAR = new Date().getFullYear();
const DNS = 84;
