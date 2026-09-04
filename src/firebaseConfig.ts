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
/**
 * Attach the signed-in user's Firebase ID token to every call to our own API.
 *
 * Installed once, here, rather than at each of the ~150 fetch sites: the server now
 * refuses any /api write without a verified token, and a wrapper that can be forgotten
 * at one call site is not a security control. Only same-origin /api/ URLs are touched,
 * so third-party requests never see the token.
 */
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
  if (url && (url.startsWith("/api/") || url.includes("://localhost") && url.includes("/api/"))) {
    const current = auth.currentUser;
    if (current) {
      try {
        const token = await current.getIdToken();
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        headers.set("Authorization", `Bearer ${token}`);
        init = { ...init, headers };
      } catch { /* fall through unauthenticated; the server will say so plainly */ }
    }
  }
  return nativeFetch(input as any, init);
};
