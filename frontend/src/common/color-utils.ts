const BLACK = "#000000";
const WHITE = "#ffffff";

type Rgb = [number, number, number];

/** Reads `#rgb` / `#rrggbb` into channel values. Returns undefined for anything else. */
function parseHex(color: string): Rgb | undefined {
  let hex = color.trim().replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (hex.length !== 6 || /[^0-9a-f]/i.test(hex)) return undefined;
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  return [r, g, b];
}

function toHex(rgb: Rgb): string {
  return "#" + rgb.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("");
}

/** WCAG relative luminance of a single sRGB channel (0-255). */
function channelLuminance(value: number): number {
  const channel = value / 255;
  return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of a colour, 0 for black and 1 for white. */
function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio between two luminances, from 1 (identical) to 21 (black on white). */
function contrastRatio(a: number, b: number): number {
  const [lighter, darker] = a >= b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

function mix(rgb: Rgb, target: Rgb, amount: number): Rgb {
  const share = Math.min(1, Math.max(0, amount));
  return rgb.map((value, index) => Math.round(value + (target[index] - value) * share)) as Rgb;
}

/**
 * Picks black or white text for a background colour, whichever gets the higher WCAG contrast
 * ratio against it. Use it wherever text sits on a generated colour - player colours in
 * particular span everything from near-black to near-white, so neither white nor black text
 * is readable on all of them.
 *
 * Falls back to white for colours it cannot parse.
 */
export function readableTextColor(background: string): typeof BLACK | typeof WHITE {
  const rgb = parseHex(background);
  if (!rgb) return WHITE;

  const luminance = relativeLuminance(rgb);
  // Contrast ratio is (lighter + 0.05) / (darker + 0.05), with white at 1 and black at 0.
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  return contrastWithBlack >= contrastWithWhite ? BLACK : WHITE;
}

/**
 * Mixes a colour towards white, for tinted backgrounds and softer button variants.
 * `amount` is the share of white: 0 keeps the colour, 1 gives white.
 */
export function lighten(color: string, amount: number): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  return toHex(mix(rgb, [255, 255, 255], amount));
}

/**
 * Darkens or lightens `color` - whichever moves it away from `background` - until the two clear
 * `minimumRatio` (WCAG AA by default). For coloured text on a coloured surface, where
 * `readableTextColor` would answer with black or white and throw the colour away.
 */
export function readableOn(color: string, background: string, minimumRatio = 4.5): string {
  const rgb = parseHex(color);
  const backgroundRgb = parseHex(background);
  if (!rgb || !backgroundRgb) return color;

  const backgroundLuminance = relativeLuminance(backgroundRgb);
  const target: Rgb = backgroundLuminance > 0.5 ? [0, 0, 0] : [255, 255, 255];
  for (let amount = 0; amount < 1; amount += 0.05) {
    const candidate = mix(rgb, target, amount);
    if (contrastRatio(relativeLuminance(candidate), backgroundLuminance) >= minimumRatio) {
      return toHex(candidate);
    }
  }
  return toHex(target);
}
