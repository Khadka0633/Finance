// Firestore Security Rules tests, run against the LOCAL EMULATOR ONLY.
//
// This sandbox cannot reach Google's emulator download servers, so these
// tests are not run automatically as part of this build. Run them
// yourself before deploying real rules:
//
//   npm install -D @firebase/rules-unit-testing
//   firebase emulators:exec --only firestore "npx vitest run firestore.rules.test.js"
//
// Each test asserts the access-control decisions the app depends on:
// a user can only read/write their own data, and only well-shaped data.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { doc, setDoc, getDoc, collection } from 'firebase/firestore'

let testEnv

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'finance-tracker-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

afterAll(async () => {
  await testEnv?.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

describe('user data isolation', () => {
  it('lets a user read their own account doc', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    const ref = doc(alice, 'users/alice/accounts/acc1')
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice/accounts/acc1'), {
        name: 'Cash', type: 'cash', archived: false,
      })
    })
    await assertSucceeds(getDoc(ref))
  })

  it('blocks a user from reading another user\'s account doc', async () => {
    const bob = testEnv.authenticatedContext('bob').firestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice/accounts/acc1'), {
        name: 'Cash', type: 'cash', archived: false,
      })
    })
    const ref = doc(bob, 'users/alice/accounts/acc1')
    await assertFails(getDoc(ref))
  })

  it('blocks an unauthenticated read entirely', async () => {
    const anon = testEnv.unauthenticatedContext().firestore()
    const ref = doc(anon, 'users/alice/accounts/acc1')
    await assertFails(getDoc(ref))
  })
})

describe('transaction shape validation', () => {
  it('accepts a well-formed transaction', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    const ref = doc(alice, 'users/alice/transactions/t1')
    await assertSucceeds(setDoc(ref, {
      amount: 1050,
      type: 'expense',
      accountId: 'acc1',
      localDate: '2026-07-22',
      category: 'Food',
    }))
  })

  it('rejects a negative amount', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    const ref = doc(alice, 'users/alice/transactions/t2')
    await assertFails(setDoc(ref, {
      amount: -500,
      type: 'expense',
      accountId: 'acc1',
      localDate: '2026-07-22',
    }))
  })

  it('rejects a float amount (must be integer cents)', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    const ref = doc(alice, 'users/alice/transactions/t3')
    await assertFails(setDoc(ref, {
      amount: 10.5,
      type: 'expense',
      accountId: 'acc1',
      localDate: '2026-07-22',
    }))
  })

  it('rejects an invalid type value', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    const ref = doc(alice, 'users/alice/transactions/t4')
    await assertFails(setDoc(ref, {
      amount: 500,
      type: 'not_a_real_type',
      accountId: 'acc1',
      localDate: '2026-07-22',
    }))
  })

  it('rejects a malformed localDate string', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore()
    const ref = doc(alice, 'users/alice/transactions/t5')
    await assertFails(setDoc(ref, {
      amount: 500,
      type: 'expense',
      accountId: 'acc1',
      localDate: 'not-a-date',
    }))
  })
})
