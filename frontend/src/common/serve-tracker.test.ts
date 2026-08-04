import { getServeInfo } from "./serve-tracker";

describe("getServeInfo", () => {
  it("first server serves the first two points", () => {
    expect(getServeInfo({ player1: 0, player2: 0 }, 1)).toEqual({
      server: 1,
      servesRemaining: 2,
    });
    expect(getServeInfo({ player1: 1, player2: 0 }, 1)).toEqual({
      server: 1,
      servesRemaining: 1,
    });
  });

  it("switches to the other player after two points", () => {
    expect(getServeInfo({ player1: 1, player2: 1 }, 1)).toEqual({
      server: 2,
      servesRemaining: 2,
    });
    expect(getServeInfo({ player1: 2, player2: 1 }, 1)).toEqual({
      server: 2,
      servesRemaining: 1,
    });
  });

  it("switches back after four points", () => {
    expect(getServeInfo({ player1: 2, player2: 2 }, 1)).toEqual({
      server: 1,
      servesRemaining: 2,
    });
  });

  it("respects the chosen first server", () => {
    expect(getServeInfo({ player1: 0, player2: 0 }, 2)).toMatchObject({ server: 2 });
    expect(getServeInfo({ player1: 1, player2: 1 }, 2)).toMatchObject({ server: 1 });
  });

  it("stays 2 serves each when both players reach 10 points", () => {
    expect(getServeInfo({ player1: 10, player2: 10 }, 1)).toEqual({
      server: 1,
      servesRemaining: 2,
    });
    expect(getServeInfo({ player1: 11, player2: 10 }, 1)).toEqual({
      server: 1,
      servesRemaining: 1,
    });
    expect(getServeInfo({ player1: 11, player2: 11 }, 1)).toEqual({
      server: 2,
      servesRemaining: 2,
    });
    expect(getServeInfo({ player1: 12, player2: 11 }, 1)).toEqual({
      server: 2,
      servesRemaining: 1,
    });
  });
});
