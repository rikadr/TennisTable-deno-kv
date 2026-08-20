import { TennisTable } from "../../client/client-db/tennis-table";
import { ACHIEVEMENT_GROUPS, orderAchievementTypes } from "./achievement-groups";

// The groups drive the sections of the player's achievement Progress tab.
// They must stay in sync with the progression keys in getPlayerProgression:
// an unlisted key would fall into the visible "Other" section, and a stale
// key would silently render nothing.

describe("achievement groups", () => {
  const progressionTypes = () =>
    Object.keys(new TennisTable({ events: [] }).achievements.getPlayerProgression("anyone"));

  it("orders the types by group, and by the order inside a group", () => {
    const first = ACHIEVEMENT_GROUPS[0];
    const second = ACHIEVEMENT_GROUPS[1];
    // Given in an order of their own, they come back in the group order.
    const ordered = orderAchievementTypes([second.types[0], first.types[1], first.types[0]]);

    expect(ordered).toEqual([first.types[0], first.types[1], second.types[0]]);
  });

  it("puts a type of no group last, in the order it was given", () => {
    const first = ACHIEVEMENT_GROUPS[0];
    const ordered = orderAchievementTypes(["not-a-group-member", first.types[0], "another-loose-type"]);

    expect(ordered).toEqual([first.types[0], "not-a-group-member", "another-loose-type"]);
  });

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
