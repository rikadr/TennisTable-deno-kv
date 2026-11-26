import { clearTrackedGame, loadTrackedGame, saveTrackedGame, StoredTrackedGame } from "./tracked-game-storage";

const STORAGE_KEY = "tennis-table-tracked-game";

const game: StoredTrackedGame = {
  player1: "alice",
  player2: "bob",
  matchData: {
    setsWon: { player1: 1, player2: 0 },
    setPoints: [{ player1: 11, player2: 2 }],
    trackedSets: [{ sequence: "1111111111122", pointTimes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] }],
    firstServers: [1],
    badSides: [null],
  },
  currentSetScore: { player1: 1, player2: 2 },
  currentTrackedSet: { sequence: "212", pointTimes: [20, 21, 22] },
  firstServer: 2,
  badSide: null,
  startedAt: 1,
  corrections: 3,
  pendingSave: null,
};

describe("tracked game storage", () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);

  beforeEach(() => {
    window.localStorage.clear();
    consoleError.mockClear();
  });

  it("returns null when no game is stored", () => {
    expect(loadTrackedGame()).toBeNull();
  });

  it("restores the game that was saved", () => {
    saveTrackedGame(game);
    expect(loadTrackedGame()).toEqual(game);
  });

  it("restores a save that did not complete", () => {
    const pending = { ...game, pendingSave: { stream: "game-1", playedAt: 50 } };
    expect(saveTrackedGame(pending)).toBe(true);
    expect(loadTrackedGame()).toEqual(pending);
  });

  it("reports a game that the device did not store", () => {
    const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(saveTrackedGame(game)).toBe(false);
    setItem.mockRestore();
  });

  it("returns null after the game is cleared", () => {
    saveTrackedGame(game);
    clearTrackedGame();
    expect(loadTrackedGame()).toBeNull();
  });

  it.each([
    ["text that is not JSON", "{not json"],
    ["an object of a different shape", JSON.stringify({ player1: "alice" })],
    ["a game without its current set", JSON.stringify({ ...game, currentTrackedSet: undefined })],
    ["a game with an invalid pending save", JSON.stringify({ ...game, pendingSave: { stream: "game-1" } })],
  ])("drops %s", (_, raw) => {
    window.localStorage.setItem(STORAGE_KEY, raw);
    expect(loadTrackedGame()).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
