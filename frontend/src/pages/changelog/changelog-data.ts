// Hand-curated changelog. Each entry is a notable change worth telling players
// about, distilled from the commit history. Keep the newest entry at the top.
//
// A post usually carries a single tag; some carry a couple when they genuinely
// span categories. Tags are the filter dimension on the changelog page, so keep
// the set small and meaningful rather than adding a new tag per post.

export const CHANGELOG_TAGS = [
  "New feature",
  "Improvement",
  "Bug fix",
  "Achievement",
  "Tournament",
  "Game",
  "Technology",
  "Admin",
  "Theme",
] as const;

export type ChangelogTag = (typeof CHANGELOG_TAGS)[number];

export interface ChangelogPost {
  /** ISO date (YYYY-MM-DD) the change landed. */
  date: string;
  title: string;
  /** A short, reader-friendly paragraph. Plain text, no markup. */
  body: string;
  tags: ChangelogTag[];
  icon: string;
}

export const CHANGELOG_POSTS: ChangelogPost[] = [
  {
    date: "2026-07-27",
    icon: "🌅",
    title: "Chase the clock: Earliest & Latest Game",
    body: "Two new league-wide records to fight over. Earliest Game 🌅 and Latest Game 🌙 are awarded to both players whenever a game beats the running record for the earliest or latest time of day it was played. They have no percentage bar — you either hold the record or you don't — so the Progress tab instead shows the current league record and your own personal best, so you can see how close you are to stealing it.",
    tags: ["Achievement", "New feature"],
  },
  {
    date: "2026-07-27",
    icon: "🔗",
    title: "Shareable achievement views (and a hidden shortcut)",
    body: "The Achievements page now keeps your chosen filter and the list/progress toggle in the page URL. That means your view survives a reload and you can send someone a link straight to exactly what you were looking at. Bonus trick: double-tap the \"S\" key anywhere in the app to flip the stealth theme on and off.",
    tags: ["Improvement", "Technology"],
  },
  {
    date: "2026-07-24",
    icon: "🏆",
    title: "Double elimination tournaments",
    body: "Tournaments can now run with a losers bracket. Lose a match and you're not out — you drop into the losers bracket and can still battle all the way back to the final. It combines with group play, uses cross-seeding to delay rematches for as long as possible, and cleanly handles player counts that aren't a perfect power of two. The setting locks in once the tournament starts.",
    tags: ["New feature", "Tournament"],
  },
  {
    date: "2026-07-20",
    icon: "📊",
    title: "Top player pairings in admin stats",
    body: "The admin stats page gained a top-10 table of the most frequent head-to-head pairings, so you can see which two players have logged the most games against each other.",
    tags: ["Admin", "New feature"],
  },
  {
    date: "2026-07-19",
    icon: "🤖",
    title: "Gamebot poller runs on a calmer schedule",
    body: "The Gamebot match poller was dialed back from running constantly to running once an hour, and then restricted to office hours (07:00–17:00). Same matches picked up, far less background chatter and load.",
    tags: ["Technology"],
  },
  {
    date: "2026-07-18",
    icon: "🐛",
    title: "Top Gaming tables count the quiet days correctly",
    body: "Fixed a timezone mismatch that could file a game under the wrong day in the admin Top Gaming tables. Periods with zero games are now counted too, so slow days no longer silently vanish from the ranking.",
    tags: ["Bug fix", "Admin"],
  },
  {
    date: "2026-07-10",
    icon: "☀️",
    title: "Perfect Day & Perfect Week",
    body: "Two new achievements for the relentless. Perfect Day ☀️ goes to anyone who stays undefeated across five or more games in a single day. Perfect Week 🗓️ asks for a win on every day of a working week, Monday through Friday.",
    tags: ["Achievement"],
  },
  {
    date: "2026-07-10",
    icon: "🃏",
    title: "Full House & Humbled",
    body: "Two achievements that track your record against the whole field. Full House 🃏 is earned by beating every currently ranked player at least once. Humbled 🙇 is its mirror image — losing to every currently ranked player at least once.",
    tags: ["Achievement"],
  },
  {
    date: "2026-07-10",
    icon: "📊",
    title: "Relative bars in the Games column",
    body: "The Games column of the admin Top Gaming tables now draws a small relative-quantity bar behind the numbers, making it easy to eyeball how busy each period was at a glance.",
    tags: ["Admin", "Improvement"],
  },
  {
    date: "2026-07-06",
    icon: "🍁",
    title: "Off-season gets a next-season card",
    body: "When there's no active season, the leaderboard podium now shows a card with information about the next season instead of empty space, so it's always clear what's coming up.",
    tags: ["New feature"],
  },
  {
    date: "2026-07-06",
    icon: "🐛",
    title: "Seasons no longer leak in pre-season games",
    body: "Fixed a bug where a season could include games played during the grace period before its official start, slightly skewing early standings. Seasons now count only games played within their real window.",
    tags: ["Bug fix"],
  },
  {
    date: "2026-06-28",
    icon: "🔮",
    title: "Live win predictions",
    body: "Live game views now show a win-prediction card, giving spectators a real-time read on who's favored to take the match.",
    tags: ["New feature"],
  },
  {
    date: "2026-06-27",
    icon: "👶",
    title: "First Game achievement",
    body: "Everyone starts somewhere. The First Game 👶 achievement marks your very first logged game — the humble beginning of your Tennis Table career.",
    tags: ["Achievement"],
  },
  {
    date: "2026-06-26",
    icon: "🔢",
    title: "Ranked achievement",
    body: "Play enough games to qualify for the leaderboard and you'll earn the Ranked 🔢 achievement — the moment you go from newcomer to a real contender in the standings.",
    tags: ["Achievement"],
  },
  {
    date: "2026-06-25",
    icon: "🏓",
    title: "Serve tracker",
    body: "You can now track serves while logging or following a game, both in the regular add-game flow and in live games, keeping serve rotation honest without anyone having to remember whose turn it is.",
    tags: ["New feature"],
  },
  {
    date: "2026-06-25",
    icon: "🕹️",
    title: "Optio Pong V4",
    body: "The playable Optio Pong mini-game got a big bump to version 4, with gameplay refinements to keep the arcade break fun.",
    tags: ["Game"],
  },
  {
    date: "2026-06-24",
    icon: "⚡",
    title: "Predictions got a lot faster",
    body: "The prediction engine was reworked for performance, moving the heavy prediction-history timeline calculations onto a web worker so the interface stays smooth while the numbers crunch in the background.",
    tags: ["Technology", "Improvement"],
  },
  {
    date: "2026-06-24",
    icon: "🕶️",
    title: "Stealth theme",
    body: "A new all-black, dark-grayscale \"stealth\" theme joined the lineup for when you want the app to disappear into the background. (Psst — double-tap \"S\" to toggle it.)",
    tags: ["Theme", "New feature"],
  },
  {
    date: "2026-06-23",
    icon: "🐛",
    title: "Anniversary achievement fixed",
    body: "The Anniversary 🎂 achievement now uses a proper calendar-date window when deciding whether you played close to the yearly anniversary of your first game, instead of a fixed time span that could drift.",
    tags: ["Bug fix", "Achievement"],
  },
  {
    date: "2026-06-23",
    icon: "🎨",
    title: "Optio theme",
    body: "A dedicated Optio theme was added for the Optio client, giving that instance its own branded look.",
    tags: ["Theme"],
  },
  {
    date: "2026-06-20",
    icon: "🗄️",
    title: "Database moved to SQL",
    body: "Under the hood, the event store was refactored onto a SQL database, with paginated record fetching for large leagues and more robust login handling. No change to how you use the app — just a sturdier foundation underneath it.",
    tags: ["Technology"],
  },
  {
    date: "2026-06-19",
    icon: "🏛️",
    title: "Hall of Fame filtering & sorting",
    body: "The Hall of Fame leaderboard gained category filtering and sorting, so you can slice the all-time greats by the dimension you care about.",
    tags: ["Improvement"],
  },
  {
    date: "2026-06-18",
    icon: "🏛️",
    title: "Hall of Fame hypothetical leaderboard",
    body: "A full \"what-if\" Hall of Fame leaderboard was added, and the experience score was split into separate games-won and games-lost sub-scores for a richer picture of every player's career.",
    tags: ["New feature"],
  },
  {
    date: "2026-06-11",
    icon: "🛰️",
    title: "Live cache updates when events change",
    body: "When an event is edited or deleted, connected clients now clear the affected cache over the websocket instead of showing stale data until the next reload — the board stays in sync in real time.",
    tags: ["Technology", "Bug fix"],
  },
  {
    date: "2026-06-11",
    icon: "🗓️",
    title: "Editable event timestamps",
    body: "Admins can now pick an exact date and time when editing an event's timestamp, making it straightforward to correct games that were logged at the wrong moment.",
    tags: ["Admin", "New feature"],
  },
  {
    date: "2026-06-11",
    icon: "📈",
    title: "Sharper confidence curve",
    body: "The prediction confidence curve was improved with half-life and exponent parameters, giving more sensible confidence values as players build up a game history.",
    tags: ["Technology", "Improvement"],
  },
  {
    date: "2026-06-10",
    icon: "🕹️",
    title: "Optio Pong arrives",
    body: "A fully playable Optio Pong game landed under the Simulations page — a little arcade table tennis to enjoy between real matches.",
    tags: ["Game", "New feature"],
  },
];
