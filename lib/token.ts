/**
 * SHA-256 hex, using Web Crypto so it runs identically in the Node route
 * (POST /api/login) and the Edge middleware. Used to derive the auth-cookie
 * value from GYM_SECRET: the cookie never carries the raw secret, and the hash
 * is not reversible, so a stolen cookie can't recover the password.
 */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const AUTH_COOKIE = "gym_auth";
