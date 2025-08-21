const firebaseConfig = {
  apiKey: "AIzaSyDmju8_NR91g2OM3G9qPIiRjhxHl51tVeI",
  authDomain: "chaoyouhome-8ff96.firebaseapp.com",
  projectId: "chaoyouhome-8ff96",
  storageBucket: "chaoyouhome-8ff96.firebasestorage.app",
  messagingSenderId: "405567397340",
  appId: "1:405567397340:web:984083a7abfddcca58c319"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();