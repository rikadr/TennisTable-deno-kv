import { Router } from 'https://deno.land/x/oak@v16.0.0/router.ts';
import { CreatePlayerPayload, createPlayer, deletePlayer, getAllPlayers, getPlayer } from './player.ts';

export function registerPlayerRoutes(api: Router) {
  /**
   * Get a player by name
   */
  api.get('/player/:name', async (context) => {
    const name = context.params.name;
    const player = await getPlayer(name);
    if (player) {
      context.response.body = player;
    } else {
      context.response.status = 404;
    }
  });

  /**
   * Get all players
   */
  api.get('/players', async (context) => {
    const player = await getAllPlayers();
    context.response.body = player;
  });

  /**
   * Create a player
   */
  api.post('/player', async (context) => {
    const payload = (await context.request.body.json()) as CreatePlayerPayload;

    if (!payload.name) {
      throw new Error('name is required');
    }

    const player = await createPlayer(payload);
    context.response.body = player;
  });

  /**
   * Delete a player
   */
  api.delete('/player/:name', async (context) => {
    const name = context.params.name;
    if (!name) {
      throw new Error('name is required');
    }
    const player = getPlayer(name);
    if (!player) {
      context.response.status = 404;
      return;
    }
    await deletePlayer(name);
    context.response.status = 204;
  });
}
