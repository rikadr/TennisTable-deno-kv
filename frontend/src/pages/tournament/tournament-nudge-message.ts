export type NudgeOpponent = { name: string; url: string };

/**
 * A message to send a player on Slack about the tournament games they can play today. The html
 * version keeps the links as link text when pasted into Slack. The plain version is the fallback
 * for places that only take text, so it shows the full links. The slack version is Slack's own
 * markup, for an agent that posts through the Slack API.
 */
export function tournamentNudgeMessage({
  playerName,
  tournamentName,
  opponents,
}: {
  playerName: string;
  tournamentName: string;
  opponents: NudgeOpponent[];
}): { html: string; plain: string; slack: string } {
  const games = `${opponents.length} tournament game${opponents.length !== 1 ? "s" : ""}`;

  const html =
    `<p>Hi ${escapeHtml(playerName)}! 🏓 You have ${games} you can play today in <b>${escapeHtml(tournamentName)}</b>:</p>` +
    `<ul>${opponents.map((o) => `<li><a href="${escapeHtml(o.url)}">vs ${escapeHtml(o.name)}</a></li>`).join("")}</ul>`;

  const plain = [
    `Hi ${playerName}! 🏓 You have ${games} you can play today in *${tournamentName}*:`,
    ...opponents.map((o) => `• vs ${o.name}: ${o.url}`),
  ].join("\n");

  const slack = [
    `Hi ${escapeSlack(playerName)}! 🏓 You have ${games} you can play today in *${escapeSlack(tournamentName)}*:`,
    ...opponents.map((o) => `• <${o.url}|vs ${escapeSlack(o.name)}>`),
  ].join("\n");

  return { html, plain, slack };
}

function escapeSlack(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
