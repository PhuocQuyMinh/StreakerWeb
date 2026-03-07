// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA4gn3yVUMcv4kpEu5-l7jMorMBY0ivztc",
  authDomain: "streaker-789fd.firebaseapp.com",
  projectId: "streaker-789fd",
  storageBucket: "streaker-789fd.firebasestorage.app",
  messagingSenderId: "322485438285",
  appId: "1:322485438285:web:7459d8bf455f9590551904",
  measurementId: "G-EF801SV1NX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);