import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// 👉 ใส่ค่า config จาก Firebase console ของครู
const firebaseConfig = {
 apiKey: "AIzaSyAZDEq9KC4WnaYMWSJOrBw3iwbnsewGiiM",
  authDomain: "nutrition-find.firebaseapp.com",
  projectId: "nutrition-find",
  storageBucket: "nutrition-find.firebasestorage.app",
  messagingSenderId: "932843302530",
  appId: "1:932843302530:web:a50fd394bd0546a8a00e9b",
  measurementId: "G-BEP2XS15CS"',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

export default app
