import "server-only";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/**
 * Invite token primitives.
 *
 * Design:
 *   - Plaintext token: 32 bytes of crypto randomness, base64url-encoded.
 *     This goes in the email URL and is never stored in the database.
 *   - Stored token: sha256 of the plaintext, hex-encoded. Lookups compare
 *     hashes, so a database leak reveals nothing usable.
 *   - Comparison uses constant-time equality to prevent timing attacks.
 */

const TOKEN_BYTES = 32; // 256 bits of entropy

export interface TokenPair {
  plaintext: string;
  hash: string;
}

/**
 * Generate a new invite token. Returns both the plaintext (to send in the
 * email) and the hash (to store in the database).
 *
 * The plaintext is only available at creation time — after this function
 * returns, the only way to recover it is from the outbound email.
 */
export function generateInviteToken(): TokenPair {
  const raw = randomBytes(TOKEN_BYTES);
  const plaintext = raw.toString("base64url");
  const hash = hashToken(plaintext);
  return { plaintext, hash };
}

/**
 * Hash a plaintext token. Used at lookup time to find a matching row.
 */
export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/**
 * Constant-time comparison of two hashes. Not strictly necessary when
 * comparing hex-encoded sha256 digests (they're already fixed-length and
 * attacker can't iterate), but good hygiene.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
