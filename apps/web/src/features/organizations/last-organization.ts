// Remembers the last organization each user opened in this browser. It is
// only a convenience: storage may be unavailable, and the id may be stale.
const keyFor = (userId: string) => `opsflow:last-organization:${userId}`

export function readLastOrganizationId(userId: string): string | null {
  try {
    return localStorage.getItem(keyFor(userId))
  } catch {
    return null
  }
}

export function rememberLastOrganizationId(
  userId: string,
  organizationId: string,
): void {
  try {
    localStorage.setItem(keyFor(userId), organizationId)
  } catch {
    // Ignore: the app works without it.
  }
}
