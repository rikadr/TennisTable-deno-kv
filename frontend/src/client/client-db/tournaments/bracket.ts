import { SimulateGameFn, Tournament, TournamentBracketSection, TournamentGame, TournamentGameTarget } from "./tournament";

type Bracket = Partial<TournamentGame>[][];

type LayerGames = {
  // Games per bracket layer
  played: TournamentGame[]; // Completed games
  pending: TournamentGame[]; // Games that can be played now
};

export type DoubleEliminationStructures = {
  winners: Bracket;
  losers: Bracket;
  grandFinal: Partial<TournamentGame>;
  bracketReset: Partial<TournamentGame>;
};

type SimulationStructures = {
  winners: Bracket;
  losers?: Bracket;
  grandFinal?: Partial<TournamentGame>;
  bracketReset?: Partial<TournamentGame>;
  doubleElimination: boolean;
};

export class TournamentBracket {
  readonly #tournament: Tournament;
  readonly #playerOrder: string[];
  readonly doubleElimination: boolean;

  bracket: Bracket;
  bracketGames: LayerGames[];

  // Double elimination structures. Only set when doubleElimination is enabled
  losersBracket?: Bracket;
  grandFinal?: Partial<TournamentGame>;
  bracketReset?: Partial<TournamentGame>;
  losersBracketGames?: LayerGames[];
  grandFinalGames?: LayerGames;

  bracketStarted: number;
  bracketEnded?: number;

  // Lazily built reverse index: for each game, which game feeds each of its player slots
  #slotFeeders?: Map<Partial<TournamentGame>, { player1?: Partial<TournamentGame>; player2?: Partial<TournamentGame> }>;

  constructor(tournament: Tournament) {
    // Assumes no group play, or that group play has ended
    this.#tournament = tournament;
    this.doubleElimination = tournament.tournamentConfig.doubleElimination;
    if (this.#tournament.groupPlay?.groupPlayEnded !== undefined) {
      this.#playerOrder = this.#tournament.groupPlay.getBracketPlayerOrder() ?? [];
      this.bracketStarted = this.#tournament.groupPlay.groupPlayEnded;
    } else {
      this.#playerOrder = this.#tournament.tournamentConfig.playerOrder ?? tournament.signedUp.map((s) => s.player);
      this.bracketStarted = this.#tournament.tournamentConfig.startDate;
    }

    if (this.doubleElimination) {
      const structures = TournamentBracket.getStartingDoubleElimination(this.#playerOrder);
      this.bracket = structures.winners;
      this.losersBracket = structures.losers;
      this.grandFinal = structures.grandFinal;
      this.bracketReset = structures.bracketReset;
    } else {
      this.bracket = TournamentBracket.getStartingBracket(this.#playerOrder);
    }

    this.#fillBracketWithGames();
    this.bracketGames = this.#calculateLayerGames(this.bracket);
    if (this.doubleElimination) {
      this.losersBracketGames = this.#calculateLayerGames(this.losersBracket!);
      this.grandFinalGames = this.#calculateGrandFinalGames();
    }
    const decidingGame = this.#decidingGame();
    this.bracketEnded = decidingGame?.winner ? decidingGame.completedAt : undefined;
  }

  get winner() {
    return this.#decidingGame()?.winner;
  }

  get hasPendingGames(): boolean {
    if (this.bracketGames.some((layer) => layer.pending.length > 0)) return true;
    if (this.losersBracketGames?.some((layer) => layer.pending.length > 0)) return true;
    if (this.grandFinalGames && this.grandFinalGames.pending.length > 0) return true;
    return false;
  }

  /** The game that decides (or decided) the tournament champion */
  #decidingGame(): Partial<TournamentGame> | undefined {
    if (this.doubleElimination === false) return this.bracket[0]?.[0];
    const grandFinal = this.grandFinal;
    if (grandFinal?.winner === undefined) return grandFinal;
    // Winners bracket champion (player1) won the grand final: tournament decided.
    if (grandFinal.winner === grandFinal.player1) return grandFinal;
    // Losers bracket champion won: both players now have one loss, the bracket reset match decides
    return this.bracketReset;
  }

  /** This bracket's structures in the shape shared with the simulation engine */
  get #structures(): SimulationStructures {
    return {
      winners: this.bracket,
      losers: this.losersBracket,
      grandFinal: this.grandFinal,
      bracketReset: this.bracketReset,
      doubleElimination: this.doubleElimination,
    };
  }

  getGame(
    target: Pick<TournamentGameTarget, "section" | "layerIndex" | "gameIndex">,
  ): Partial<TournamentGame> | undefined {
    return TournamentBracket.#getGameIn(this.#structures, target);
  }

  static #getGameIn(
    structures: SimulationStructures,
    target: Pick<TournamentGameTarget, "section" | "layerIndex" | "gameIndex">,
  ): Partial<TournamentGame> | undefined {
    switch (target.section) {
      case "losers":
        return structures.losers?.[target.layerIndex]?.[target.gameIndex];
      case "grandFinal":
        return structures.grandFinal;
      case "bracketReset":
        return structures.bracketReset;
      case "winners":
      case undefined:
        return structures.winners[target.layerIndex]?.[target.gameIndex];
    }
  }

  /** All pending games with their location */
  getPendingGames(): { game: TournamentGame; section: TournamentBracketSection; layerIndex: number }[] {
    const pending: { game: TournamentGame; section: TournamentBracketSection; layerIndex: number }[] = [];
    this.bracketGames.forEach((layer, layerIndex) =>
      layer.pending.forEach((game) => pending.push({ game, section: "winners", layerIndex })),
    );
    this.losersBracketGames?.forEach((layer, layerIndex) =>
      layer.pending.forEach((game) => pending.push({ game, section: "losers", layerIndex })),
    );
    this.grandFinalGames?.pending.forEach((game) =>
      pending.push({
        game,
        section: game.section === "bracketReset" ? "bracketReset" : "grandFinal",
        layerIndex: 0,
      }),
    );
    return pending;
  }

  /**
   * The two players who could still fill an empty slot, once the game that decides it already has
   * both participants known. Walkovers are followed through (they just forward whoever arrives),
   * so e.g. a pending winners bracket game surfaces its two players on the losers bracket slot its
   * loser will drop into. Returns undefined while the deciding game is not yet fully determined.
   */
  getSlotFillCandidates(
    game: Partial<TournamentGame>,
    role: "player1" | "player2",
  ): [string, string] | undefined {
    return this.#candidatesFilling(game, role, new Set());
  }

  #candidatesFilling(
    game: Partial<TournamentGame>,
    role: "player1" | "player2",
    visitedWalkovers: Set<Partial<TournamentGame>>,
  ): [string, string] | undefined {
    const feeder = this.#getSlotFeeders().get(game)?.[role];
    if (!feeder) return undefined;
    if (feeder.player1 && feeder.player2) return [feeder.player1, feeder.player2];
    // A walkover forwards its single arrival, so the real deciding game is one step further up
    if (feeder.walkover && !visitedWalkovers.has(feeder)) {
      visitedWalkovers.add(feeder);
      return (
        this.#candidatesFilling(feeder, "player1", visitedWalkovers) ??
        this.#candidatesFilling(feeder, "player2", visitedWalkovers)
      );
    }
    return undefined;
  }

  /** Reverse index from each game to the game(s) that feed its two player slots */
  #getSlotFeeders() {
    if (this.#slotFeeders) return this.#slotFeeders;
    const feeders = new Map<
      Partial<TournamentGame>,
      { player1?: Partial<TournamentGame>; player2?: Partial<TournamentGame> }
    >();
    const register = (source: Partial<TournamentGame>, target?: TournamentGameTarget) => {
      if (!target) return;
      const targetGame = TournamentBracket.#getGameIn(this.#structures, target);
      if (!targetGame) return;
      const entry = feeders.get(targetGame) ?? {};
      entry[target.role] = source;
      feeders.set(targetGame, entry);
    };
    const allGames: Partial<TournamentGame>[] = [
      ...this.bracket.flat(),
      ...(this.losersBracket?.flat() ?? []),
      ...(this.grandFinal ? [this.grandFinal] : []),
      ...(this.bracketReset ? [this.bracketReset] : []),
    ];
    for (const game of allGames) {
      register(game, game.advanceTo);
      register(game, game.loserAdvanceTo);
    }
    this.#slotFeeders = feeders;
    return feeders;
  }

  /**
   * Find the game between two players across all bracket sections.
   * Prefers a pending game; otherwise returns the most recently completed one
   * (the same pair can meet more than once in double elimination)
   */
  findGameByPlayers(
    player1: string,
    player2: string,
  ): { game: Partial<TournamentGame>; section: TournamentBracketSection } | undefined {
    const players = [player1, player2];
    const candidates = this.#orderedGames().filter(
      ({ game }) =>
        game.player1 !== undefined &&
        game.player2 !== undefined &&
        players.includes(game.player1) &&
        players.includes(game.player2),
    );
    if (candidates.length === 0) return undefined;
    const pending = candidates.find(({ game }) => game.winner === undefined && game.skipped === undefined);
    if (pending) return pending;
    return candidates.sort((a, b) => (b.game.completedAt ?? 0) - (a.game.completedAt ?? 0))[0];
  }

  /** All completed games across all bracket sections */
  getCompletedGames(): TournamentGame[] {
    const completed: TournamentGame[] = [];
    this.bracketGames.forEach((layer) => completed.push(...layer.played));
    this.losersBracketGames?.forEach((layer) => completed.push(...layer.played));
    this.grandFinalGames?.played.forEach((game) => completed.push(game));
    return completed;
  }

  static getStartingBracket(playerOrder: string[]): Bracket {
    const bracket: Bracket = [];

    playerOrder.forEach((player, playerIndex, players) => {
      const layerIndex = Math.floor(Math.log2(Math.max(1, playerIndex)));
      const gamesInLayer = Math.pow(2, layerIndex);

      // Fill layer with empty games
      if (bracket[layerIndex] === undefined) {
        bracket[layerIndex] = Array.from({ length: gamesInLayer }, (_, index) => {
          if (layerIndex === 0) {
            return {}; // The Final game
          } else {
            return {
              advanceTo: {
                layerIndex: layerIndex - 1,
                gameIndex: Math.floor(index / 2),
                role: index % 2 === 0 ? "player1" : "player2",
              },
            };
          }
        });
      }

      // Assign players to the final game
      if (playerIndex < 2) {
        bracket[layerIndex][0][playerIndex === 0 ? "player1" : "player2"] = player;
        return; // Can i return here?
      }
      const oponentIndex = 2 * gamesInLayer - 1 - playerIndex;
      const oponent = players[oponentIndex];
      if (oponent === undefined) throw new Error("oponent is undefined");

      const oponentsMatchIndex = bracket[layerIndex - 1].findIndex(({ player1, player2 }) =>
        [player1, player2].includes(oponent),
      );
      if (oponentsMatchIndex === -1) throw new Error("oponentsMatchIndex not found (-1)");
      const oponentsMatch = bracket[layerIndex - 1][oponentsMatchIndex];
      const oponentRole: keyof TournamentGame = oponentsMatch.player1 === oponent ? "player1" : "player2";

      const newGameIndex = oponentsMatchIndex * 2 + (oponentRole === "player1" ? 0 : 1);
      const newGame = bracket[layerIndex][newGameIndex];

      // Add players to new game
      newGame.player1 = oponent;
      newGame.player2 = player;

      // Remove oponent from oponent game
      oponentsMatch[oponentRole] = undefined;
    });

    return bracket;
  }

  /**
   * Build the full double elimination structure: the winners bracket (identical to the single
   * elimination bracket), a losers bracket that every winners bracket loser drops into, a grand
   * final between the two bracket champions, and a bracket reset game that is only activated if
   * the losers bracket champion wins the grand final.
   *
   * Losers bracket rounds are numbered forward (round 1 is played first) but stored with the same
   * inverted layer indexing as the winners bracket: layerIndex 0 is the losers final.
   * Odd rounds pair up losers bracket survivors (round 1 pairs the winners bracket first round
   * losers). Even ("major") rounds pit a losers bracket survivor (player1) against a fresh
   * winners bracket dropout (player2).
   */
  static getStartingDoubleElimination(playerOrder: string[]): DoubleEliminationStructures {
    const winners = TournamentBracket.getStartingBracket(playerOrder);
    const losers: Bracket = [];
    const grandFinal: Partial<TournamentGame> = { section: "grandFinal" };
    const bracketReset: Partial<TournamentGame> = { section: "bracketReset" };
    winners.forEach((layer) => layer.forEach((game) => (game.section = "winners")));

    const layerCount = winners.length;
    if (layerCount === 0) {
      return { winners, losers, grandFinal, bracketReset };
    }

    // The winners bracket champion goes to the grand final
    winners[0][0].advanceTo = { section: "grandFinal", layerIndex: 0, gameIndex: 0, role: "player1" };

    // Which winners bracket games will actually be played (both slots eventually filled)?
    // Bye games are never played and therefore never produce a loser.
    const winnersWillBePlayed: boolean[][] = [];
    for (let layerIndex = layerCount - 1; layerIndex >= 0; layerIndex--) {
      winnersWillBePlayed[layerIndex] = winners[layerIndex].map((game, gameIndex) => {
        const player1Alive =
          game.player1 !== undefined || (winnersWillBePlayed[layerIndex + 1]?.[gameIndex * 2] ?? false);
        const player2Alive =
          game.player2 !== undefined || (winnersWillBePlayed[layerIndex + 1]?.[gameIndex * 2 + 1] ?? false);
        return player1Alive && player2Alive;
      });
    }

    if (layerCount === 1) {
      // Two players (or fewer): no losers bracket rounds. The loser of the winners final gets
      // their second chance directly in the grand final
      if (winnersWillBePlayed[0][0]) {
        winners[0][0].loserAdvanceTo = { section: "grandFinal", layerIndex: 0, gameIndex: 0, role: "player2" };
      }
      return { winners, losers, grandFinal, bracketReset };
    }

    const totalRounds = 2 * (layerCount - 1);

    const gamesInRound = (round: number): number => {
      if (round === 1) return Math.pow(2, layerCount - 2);
      const majorIndex = Math.floor(round / 2);
      return round % 2 === 0 ? Math.pow(2, layerCount - 1 - majorIndex) : Math.pow(2, layerCount - 2 - majorIndex);
    };

    const advanceTargetFromRound = (round: number, gameIndex: number): TournamentGameTarget => {
      if (round === totalRounds) {
        // The losers bracket champion goes to the grand final
        return { section: "grandFinal", layerIndex: 0, gameIndex: 0, role: "player2" };
      }
      const targetLayerIndex = totalRounds - (round + 1);
      if (round % 2 === 1) {
        // Odd round: the winner meets a winners bracket dropout in the next (major) round
        return { section: "losers", layerIndex: targetLayerIndex, gameIndex, role: "player1" };
      }
      // Major round: the winners pair up in the next (minor) round
      return {
        section: "losers",
        layerIndex: targetLayerIndex,
        gameIndex: Math.floor(gameIndex / 2),
        role: gameIndex % 2 === 0 ? "player1" : "player2",
      };
    };

    for (let round = 1; round <= totalRounds; round++) {
      const layerIndex = totalRounds - round;
      losers[layerIndex] = Array.from({ length: gamesInRound(round) }, (_, gameIndex) => ({
        section: "losers" as const,
        advanceTo: advanceTargetFromRound(round, gameIndex),
      }));
    }

    // Route each winners bracket loser into the losers bracket
    for (let layerIndex = 0; layerIndex < layerCount; layerIndex++) {
      winners[layerIndex].forEach((game, gameIndex) => {
        if (winnersWillBePlayed[layerIndex][gameIndex] === false) return; // Bye games produce no loser
        if (layerIndex === layerCount - 1) {
          // First winners round: losers pair up in losers round 1
          game.loserAdvanceTo = {
            section: "losers",
            layerIndex: totalRounds - 1,
            gameIndex: Math.floor(gameIndex / 2),
            role: gameIndex % 2 === 0 ? "player1" : "player2",
          };
        } else {
          // Later winners rounds: losers drop into the matching major round, cross-seeded with a
          // partner swap (gameIndex ^ 1). The losers bracket survivor arriving at major-round
          // game j descends exactly from winners game j of this layer, so swapping within each
          // pair guarantees a dropout never immediately meets a player from their own feeder
          // games — a rematch is only possible from the losers final onwards, where the pools
          // have fully merged and rematches are unavoidable
          const majorIndex = layerCount - 1 - layerIndex;
          const round = 2 * majorIndex;
          const games = gamesInRound(round);
          const crossSeededIndex = games <= 1 ? 0 : gameIndex ^ 1;
          game.loserAdvanceTo = {
            section: "losers",
            layerIndex: totalRounds - round,
            gameIndex: crossSeededIndex,
            role: "player2",
          };
        }
      });
    }

    // Determine which losers bracket slots can ever receive a player
    const slotAlive: { player1: boolean; player2: boolean }[][] = losers.map((layer) =>
      layer.map(() => ({ player1: false, player2: false })),
    );
    winners.forEach((layer) =>
      layer.forEach((game) => {
        const target = game.loserAdvanceTo;
        if (target?.section === "losers") slotAlive[target.layerIndex][target.gameIndex][target.role] = true;
      }),
    );
    // A slot pair where both slots can fill is a real game; exactly one slot is a walkover
    // (one player, no opponent); neither slot is an empty bye that no one ever reaches.
    const losersWillBePlayed: boolean[][] = losers.map((layer) => layer.map(() => false));
    const losersProducesPlayer: boolean[][] = losers.map((layer) => layer.map(() => false));
    for (let layerIndex = losers.length - 1; layerIndex >= 0; layerIndex--) {
      losers[layerIndex].forEach((game, gameIndex) => {
        const alive = slotAlive[layerIndex][gameIndex];
        losersWillBePlayed[layerIndex][gameIndex] = alive.player1 && alive.player2;
        const producesPlayer = alive.player1 || alive.player2;
        losersProducesPlayer[layerIndex][gameIndex] = producesPlayer;
        const target = game.advanceTo;
        if (producesPlayer && target?.section === "losers") {
          slotAlive[target.layerIndex][target.gameIndex][target.role] = true;
        }
      });
    }

    // Resolve advance targets past *empty* bye games only (games no player ever reaches). A game
    // that receives exactly one player is a walkover, not an empty bye: the lone player has no
    // opponent and is advanced automatically at fill time, so it is a real, visible slot and
    // pointers into it are NOT redirected. This keeps a winners bracket loser dropping into its
    // proper (round 1 or major/drop-in) round even when no opponent is there yet — they take the
    // walkover and continue as a losers bracket survivor, so minor ("losers only") rounds never
    // receive fresh drop-ins. Reads the original advance targets so it is independent of the
    // order in which we rewrite them below.
    const originalAdvanceTo = losers.map((layer) => layer.map((game) => game.advanceTo));
    const resolveTarget = (target: TournamentGameTarget): TournamentGameTarget => {
      if (target.section !== "losers") return target;
      if (losersProducesPlayer[target.layerIndex][target.gameIndex]) return target; // real game or walkover
      const passthrough = originalAdvanceTo[target.layerIndex][target.gameIndex];
      if (!passthrough) throw new Error("Empty bye losers bracket game has no advance target");
      return resolveTarget(passthrough);
    };
    winners.forEach((layer) =>
      layer.forEach((game) => {
        if (game.loserAdvanceTo) game.loserAdvanceTo = resolveTarget(game.loserAdvanceTo);
      }),
    );
    losers.forEach((layer, layerIndex) =>
      layer.forEach((game, gameIndex) => {
        if (losersWillBePlayed[layerIndex][gameIndex]) {
          game.advanceTo = resolveTarget(game.advanceTo!);
        } else if (losersProducesPlayer[layerIndex][gameIndex]) {
          // Walkover: exactly one player will ever arrive and is advanced automatically at fill time
          game.walkover = true;
          game.advanceTo = resolveTarget(game.advanceTo!);
        } else {
          // Empty bye: no player ever arrives here
          game.advanceTo = undefined;
          game.isBye = true;
        }
      }),
    );

    return { winners, losers, grandFinal, bracketReset };
  }

  /** All games that can receive results, in play order (earliest rounds first) */
  #orderedGames(): { game: Partial<TournamentGame>; section: TournamentBracketSection }[] {
    const games: { game: Partial<TournamentGame>; section: TournamentBracketSection }[] = [];
    for (let layerIndex = this.bracket.length - 1; layerIndex >= 0; layerIndex--) {
      this.bracket[layerIndex].forEach((game) => games.push({ game, section: "winners" }));
    }
    if (this.losersBracket) {
      for (let layerIndex = this.losersBracket.length - 1; layerIndex >= 0; layerIndex--) {
        this.losersBracket[layerIndex].forEach((game) => games.push({ game, section: "losers" }));
      }
    }
    if (this.grandFinal) games.push({ game: this.grandFinal, section: "grandFinal" });
    if (this.bracketReset) games.push({ game: this.bracketReset, section: "bracketReset" });
    return games;
  }

  #fillBracketWithGames() {
    const entries = this.#tournament.getRelevantGames(this.bracketStarted);
    const games = this.#orderedGames();

    entries.forEach((entry) => {
      for (const { game } of games) {
        if (game.winner || game.player1 === undefined || game.player2 === undefined) {
          // Won (or skipped), or incomplete players
          continue;
        }
        const matchPlayers = [game.player1, game.player2];
        const entryPlayers = [entry.player1, entry.player2];
        if (matchPlayers.every((player) => entryPlayers.includes(player)) === false) {
          // No match, keep as pending
          continue;
        }

        game.winner = entry.game ? entry.game.winner : entry.skip.winner;
        game.completedAt = entry.time; // Not sure how that would affect select item options for skipped games.....
        game.skipped = entry.skip;
        TournamentBracket.#advancePlayersIn(this.#structures, game);
        // In double elimination the same pair can meet again in a later game, so one entry
        // must only ever fill one game
        break;
      }
    });
  }

  /**
   * Route a completed game's winner (and loser, in double elimination) onwards.
   * Shared by the real event fill and the prediction simulation so the two can never diverge
   */
  static #advancePlayersIn(structures: SimulationStructures, game: Partial<TournamentGame>) {
    if (game.winner === undefined) throw new Error("Cannot advance players from a game without a winner");

    if (game.section === "grandFinal") {
      // Winners bracket champion (player1) wins: tournament decided.
      // Losers bracket champion (player2) wins: both players now have one loss, so the
      // bracket reset match is activated to decide the champion
      if (game.winner === game.player2 && structures.bracketReset && structures.bracketReset.player1 === undefined) {
        structures.bracketReset.player1 = game.player1;
        structures.bracketReset.player2 = game.player2;
      }
      return;
    }
    if (game.section === "bracketReset") return;

    if (game.advanceTo) {
      TournamentBracket.#assignPlayerIn(structures, game.advanceTo, game.winner);
    }
    if (game.loserAdvanceTo) {
      const loser = game.player1 === game.winner ? game.player2 : game.player1;
      if (loser === undefined) throw new Error("Cannot determine loser of completed game");
      TournamentBracket.#assignPlayerIn(structures, game.loserAdvanceTo, loser);
    }
  }

  static #assignPlayerIn(structures: SimulationStructures, target: TournamentGameTarget, player: string) {
    const targetGame = TournamentBracket.#getGameIn(structures, target);
    if (!targetGame) throw new Error("Advance target game does not exist");
    if (targetGame[target.role] !== undefined) throw new Error("Advance target slot is already taken");
    targetGame[target.role] = player;
    // A walkover has no opponent: the lone player wins automatically and advances onward. This is
    // how a winners bracket loser dropping into a round with no opponent continues as a losers
    // bracket survivor. Chained walkovers resolve recursively.
    if (targetGame.walkover) {
      targetGame.winner = player;
      TournamentBracket.#advancePlayersIn(structures, targetGame);
    }
  }

  #calculateLayerGames(bracket: Bracket): LayerGames[] {
    const games: LayerGames[] = [];
    for (let layerIndex = 0; layerIndex < bracket.length; layerIndex++) {
      const played: TournamentGame[] = [];
      const pending: TournamentGame[] = [];
      const layer = bracket[layerIndex];

      for (const game of layer) {
        if (game.player1 && game.player2) {
          // Both player are set
          if (game.winner || game.skipped) {
            // Game is completed
            played.push(game as TournamentGame);
          } else {
            // Game is pending
            pending.push(game as TournamentGame);
          }
        }
      }
      games.push({ pending, played });
    }
    return games;
  }

  #calculateGrandFinalGames(): LayerGames {
    const games = [this.grandFinal, this.bracketReset].filter(
      (game): game is Partial<TournamentGame> => game !== undefined,
    );
    return this.#calculateLayerGames([games])[0];
  }

  simulateWinnerFromExisting(simulateGameFn: SimulateGameFn, time: number): SimulationResult {
    return TournamentBracket.#simulateBracket(
      {
        winners: this.#deepCopyBracket(this.bracket),
        losers: this.losersBracket ? this.#deepCopyBracket(this.losersBracket) : undefined,
        grandFinal: this.grandFinal ? TournamentBracket.#deepCopyGame(this.grandFinal) : undefined,
        bracketReset: this.bracketReset ? TournamentBracket.#deepCopyGame(this.bracketReset) : undefined,
        doubleElimination: this.doubleElimination,
      },
      simulateGameFn,
      time,
    );
  }

  static simulateWinnerFromStatic(
    simulateGameFn: SimulateGameFn,
    time: number,
    playerOrder: string[],
    doubleElimination = false,
  ): SimulationResult {
    if (doubleElimination) {
      const structures = TournamentBracket.getStartingDoubleElimination(playerOrder);
      return TournamentBracket.#simulateBracket({ ...structures, doubleElimination: true }, simulateGameFn, time);
    }
    const bracket = TournamentBracket.getStartingBracket(playerOrder);
    return TournamentBracket.#simulateBracket({ winners: bracket, doubleElimination: false }, simulateGameFn, time);
  }

  /**
   * Core simulation logic that works on any bracket structure.
   * Simulates all pending games starting from the earliest rounds: the whole winners bracket,
   * then the losers bracket, then the grand final (and bracket reset if needed).
   */
  static #simulateBracket(
    structures: SimulationStructures,
    simulateGameFn: SimulateGameFn,
    time: number,
  ): SimulationResult {
    const { winners, losers, grandFinal, bracketReset, doubleElimination } = structures;
    let gamesSimulatedCount = 0;
    let totalConfidenceSum = 0;

    // Simulates a game if it is pending. Returns true if the game was simulated now
    const simulateGame = (game: Partial<TournamentGame>): boolean => {
      if (game.winner || !game.player1 || !game.player2) return false;
      const result = simulateGameFn(game.player1, game.player2);
      game.winner = result.winner;
      game.completedAt = time;
      gamesSimulatedCount++;
      totalConfidenceSum += result.confidence;
      return true;
    };

    // Winners bracket: process layers from last to first (bottom-up through the bracket)
    for (let layerIndex = winners.length - 1; layerIndex >= 0; layerIndex--) {
      for (const game of winners[layerIndex]) {
        if (simulateGame(game)) TournamentBracket.#advancePlayersIn(structures, game);
      }
    }

    if (doubleElimination === false) {
      const finalGame = winners[0]?.[0];
      if (!finalGame?.winner) {
        throw new Error("Simulation failed to produce a winner");
      }
      return { winner: finalGame.winner, gamesSimulatedCount, totalConfidenceSum };
    }

    // Losers bracket: earliest rounds are the deepest layers
    if (losers) {
      for (let layerIndex = losers.length - 1; layerIndex >= 0; layerIndex--) {
        for (const game of losers[layerIndex]) {
          if (simulateGame(game)) TournamentBracket.#advancePlayersIn(structures, game);
        }
      }
    }

    if (!grandFinal || !bracketReset) throw new Error("Missing grand final structures in double elimination");
    if (simulateGame(grandFinal)) TournamentBracket.#advancePlayersIn(structures, grandFinal);
    if (!grandFinal.winner) {
      throw new Error("Simulation failed to produce a grand final winner");
    }
    if (grandFinal.winner === grandFinal.player1) {
      // The winners bracket champion stayed undefeated
      return { winner: grandFinal.winner, gamesSimulatedCount, totalConfidenceSum };
    }
    // The losers bracket champion won the grand final: the bracket reset decides
    simulateGame(bracketReset);
    if (!bracketReset.winner) {
      throw new Error("Simulation failed to produce a bracket reset winner");
    }
    return { winner: bracketReset.winner, gamesSimulatedCount, totalConfidenceSum };
  }

  /**
   * Deep copy a bracket to avoid mutating the original
   */
  #deepCopyBracket(bracket: Bracket): Bracket {
    return bracket.map((layer) => layer.map((game) => TournamentBracket.#deepCopyGame(game)));
  }

  static #deepCopyGame(game: Partial<TournamentGame>): Partial<TournamentGame> {
    return {
      ...game,
      advanceTo: game.advanceTo ? { ...game.advanceTo } : undefined,
      loserAdvanceTo: game.loserAdvanceTo ? { ...game.loserAdvanceTo } : undefined,
    };
  }
}

export type SimulationResult = {
  winner: string;
  gamesSimulatedCount: number;
  totalConfidenceSum: number;
};
