import { Router } from "oak";
import { getPlayer } from "../player/player.ts";
import { deleteSignUp, getSignedUp, signUp } from "./tournament.ts";
import { webSocketClientManager } from "../server.ts";

export type SignUpTournamentPayload = {
  tournamentId: string;
  player: string;
};

export function registerTournamentRoutes(api: Router) {
  /**
   * Sign up for tournament
   */
  api.post("/tournament/sign-up", async (context) => {
    const payload = (await context.request.body.json()) as SignUpTournamentPayload;

    if (!payload.tournamentId || !payload.player) {
      context.response.status = 402;
      context.response.body = "tournamentId and player is required";
      return;
    }

    const player = await getPlayer(payload.player);
    if (!player) {
      context.response.status = 404;
      context.response.body = "Player does not exist";
      return;
    }

    // TODO: Check that tournament exists

    const signedUp = await getSignedUp(payload);
    if (signedUp) {
      context.response.status = 402;
      context.response.body = "Player already signed up";
      return;
    }

    const result = await signUp(payload);

    await webSocketClientManager.reloadCacheAndClients();
    context.response.body = result;
  });

  /**
   * Delete one game
   */
  api.delete("/tournament/sign-up", async (context) => {
    const payload = (await context.request.body.json()) as SignUpTournamentPayload;
    if (!payload.tournamentId || !payload.player) {
      throw new Error("tournamentId and player is required");
    }

    const signedUp = await getSignedUp(payload);
    if (!signedUp) {
      context.response.status = 404;
      return;
    }

    await deleteSignUp(payload);
    await webSocketClientManager.reloadCacheAndClients();
    context.response.body = 204;
  });
}
