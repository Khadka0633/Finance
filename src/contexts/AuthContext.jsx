import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  EmailAuthProvider,
  linkWithCredential,
  linkWithPopup,
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
  // Set when a Google sign-in collides with an existing password account for
  // the same email — holds what's needed to finish linking them once the
  // person proves ownership of the existing account.
  const [pendingLink, setPendingLink] = useState(null) // { email, credential } | null

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
    try {
      await sendEmailVerification(cred.user)
    } catch {
      // Non-fatal — the account still works, and they can resend later
      // from the verification banner.
    }
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
      // This email already has a password account — instead of a dead-end
      // error, capture what's needed to link Google onto that account and
      // let the UI prompt for the existing password.
      if (err.code === 'auth/account-exists-with-different-credential') {
        const email = err.customData?.email
        const credential = GoogleAuthProvider.credentialFromError(err)
        const methods = email ? await fetchSignInMethodsForEmail(auth, email) : []
        if (email && credential && methods.includes('password')) {
          setPendingLink({ email, credential })
          return null
        }
      }
      throw err
    }
  }

  /** Finishes linking a pending Google credential onto the existing
   * password account, by first signing in with that password. */
  async function resolveLinkWithPassword(password) {
    if (!pendingLink) throw new Error('Nothing to link.')
    const userCred = await signInWithEmailAndPassword(auth, pendingLink.email, password)
    await linkWithCredential(userCred.user, pendingLink.credential)
    setPendingLink(null)
    return userCred.user
  }

  function cancelPendingLink() {
    setPendingLink(null)
  }

  /** Deliberately add Google sign-in to the currently logged-in account
   * (as opposed to the automatic conflict-recovery path above). */
  async function linkGoogleToAccount() {
    return linkWithPopup(auth.currentUser, googleProvider)
  }

  /** Deliberately add password sign-in to the currently logged-in account. */
  async function linkPasswordToAccount(password) {
    const credential = EmailAuthProvider.credential(auth.currentUser.email, password)
    return linkWithCredential(auth.currentUser, credential)
  }

  async function resendVerificationEmail() {
    if (auth.currentUser) await sendEmailVerification(auth.currentUser)
  }

  /** Sends a "reset your password" email for someone who forgot theirs and
   * isn't signed in (as opposed to linkPasswordToAccount, which sets a
   * password for an already-authenticated user). */
  async function resetPassword(email) {
    return sendPasswordResetEmail(auth, email)
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

  const value = {
    currentUser,
    loading,
    signup,
    login,
    loginWithGoogle,
    logout,
    pendingLink,
    resolveLinkWithPassword,
    cancelPendingLink,
    linkGoogleToAccount,
    linkPasswordToAccount,
    resendVerificationEmail,
    resetPassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
