export const USER_ROLES = [
  "user",
  "artist",
  "facilitator",
  "curator",
  "admin",
] as const;

export type ManagedRole = typeof USER_ROLES[number];

export const ACCOUNT_STATUSES = ["active", "suspended", "closed"] as const;
export type ManagedAccountStatus = typeof ACCOUNT_STATUSES[number];

export function isManagedRole(value: string): value is ManagedRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export function isManagedAccountStatus(value: string): value is ManagedAccountStatus {
  return (ACCOUNT_STATUSES as readonly string[]).includes(value);
}

export function claimsForRole(
  role: ManagedRole,
  existing: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    ...existing,
    role,
    admin: role === "admin",
    curator: role === "curator",
    facilitator: role === "facilitator",
  };
}

export function removesOwnAdminAccess(
  actorId: string,
  targetId: string,
  role: ManagedRole,
  status: ManagedAccountStatus
): boolean {
  return actorId === targetId && (role !== "admin" || status !== "active");
}
