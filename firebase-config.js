// Firebase-Zugang für das Schmerztagebuch (Projekt „schmerztagebuch“, Firestore in Europa).
// Diese Werte sind KEIN Geheimnis: Sie stehen bei jeder Web-App öffentlich im Code.
// Geschützt werden die Daten ausschließlich über die Sicherheitsregeln (firestore.rules).
export const firebaseConfig = {
  apiKey: "AIzaSyD3ieZa8QXTrNcnQtuBOBgNGeY_ak_6PWo",
  authDomain: "schmerztagebuch-3f45b.firebaseapp.com",
  projectId: "schmerztagebuch-3f45b",
  storageBucket: "schmerztagebuch-3f45b.firebasestorage.app",
  messagingSenderId: "583379815304",
  appId: "1:583379815304:web:f5ca6a7b37dd8bdd7ec83d"
};

// Unter diesem Namen liegt das Tagebuch in Firestore: diaries/<DIARY_ID>/days/<JJJJ-MM-TT>
export const DIARY_ID = "mirko";
