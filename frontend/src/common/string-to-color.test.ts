import { readableTextColor, stringToColor } from "./string-to-color";

describe("readableTextColor", () => {
  it("uses black on a light color and white on a dark color", () => {
    expect(readableTextColor("#ffffff")).toBe("#000000");
    expect(readableTextColor("#e8e8d0")).toBe("#000000");
    expect(readableTextColor("#000000")).toBe("#ffffff");
    expect(readableTextColor("#1a1a1a")).toBe("#ffffff");
  });

  it("weights the channels as the eye sees them", () => {
    // Full green looks bright, and full blue looks dark, at the same value.
    expect(readableTextColor("#00ff00")).toBe("#000000");
    expect(readableTextColor("#0000ff")).toBe("#ffffff");
  });

  it("gives a readable color for every color of a player", () => {
    const ids = Array.from({ length: 200 }, (_, index) => `player-${index}`);
    ids.forEach((id) => expect(["#000000", "#ffffff"]).toContain(readableTextColor(stringToColor(id))));
  });
});
