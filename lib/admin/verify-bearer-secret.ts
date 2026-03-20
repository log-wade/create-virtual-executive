import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time compare for `Authorization: Bearer <token>` vs a server secret.
 * Returns false when lengths differ (no timing leak on the secret body beyond length bucket).
 */
export function verifyBearerSecret(
  authorizationHeader: string | null,
  secret: string,
): boolean {
  if (!authorizationHeader || !secret) return false;
  const prefix = "Bearer ";
  if (!authorizationHeader.startsWith(prefix)) return false;
  const token = authorizationHeader.slice(prefix.length);
  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
