// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyAkOsv_DY6tLBJea35_4Gvb3oIuoy8rxEw",
    authDomain: "muhasebe-86f40.firebaseapp.com",
    projectId: "muhasebe-86f40",
    storageBucket: "muhasebe-86f40.firebasestorage.app",
    messagingSenderId: "379353988754",
    appId: "1:379353988754:web:72aea576e8775b84aff04b",
    measurementId: "G-ECSY3S9DK0"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Services
const auth = firebase.auth();
const db = firebase.firestore();

// Global değişken olarak erişilebilir olsun (Debugging ve diğer dosyalar için)
window.auth = auth;
window.db = db;
