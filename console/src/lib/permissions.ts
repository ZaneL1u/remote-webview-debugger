import { useQuery } from '@tanstack/react-query'

import { getT } from '@/i18n'

import { meQuery } from './queries'
import type { Me, Role } from './types'

// docs/protocol.md section 12.2. The gateway enforces these; the console only hides what a role cannot do.
export type Permission =
  | 'project.manage' // create / rename / disable / delete projects, rotate the app key, allowed origins
  | 'policy.manage'
  | 'key.manage'
  | 'invite.manage' // device invites (section 12.6): support staff (members) send them too
  | 'member.view'
  | 'member.manage'
  | 'audit.org' // the organization-wide audit page

const grants: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set<Permission>([
    'project.manage',
    'policy.manage',
    'key.manage',
    'invite.manage',
    'member.view',
    'member.manage',
    'audit.org',
  ]),
  admin: new Set<Permission>(['project.manage', 'policy.manage', 'key.manage', 'invite.manage', 'member.view', 'audit.org']),
  member: new Set<Permission>(['invite.manage']),
}

export function can(me: Pick<Me, 'role'> | undefined, permission: Permission): boolean {
  return !!me && (grants[me.role]?.has(permission) ?? false)
}

/** The signed-in member. Inside the authenticated layout the query is always populated. */
export function useMe(): Me | undefined {
  return useQuery(meQuery).data
}

export function useCan(permission: Permission): boolean {
  return can(useMe(), permission)
}

// Localized on every read: index them at render time, do not copy them into module state.
export const roleLabels: Record<Role, string> = {
  get owner() {
    return getT().common.roles.owner
  },
  get admin() {
    return getT().common.roles.admin
  },
  get member() {
    return getT().common.roles.member
  },
}

export const roleDescriptions: Record<Role, string> = {
  get owner() {
    return getT().common.roleDescriptions.owner
  },
  get admin() {
    return getT().common.roleDescriptions.admin
  },
  get member() {
    return getT().common.roleDescriptions.member
  },
}
