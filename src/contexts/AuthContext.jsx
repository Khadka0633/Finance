import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import { collection, query, limit, getDocs } from 'firebase/firestore'
import { auth, googleProvider, db } from '../lib/firebase'
import { addAccount } from '../services/accounts'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fires from the local cache immediately if offline, so the app
    // never hangs waiting for a network round trip to know who's signed in.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function signup(email, password) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await addAccount(cred.user.uid, { name: 'Cash', type: 'cash' })
    return cred.user
  }

  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return cred.user
  }

  async function loginWithGoogle() {
    try {
      const cred = await signInWithPopup(auth, googleProvider)
      await ensureDefaultAccount(cred.user.uid)
      return cred.user
    } catch (err) {
      // Popup blockers and in-app browsers (Instagram/Facebook webviews)
      // often break signInWithPopup — fall back to a full-page redirect.
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, googleProvider)
        return null
      }
      throw err
    }
  }

  async function ensureDefaultAccount(uid) {
    const q = query(collection(db, 'users', uid, 'accounts'), limit(1))
    const existing = await getDocs(q)
    if (existing.empty) {
      await addAccount(uid, { name: 'Cash', type: 'cash' })
    }
  }

  async function logout() {
    return signOut(auth)
  }

  const value = { currentUser, loading, signup, login, loginWithGoogle, logout }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
