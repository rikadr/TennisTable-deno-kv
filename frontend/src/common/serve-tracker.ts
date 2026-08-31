export type Server = 1 | 2;

export type ServeInfo = {
  /** Which player is currently serving. */
  server: Server;
  /** Serves left in the current server's turn (1 or 2). */
  servesRemaining: number;
};

/**
 * House rule: each player serves 2 points in a row, then it switches. The serve
 * stays 2 each for the whole set — unlike the official rules it does not change
 * to 1 serve each when both players reach 10 points.
 *
 * `firstServer` is whoever served the first point of the current set; the
 * server for any later point is derived from the points played so far.
 */
export function getServeInfo(setScore: { player1: number; player2: number }, firstServer: Server): ServeInfo {
  const totalPoints = setScore.player1 + setScore.player2;
  const serveTurn = Math.floor(totalPoints / 2);
  const otherServer: Server = firstServer === 1 ? 2 : 1;
  const server: Server = serveTurn % 2 === 0 ? firstServer : otherServer;
  const servesRemaining = 2 - (totalPoints % 2);
  return { server, servesRemaining };
}
