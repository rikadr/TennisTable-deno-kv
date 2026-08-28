/**
 * Generates a VAPID key pair for Web Push and prints it in the env var format
 * the server expects (the same base64url raw formats `npx web-push
 * generate-vapid-keys` produces).
 *
 * Run once per deployment and keep the pair stable — changing it invalidates
 * every existing push subscription:
 *
 *   deno run scripts/generate-vapid-keys.ts
 */
import { base64UrlEncode } from "../push-notifications/web-push.ts";

const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);

if (!jwk.x || !jwk.y || !jwk.d) {
  throw new Error("Key export did not return the expected JWK fields");
}

function fromB64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

const publicKey = new Uint8Array(65);
publicKey[0] = 0x04;
publicKey.set(fromB64Url(jwk.x), 1);
publicKey.set(fromB64Url(jwk.y), 33);

console.log("Add these to the server environment (.env locally, project env on Deno Deploy):");
console.log();
console.log(`VAPID_PUBLIC_KEY=${base64UrlEncode(publicKey)}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log(`VAPID_SUBJECT=mailto:you@example.com`);
