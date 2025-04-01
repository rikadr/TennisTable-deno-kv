import { Router } from "https://deno.land/x/oak@v16.0.0/router.ts";

export function registerImageKitRoutes(api: Router) {
  api.get("/image-kit-auth", async (context) => {
    context.response.headers.set("Access-Control-Allow-Origin", "*");
    context.response.headers.set("Content-Type", "application/json");
    context.response.body = await getAuthenticationParameters();
  });
}

async function getAuthenticationParameters() {
  const publicKey = Deno.env.get("IMAGE_KIT_PUBLIC_KEY") || "";
  const privateKey = Deno.env.get("IMAGE_KIT_PRIVATE_KEY") || "";

  const token = crypto.randomUUID();
  const expire = Math.floor(Date.now() / 1000) + 60 * 30;
  const signature = await createSignature(privateKey, token, expire);

  return {
    token,
    expire,
    signature,
    publicKey,
  };
}

async function createSignature(privateKey: string, token: string, expire: number) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(privateKey);
  const data = encoder.encode(token + expire);

  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
