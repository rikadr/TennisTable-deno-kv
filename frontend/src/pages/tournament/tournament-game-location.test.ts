import { TournamentGamePlacement } from "../../client/client-db/tournaments/tournament";
import { tournamentGameLink, tournamentPlacementLabels } from "./tournament-game-location";

const tournament = { id: "cup-1", name: "Spring cup" };
const pair = { player1: "ada", player2: "bo" };

function groupPlacement(groupIndex: number): TournamentGamePlacement {
  return { tournament, ...pair, where: "group", groupIndex };
}

function bracketPlacement(
  placement: Pick<
    Extract<TournamentGamePlacement, { where: "bracket" }>,
    "section" | "layerIndex" | "layerCount" | "doubleElimination"
  >,
): TournamentGamePlacement {
  return { tournament, ...pair, where: "bracket", ...placement };
}

describe("Naming where a game was played", () => {
  it("names the group of a group play game", () => {
    expect(tournamentPlacementLabels(groupPlacement(2))).toEqual({ stage: "Group play", round: "Group 3" });
  });

  it("names a single elimination round after the bracket it is in", () => {
    const semiFinals = bracketPlacement({
      section: "winners",
      layerIndex: 1,
      layerCount: 3,
      doubleElimination: false,
    });
    expect(tournamentPlacementLabels(semiFinals)).toEqual({ stage: "Finals", round: "Semi Finals" });
  });

  it("offsets the first chance rounds of a double elimination tournament", () => {
    const firstChanceFinal = bracketPlacement({
      section: "winners",
      layerIndex: 0,
      layerCount: 2,
      doubleElimination: true,
    });
    expect(tournamentPlacementLabels(firstChanceFinal)).toEqual({
      stage: "First chance bracket",
      round: "Semi Final",
    });
  });

  it("names a second chance round by how it is filled", () => {
    const secondChanceFinal = bracketPlacement({
      section: "losers",
      layerIndex: 0,
      layerCount: 2,
      doubleElimination: true,
    });
    expect(tournamentPlacementLabels(secondChanceFinal)).toEqual({
      stage: "Second chance bracket",
      round: "Second Chance Semi Final",
    });
  });

  it("names the final and the decider that can follow it", () => {
    const grandFinal = bracketPlacement({
      section: "grandFinal",
      layerIndex: 0,
      layerCount: 1,
      doubleElimination: true,
    });
    const bracketReset = bracketPlacement({
      section: "bracketReset",
      layerIndex: 0,
      layerCount: 1,
      doubleElimination: true,
    });
    expect(tournamentPlacementLabels(grandFinal)).toEqual({ stage: "Final", round: "Final" });
    expect(tournamentPlacementLabels(bracketReset)).toEqual({ stage: "Final", round: "The Final Decider" });
  });
});

describe("Linking to a game on the tournament page", () => {
  it("opens the tab that holds the game, with the pair to scroll to", () => {
    expect(tournamentGameLink("cup-1", groupPlacement(0))).toBe(
      "/tournament?tournament=cup-1&player1=ada&player2=bo&tab=group-play",
    );
  });

  it("opens the bracket tab of each section", () => {
    const tab = (placement: TournamentGamePlacement) =>
      new URLSearchParams(tournamentGameLink("cup-1", placement).split("?")[1]).get("tab");

    expect(tab(bracketPlacement({ section: "winners", layerIndex: 0, layerCount: 1, doubleElimination: false }))).toBe(
      "finals",
    );
    expect(tab(bracketPlacement({ section: "losers", layerIndex: 0, layerCount: 2, doubleElimination: true }))).toBe(
      "second-chance",
    );
    expect(
      tab(bracketPlacement({ section: "grandFinal", layerIndex: 0, layerCount: 1, doubleElimination: true })),
    ).toBe("grand-final");
    expect(
      tab(bracketPlacement({ section: "bracketReset", layerIndex: 0, layerCount: 1, doubleElimination: true })),
    ).toBe("grand-final");
  });
});
