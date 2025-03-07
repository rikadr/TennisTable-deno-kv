import { Router } from "oak";
import {
  CreatePlayerPayload,
  DEFAULT_PROFILE_PHOTO,
  createPlayer,
  deletePlayer,
  getPlayer,
  getProfilePicture,
  uploadProfilePicture,
} from "./player.ts";
import { isAuthenticated, requireAuth } from "../auth-service/middleware.ts";
import { WebSocketClientManager } from "../web-socket/web-socket-client-manager.ts";

function decodeBase64(base64: string): Uint8Array {
  // Buffer.from(data, 'base64') // Try it?
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function registerPlayerRoutes(api: Router, webSocketClientManager: WebSocketClientManager) {
  /**
   * Create a player
   */
  api.post("/player", async (context) => {
    const payload = (await context.request.body.json()) as CreatePlayerPayload;

    if (!payload.name) {
      throw new Error("name is required");
    }

    const existingPlayer = await getPlayer(payload.name);
    if (existingPlayer) {
      throw new Error("Player already exists");
    }

    const player = await createPlayer(payload);
    webSocketClientManager.reloadClients();
    context.response.body = player;
  });

  api.post("/player/:player/profile-picture", async (context) => {
    const { base64 } = (await context.request.body.json()) as { base64?: string };
    if (!base64) {
      context.response.status = 400;
      context.response.body = { message: "No image provided" };
      return;
    }

    const playerName = context.params.player;
    if (!playerName) {
      context.response.status = 400;
      context.response.body = { message: "No player provided" };
      return;
    }

    const player = await getPlayer(playerName);
    if (!player) {
      context.response.status = 404;
      context.response.body = { message: "Player not found" };
      return;
    }

    try {
      await uploadProfilePicture(playerName, base64);
      context.response.status = 204;
      webSocketClientManager.reloadClients();
    } catch (err) {
      console.error("Error uploading base64 profile image:", err);
      context.response.status = 500;
      context.response.body = { error: (err as Error).message };
    }
  });

  /**
   * Get a player profile picture
   */
  api.get("/player/:player/profile-picture", async (context) => {
    let imgbase64 = await getProfilePicture(context.params.player!);

    if (!imgbase64) {
      imgbase64 = DEFAULT_PROFILE_PHOTO;
    }

    const prefix = "data:image/jpeg;base64,";
    if (!imgbase64.startsWith(prefix)) {
      context.response.status = 400;
      context.response.body = { message: "Invalid image" };
      return;
    }

    imgbase64 = imgbase64.slice(prefix.length);

    try {
      const imageBinary = decodeBase64(imgbase64);
      context.response.status = 200;
      context.response.headers.set("Content-Type", "image/jpeg");
      context.response.headers.set("Content-Length", imageBinary.length.toString());
      context.response.body = imageBinary;
    } catch (error) {
      console.error("Error decoding base64 image:", error);
      context.response.status = 500;
      context.response.body = { message: "Failed to load image" };
    }
  });

  /**
   * Delete a player
   */
  api.delete("/player/:name", isAuthenticated, requireAuth("user", "delete"), async (context) => {
    const name = context.params.name;
    if (!name) {
      throw new Error("name is required");
    }
    const player = getPlayer(name);
    if (!player) {
      context.response.status = 404;
      return;
    }
    await deletePlayer(name);
    webSocketClientManager.reloadClients();
    context.response.status = 204;
  });
}
