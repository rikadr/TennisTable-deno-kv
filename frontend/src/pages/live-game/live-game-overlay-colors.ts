/**
 * Fixed colours for the TV overlay. The overlay does not use player colours: the
 * broadcast removes the green background, and a green player colour went with it.
 * Player 1 is orange and player 2 is blue in the win chance graphics.
 */
export const OVERLAY_COLORS = {
  chromaGreen: "#00b140",
  panel: "#10213f",
  divider: "rgba(255, 255, 255, 0.16)",
  accent: "#ffcc00",
  mutedText: "#8e9bb8",
  softText: "#c9d2e3",
  currentSetDivider: "#d4d4d8",
  player1: "#d96c00",
  player2: "#3b82f6",
} as const;
