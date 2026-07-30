import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyCNOhexv7Jrnkf3mvvQOn8h1vn2oT9Isr0",
    authDomain: "anahon-financial.firebaseapp.com",
    projectId: "anahon-financial",
    storageBucket: "anahon-financial.firebasestorage.app",
    messagingSenderId: "5528059691",
    appId: "1:5528059691:web:556ead3dc398cd407ecf6e",
    measurementId: "G-MQ3NF2DT8M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);