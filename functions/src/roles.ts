import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isRole, requireRole, type Role } from './authz'
import { adminAuth, db } from './firebase'

async function writeRole(uid: string, role: Role): Promise<void> {
  const user = await adminAuth.getUser(uid)
  await adminAuth.setCustomUserClaims(uid, { ...user.customClaims, role })
  await db.collection('employees').doc(uid).set({
    uid,
    email: user.email ?? '',
    role,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
}

export const claimInitialAdmin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.')
  }

  const uid = request.auth.uid
  const bootstrap = db.doc('meta/bootstrap')

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(bootstrap)
    const existingAdmin = snapshot.data()?.adminUid
    if (existingAdmin && existingAdmin !== uid) {
      throw new HttpsError('permission-denied', 'This organization already has an admin.')
    }
    if (!existingAdmin) {
      transaction.set(bootstrap, {
        adminUid: uid,
        createdAt: FieldValue.serverTimestamp(),
      })
    }
  })

  await writeRole(uid, 'admin')
  return { role: 'admin' as const }
})

export const setEmployeeRole = onCall(async (request) => {
  const caller = requireRole(request, ['admin'])
  const uid = request.data?.uid
  const role = request.data?.role

  if (typeof uid !== 'string' || !isRole(role)) {
    throw new HttpsError('invalid-argument', 'Provide an employee id and a valid role.')
  }

  if (caller.uid === uid && role !== 'admin') {
    const admins = await db.collection('employees').where('role', '==', 'admin').get()
    const otherAdmin = admins.docs.some((employee) => employee.id !== uid)
    if (!otherAdmin) {
      throw new HttpsError('failed-precondition', 'The organization needs at least one admin.')
    }
  }

  await writeRole(uid, role)
  return { uid, role }
})
