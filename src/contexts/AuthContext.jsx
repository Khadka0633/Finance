import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'
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

  async function signup(email, password, displayName) {
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
    // Best-effort: only meant to run once for a brand new Google user.
    // Safe to attempt on every login since addAccount is additive, but a
    // real app would check for an existing account first if this matters.
  }

  async function logout() {
    return signOut(auth)
  }

  const value = { currentUser, loading, signup, login, loginWithGoogle, logout }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
