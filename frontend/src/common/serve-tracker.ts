export type Server = 1 | 2;

export type ServeInfo = {
  /** Which player is currently serving. */
  server: Server;
  /** Serves left in the current server's turn (1 during deuce, otherwise 1 or 2). */
  servesRemaining: number;
  /** True once both players have reached 10 points, when serve alternates every point. */
  isDeuce: boolean;
};

/**
 * Table tennis serve rules: each player serves 2 points in a row, then it
 * switches. Once both players reach 10 (deuce), the serve switches every point.
 *
 * `firstServer` is whoever served the first point of the current set; the
 * server for any later point is derived from the points played so far.
 */
export function getServeInfo(
  setScore: { player1: number; player2: number },
  firstServer: Server,
): ServeInfo {
  const totalPoints = setScore.player1 + setScore.player2;
  const isDeuce = setScore.player1 >= 10 && setScore.player2 >= 10;
  const serveTurn = isDeuce ? totalPoints : Math.floor(totalPoints / 2);
  const otherServer: Server = firstServer === 1 ? 2 : 1;
  const server: Server = serveTurn % 2 === 0 ? firstServer : otherServer;
  const servesRemaining = isDeuce ? 1 : 2 - (totalPoints % 2);
  return { server, servesRemaining, isDeuce };
}
