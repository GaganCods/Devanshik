// ============================================================
//  DEVANSHIK — Firebase & ImgBB Configuration
// ============================================================

// 🔥 Firebase project config (devanshik-shop)
const firebaseConfig = {
  apiKey: "AIzaSyCn5bwrjG-pkHEBHoDby6A-DfNJiDiHOxA",
  authDomain: "devanshik-shop.firebaseapp.com",
  databaseURL: "https://devanshik-shop-default-rtdb.firebaseio.com",
  projectId: "devanshik-shop",
  storageBucket: "devanshik-shop.firebasestorage.app",
  messagingSenderId: "493972505969",
  appId: "1:493972505969:web:2733bba576af065d0d62d0",
  measurementId: "G-7DKNMV8EX9"
};

// 🖼️ ImgBB free image hosting key
//    Get yours → https://api.imgbb.com/
const IMGBB_API_KEY = "9e3132d2ec5742c46cdf944a6a1c5daa";

// ─── Init ────────────────────────────────────────────────────
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();
const storage = firebase.storage();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Enable offline caching (persistence)
try {
  firebase.database().ref().keepSynced(true);
} catch (e) {
  console.log("Persistence info:", e.message);
}
