import { TennisTable } from "../../client/client-db/tennis-table";
import { ACHIEVEMENT_GROUPS } from "./achievement-groups";

// The groups drive the sections of the player's achievement Progress tab.
// They must stay in sync with the progression keys in getPlayerProgression:
// an unlisted key would fall into the visible "Other" section, and a stale
// key would silently render nothing.

describe("achievement groups", () => {
  const progressionTypes = () =>
    Object.keys(new TennisTable({ events: [] }).achievements.getPlayerProgression("anyone"));

  it("lists every achievement type in exactly one group", () => {
    const seen = new Set<string>();
    for (const group of ACHIEVEMENT_GROUPS) {
      for (const type of group.types) {
        expect(seen).not.toContain(type);
        seen.add(type);
      }
    }
    expect([...seen].sort()).toEqual(progressionTypes().sort());
  });
});
