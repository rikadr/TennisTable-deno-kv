import { tournamentNudgeMessage } from "./tournament-nudge-message";

describe("Slack message about the games a player can play today", () => {
  const opponents = [
    { name: "Bob", url: "https://example.com/tournament?tournament=cup&player1=ada&player2=bob" },
    { name: "Carl", url: "https://example.com/tournament?tournament=cup&player1=ada&player2=carl" },
  ];

  it("shows each game as link text in the html version", () => {
    const { html } = tournamentNudgeMessage({ playerName: "Ada", tournamentName: "Autumn Cup", opponents });
    expect(html).toBe(
      "<p>Hi Ada! 🏓 You have 2 tournament games you can play today in <b>Autumn Cup</b>:</p>" +
        '<ul><li><a href="https://example.com/tournament?tournament=cup&amp;player1=ada&amp;player2=bob">vs Bob</a></li>' +
        '<li><a href="https://example.com/tournament?tournament=cup&amp;player1=ada&amp;player2=carl">vs Carl</a></li></ul>',
    );
  });

  it("shows the full links in the plain version", () => {
    const { plain } = tournamentNudgeMessage({ playerName: "Ada", tournamentName: "Autumn Cup", opponents });
    expect(plain).toBe(
      "Hi Ada! 🏓 You have 2 tournament games you can play today in *Autumn Cup*:\n" +
        "• vs Bob: https://example.com/tournament?tournament=cup&player1=ada&player2=bob\n" +
        "• vs Carl: https://example.com/tournament?tournament=cup&player1=ada&player2=carl",
    );
  });

  it("uses the singular for one game", () => {
    const { plain } = tournamentNudgeMessage({
      playerName: "Ada",
      tournamentName: "Autumn Cup",
      opponents: opponents.slice(0, 1),
    });
    expect(plain).toContain("You have 1 tournament game you can play today");
  });

  it("escapes names in the html version", () => {
    const { html } = tournamentNudgeMessage({
      playerName: "<Ada>",
      tournamentName: "Tom & Jerry Cup",
      opponents: [{ name: 'B"ob', url: "https://example.com" }],
    });
    expect(html).toContain("Hi &lt;Ada&gt;!");
    expect(html).toContain("<b>Tom &amp; Jerry Cup</b>");
    expect(html).toContain(">vs B&quot;ob</a>");
  });
});
