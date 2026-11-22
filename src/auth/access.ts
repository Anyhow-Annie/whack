import { ROLES, type Role } from '../types/domain'

export function parseRole(value: unknown): Role | null {
  return typeof value === 'string' && ROLES.includes(value as Role) ? (value as Role) : null
}

export function canReadKnowledge(role: Role | null): boolean {
  return role !== null
}

export function canContribute(role: Role | null): boolean {
  return role === 'admin' || role === 'manager' || role === 'member'
}

export function canManage(role: Role | null): boolean {
  return role === 'admin' || role === 'manager'
}
