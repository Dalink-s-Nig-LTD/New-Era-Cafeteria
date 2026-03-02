// Simple auth - no JWT needed
// Authentication is handled via access codes in accessCodes.ts

import { QueryCtx, MutationCtx } from "./_generated/server";

/**
 * Get the userId from the session, if present.
 * Returns null since we use access code based auth without sessions.
 */
export async function getUserId(ctx: QueryCtx | MutationCtx): Promise<string | null> {
  // Access code based auth doesn't use session-based userId
  // This is a placeholder for future session-based auth
  return null;
}
