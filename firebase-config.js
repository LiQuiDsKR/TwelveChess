// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, update, onValue, get, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBX9DiHUQfmmZaImMJRH_CjiTeHv8ORgZk",
  authDomain: "twelvechess-f1969.firebaseapp.com",
  databaseURL: "https://twelvechess-f1969-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "twelvechess-f1969",
  storageBucket: "twelvechess-f1969.firebasestorage.app",
  messagingSenderId: "215463707619",
  appId: "1:215463707619:web:0da871ee26f492593896d6",
  measurementId: "G-K31EL99M2L"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, update, onValue, get, remove };
