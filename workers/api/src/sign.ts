/**
 * HMAC-signed action links for Dan's emails (approve/reject a fridge note, approve/decline a
 * meeting). The signature covers `${scope}:${id}:${action}`, so a link only ever does the one thing
 * it says, for the one item it names, in the one feature it belongs to.
 */

const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const hmacKey = (secret: string) =>
  crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
const message = (scope: string, id: string, action: string) => new TextEncoder().encode(`${scope}:${id}:${action}`);

export async function sign(secret: string, scope: string, id: string, action: string): Promise<string> {
  return b64url(await crypto.subtle.sign("HMAC", await hmacKey(secret), message(scope, id, action)));
}

export async function verify(secret: string, scope: string, id: string, action: string, sig: string): Promise<boolean> {
  try {
    return await crypto.subtle.verify("HMAC", await hmacKey(secret), fromB64url(sig), message(scope, id, action));
  } catch {
    return false; // malformed signature
  }
}

/** `${base}${path}?id=…&action=…&sig=…` */
export async function signedUrl(base: string, path: string, secret: string, scope: string, id: string, action: string): Promise<string> {
  const url = new URL(path, base);
  url.search = new URLSearchParams({ id, action, sig: await sign(secret, scope, id, action) }).toString();
  return url.toString();
}

/** A stable, non-reversible tag for an IP address (for per-visitor caps without storing the IP). */
export async function hashIp(secret: string, ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${secret}:${ip}`));
  return [...new Uint8Array(digest).slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
