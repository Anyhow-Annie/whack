import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https'

export const ROLES = ['admin', 'manager', 'member', 'viewer'] as const
export type Role = (typeof ROLES)[number]

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLES.includes(value as Role)
}

export function requireRole(request: CallableRequest, allowed: readonly Role[]): { uid: string; role: Role } {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.')
  }

  const role = request.auth.token.role
  if (!isRole(role) || !allowed.includes(role)) {
    throw new HttpsError('permission-denied', 'Your role cannot access organizational knowledge.')
  }

  return { uid: request.auth.uid, role }
}
