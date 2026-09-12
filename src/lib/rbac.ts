import type { UserRole } from '../../lib/schema'

export type Permission =
  | 'community.participate'
  | 'art.publish_own'
  | 'sessions.facilitate_assigned'
  | 'content.manage'
  | 'users.read'
  | 'users.manage'
  | 'roles.manage'
  | 'finance.manage'

export interface RoleDefinition {
  label: string
  description: string
  permissions: Permission[]
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  user: {
    label: 'Member',
    description: 'Standard community access.',
    permissions: ['community.participate'],
  },
  artist: {
    label: 'Artist',
    description: 'Member access plus publishing their own artist work.',
    permissions: ['community.participate', 'art.publish_own'],
  },
  facilitator: {
    label: 'Facilitator',
    description: 'Can coordinate sessions assigned to them.',
    permissions: ['community.participate', 'art.publish_own', 'sessions.facilitate_assigned'],
  },
  curator: {
    label: 'Curator',
    description: 'Can manage Club BZR programming and content.',
    permissions: ['community.participate', 'art.publish_own', 'sessions.facilitate_assigned', 'content.manage'],
  },
  admin: {
    label: 'Admin',
    description: 'Full operational access, including users, roles, and finance.',
    permissions: [
      'community.participate',
      'art.publish_own',
      'sessions.facilitate_assigned',
      'content.manage',
      'users.read',
      'users.manage',
      'roles.manage',
      'finance.manage',
    ],
  },
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  'community.participate': 'Join sessions and participate in the community',
  'art.publish_own': 'Publish and manage their own artist work',
  'sessions.facilitate_assigned': 'Manage sessions assigned to them',
  'content.manage': 'Manage sessions, exhibitions, radio, and community content',
  'users.read': 'View private member administration data',
  'users.manage': 'Edit profiles and account state',
  'roles.manage': 'Assign and remove access roles',
  'finance.manage': 'View and manage payments, wallets, and ledger operations',
}

export const roleLabel = (role: UserRole): string => ROLE_DEFINITIONS[role]?.label || role

