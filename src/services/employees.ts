import type { User } from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { getServices, isLocalPreview } from '../lib/firebase'
import { localEmployee, localEmployees, localUpdateEmployee } from '../local/memory'
import type { Employee, Role } from '../types/domain'
import { parseRole } from '../auth/access'

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null
}

function toEmployee(id: string, data: Record<string, unknown>): Employee {
  return {
    uid: id,
    email: String(data.email ?? ''),
    displayName: String(data.displayName ?? ''),
    title: String(data.title ?? ''),
    department: String(data.department ?? ''),
    role: parseRole(data.role) ?? 'viewer',
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

export async function getEmployee(uid: string): Promise<Employee | null> {
  if (isLocalPreview()) return localEmployee(uid)
  const snapshot = await getDoc(doc(getServices().db, 'employees', uid))
  if (!snapshot.exists()) return null
  return toEmployee(snapshot.id, snapshot.data())
}

export async function listEmployees(): Promise<Employee[]> {
  if (isLocalPreview()) return localEmployees()
  const snapshot = await getDocs(collection(getServices().db, 'employees'))
  return snapshot.docs
    .map((item) => toEmployee(item.id, item.data()))
    .sort((a, b) => a.email.localeCompare(b.email))
}

export async function ensureEmployeeProfile(user: User): Promise<Employee> {
  const existing = await getEmployee(user.uid)
  if (existing) return existing
  if (!user.email) {
    throw new Error('Your account needs an email address before a profile can be created.')
  }

  const profile = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName?.trim() || user.email.split('@')[0] || 'Employee',
    title: '',
    department: '',
    role: 'viewer' as Role,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  await setDoc(doc(getServices().db, 'employees', user.uid), profile)
  const created = await getEmployee(user.uid)
  if (!created) throw new Error('Your profile was saved but could not be read back.')
  return created
}

export async function updateEmployeeProfile(
  uid: string,
  input: { displayName: string; title: string; department: string },
): Promise<void> {
  if (isLocalPreview()) {
    localUpdateEmployee(uid, input)
    return
  }
  await updateDoc(doc(getServices().db, 'employees', uid), {
    displayName: input.displayName.trim(),
    title: input.title.trim(),
    department: input.department.trim(),
    updatedAt: serverTimestamp(),
  })
}
