import { lighten, readableOn, readableTextColor } from "./color-utils";

/** WCAG contrast ratio, reimplemented here so the assertions do not lean on the code under test. */
function contrastRatio(a: string, b: string): number {
  const luminance = (color: string) => {
    const hex = color.replace("#", "");
    const channels = [0, 2, 4]
      .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
      .map((channel) => (channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("readableTextColor", () => {
  it("puts white text on dark colours", () => {
    expect(readableTextColor("#000000")).toBe("#ffffff");
    expect(readableTextColor("#1d4ed8")).toBe("#ffffff");
  });

  it("puts black text on light colours", () => {
    expect(readableTextColor("#ffffff")).toBe("#000000");
    expect(readableTextColor("#ffe08a")).toBe("#000000");
  });

  it("weighs green heavier than blue, since green is perceived as brighter", () => {
    expect(readableTextColor("#00ff00")).toBe("#000000");
    expect(readableTextColor("#0000ff")).toBe("#ffffff");
  });

  it("accepts short hex and colours without a leading #", () => {
    expect(readableTextColor("#fff")).toBe("#000000");
    expect(readableTextColor("000")).toBe("#ffffff");
  });

  it("falls back to white for colours it cannot parse", () => {
    expect(readableTextColor("")).toBe("#ffffff");
    expect(readableTextColor("rgb(1, 2, 3)")).toBe("#ffffff");
    expect(readableTextColor("#12345")).toBe("#ffffff");
  });
});

describe("lighten", () => {
  it("keeps the colour when nothing is mixed in", () => {
    expect(lighten("#3366cc", 0)).toBe("#3366cc");
  });

  it("gives white when fully mixed", () => {
    expect(lighten("#3366cc", 1)).toBe("#ffffff");
  });

  it("mixes each channel towards white", () => {
    expect(lighten("#000000", 0.5)).toBe("#808080");
  });

  it("clamps out-of-range amounts and passes through unparseable colours", () => {
    expect(lighten("#3366cc", -1)).toBe("#3366cc");
    expect(lighten("#3366cc", 5)).toBe("#ffffff");
    expect(lighten("not-a-colour", 0.5)).toBe("not-a-colour");
  });
});

describe("readableOn", () => {
  // A pale player colour on a pale surface - the case readableOn exists for.
  const paleOnPale = readableOn("#dcc596", "#f8f3ea");

  it("darkens a pale colour until it reads on a pale surface", () => {
    expect(contrastRatio("#dcc596", "#f8f3ea")).toBeLessThan(4.5);
    expect(contrastRatio(paleOnPale, "#f8f3ea")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps a colour that already has enough contrast", () => {
    expect(readableOn("#7e0001", "#ffffff")).toBe("#7e0001");
  });

  it("lightens instead when the surface is dark", () => {
    const onDark = readableOn("#571c9d", "#111111");
    expect(contrastRatio(onDark, "#111111")).toBeGreaterThanOrEqual(4.5);
  });

  it("honours a custom minimum ratio", () => {
    expect(contrastRatio(readableOn("#dcc596", "#f8f3ea", 3), "#f8f3ea")).toBeGreaterThanOrEqual(3);
  });

  it("passes through colours it cannot parse", () => {
    expect(readableOn("not-a-colour", "#ffffff")).toBe("not-a-colour");
    expect(readableOn("#dcc596", "not-a-colour")).toBe("#dcc596");
  });
});
