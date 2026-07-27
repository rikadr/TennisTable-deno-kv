import { ChangelogTag } from "./changelog-tags";

/** A paragraph, a bullet list, or a pulled-out quote. Keeps posts writable without a markdown dependency. */
export type ChangelogBlock =
  | { kind: "text"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "quote"; text: string; source?: string };

export type ChangelogCommit = {
  hash: string;
  subject: string;
};

export type ChangelogPost = {
  /** Url slug. Stable - it is a permalink. */
  slug: string;
  title: string;
  /** ISO date (yyyy-mm-dd) of the change, or of the last commit in the arc. */
  date: string;
  tags: ChangelogTag[];
  /** One or two sentences, shown in the list view. */
  summary: string;
  body: ChangelogBlock[];
  /** The commits the post was written from. */
  commits: ChangelogCommit[];
};

const text = (value: string): ChangelogBlock => ({ kind: "text", text: value });
const list = (...items: string[]): ChangelogBlock => ({ kind: "list", items });
const quote = (value: string, source?: string): ChangelogBlock => ({ kind: "quote", text: value, source });

/**
 * Backfilled from the git history, newest first.
 *
 * Not every commit gets a post - only the ones that are a story: a feature
 * landing, an architecture turn, a bug with an interesting cause, or an
 * experiment that did not survive.
 */
export const CHANGELOG_POSTS: ChangelogPost[] = [
  {
    slug: "shareable-filters",
    title: "Filters you can send to a colleague",
    date: "2026-07-27",
    tags: ["technical", "design", "achievements"],
    summary:
      "The achievements filter and view toggle moved into the URL, so a filtered page survives a reload and can be pasted into a chat.",
    body: [
      text(
        "The achievements page has a type filter and a toggle between 'recent achievements' and 'everyone's progress'. Both used to live in React state, which meant two small annoyances: a reload reset them, and there was no way to send someone a link to what you were looking at.",
      ),
      text(
        "Both now live in the query string - `?filter=<type>` and `?view=progress` - read through `useSearchParams` and written with `{ replace: true }` so filtering does not fill up the browser's back button. The 'all' filter and the default view delete their params instead of writing them, so a plain `/achievements` link stays plain.",
      ),
      text(
        "Same day: Earliest Game and Latest Game achievements, which are awarded for breaking the league-wide record for the earliest or latest game ever played. If you play at 06:12, you take the record from whoever held it.",
      ),
    ],
    commits: [
      { hash: "93e7536", subject: "Persist achievements filter and view state in URL (#106)" },
      { hash: "8b6c2ab", subject: "Add Earliest/Latest Game record-breaking achievements (#105)" },
    ],
  },
  {
    slug: "double-elimination",
    title: "Double elimination: losing once is no longer the end",
    date: "2026-07-24",
    tags: ["new-feature", "tournaments"],
    summary:
      "Tournaments can now be run as double elimination, with a losers bracket and a grand final. The single biggest change to the tournament code so far.",
    body: [
      text(
        "Until now a tournament was single elimination: lose one game and you are out. For an office league that is brutal - people show up once, get knocked out by the eventual winner in round one, and are done for the evening.",
      ),
      text(
        "Double elimination is now an option on the tournament form. Everyone who loses drops into a losers bracket and plays on; the winners-bracket champion meets the losers-bracket survivor in a grand final. Two new components render the extra structure - `tournament-losers-bracket.tsx` and `tournament-grand-final.tsx` - and the bracket renderer itself was largely rewritten to handle a graph that no longer narrows cleanly to one line.",
      ),
      text(
        "It is the largest tournament change to date: around 2200 lines added across 19 files, touching the bracket, the pending-games list on the leaderboard, signup, and the new/edit tournament forms.",
      ),
    ],
    commits: [{ hash: "88531be", subject: "Add double elimination (losers bracket) tournament option (#101)" }],
  },
  {
    slug: "gamebot-office-hours",
    title: "The poller learns about evenings",
    date: "2026-07-21",
    tags: ["technical", "performance"],
    summary:
      "The Gamebot integration polled every minute, then every ten, then hourly - and finally only between 07:00 and 17:00.",
    body: [
      text(
        "The Gamebot poller fetches matches from an external system and turns them into events. It started out running every minute, which was a lot of requests to answer 'no, still nothing' with.",
      ),
      text(
        "The schedule has been walked back in stages: every minute, then every ten minutes, then once an hour, and now hourly but only from 07:00 to 17:00. Nobody is registering office table tennis matches at 3am, and the ones who do can add them by hand.",
      ),
      text("A reminder that a cron expression is a product decision as much as a technical one."),
    ],
    commits: [
      { hash: "9348cb8", subject: "Restrict Gamebot poller cron to 07:00-17:00 hourly (#104)" },
      { hash: "abec2e8", subject: "Reduce Gamebot poller cron to run once an hour (#102)" },
      { hash: "1b68d39", subject: "reduce pull frequency form every 1 minute to every 10 minutes" },
    ],
  },
  {
    slug: "top-gaming-timezone-bug",
    title: "Two bugs in one table: the missing zeroes and the wrong day",
    date: "2026-07-18",
    tags: ["bug-fix", "admin"],
    summary:
      "The admin Top Gaming tables skipped quiet periods entirely, and grouped games by UTC day instead of local day. Both fixed.",
    body: [
      text(
        "The Top Gaming Days/Weeks/Months tables rank periods by how many games were played. Two things were wrong with them.",
      ),
      text(
        "First, periods with zero games were not in the data at all - they were derived from the games themselves, so a week nobody played simply did not exist. That makes any 'games per period' comparison flattering: the quiet stretches vanish instead of pulling the average down. Zero-game periods are now counted.",
      ),
      text(
        "Second, the key used to group a game into a day was built from UTC, while the label displayed next to it was rendered in local time. For most of the day these agree. For a game played late in the evening in a UTC+2 office they do not, and the game landed on tomorrow. The key now uses the same local components as the label.",
      ),
      text(
        "Timezone bugs are rarely visible in the data you look at while writing the code - only in the rows near midnight.",
      ),
    ],
    commits: [
      { hash: "b5c9ed3", subject: "Fix timezone mismatch in day-period key for Top Gaming tables (#100)" },
      { hash: "3a676f8", subject: "Count zero-game periods in admin Top Gaming tables (#99)" },
    ],
  },
  {
    slug: "perfect-day-perfect-week",
    title: "Four achievements about not losing",
    date: "2026-07-11",
    tags: ["achievements", "new-feature"],
    summary: "Full House, Humbled, Perfect Day and Perfect Week - plus a refactor of how Leap Frog is calculated.",
    body: [
      text(
        "A batch of achievements that reward shape rather than a single result. Perfect Day and Perfect Week are what they sound like: play at least a few games in the period and win all of them. Full House rewards beating a wide slice of the league, and Humbled is its mirror - the day everything went wrong.",
      ),
      text(
        "Leap Frog, which fires when you pass someone on the leaderboard, was refactored in the same week. Achievements that depend on leaderboard position are the awkward ones: they cannot be decided from a single game in isolation, they need the projected standing before and after.",
      ),
    ],
    commits: [
      { hash: "8437e17", subject: "Add Perfect Day and Perfect Week achievements (#98)" },
      { hash: "22cf76b", subject: "Add Full House and Humbled achievements (#97)" },
      { hash: "1701bcc", subject: "leap frog achievement refactor" },
    ],
  },
  {
    slug: "off-season-card",
    title: "What to show when there is no season",
    date: "2026-07-06",
    tags: ["new-feature", "seasons", "bug-fix"],
    summary:
      "The leaderboard podium now explains the off-season instead of standing empty, and seasons stopped counting games from before they started.",
    body: [
      text(
        "Between seasons the season podium had nothing to render, which looked like a bug rather than a calendar. It now shows a card with the next season's start instead.",
      ),
      text(
        "The related fix is subtler. Seasons have a grace period so a game played just after a season closes still counts towards it. The window was being applied at both ends, so games from *before* the season start were sneaking in too. A season now starts exactly when it starts.",
      ),
    ],
    commits: [
      { hash: "a9810c0", subject: "Show next season info card on leaderboard podium during off-season (#93)" },
      { hash: "208919a", subject: "Fix seasons including grace period games from before season start (#92)" },
    ],
  },
  {
    slug: "live-game-win-prediction",
    title: "Live odds on the wall-mounted TV",
    date: "2026-06-28",
    tags: ["new-feature", "predictions"],
    summary: "The live game views got a win prediction card, so spectators can see who the model thinks is winning.",
    body: [
      text(
        "The live game pages already showed the score. They now also show what the prediction engine makes of the matchup - a win probability for each player, from the same code that powers the 1v1 comparison.",
      ),
      text(
        "It is the first place where predictions are shown to people who are not looking for them. On the leaderboard you have to click into a page; on the TV next to the table it is simply there while you play, which turns out to be a much better way to start an argument about whether the rating system is fair.",
      ),
    ],
    commits: [{ hash: "57e041d", subject: "Add win prediction card to live game views (#90)" }],
  },
  {
    slug: "serve-tracker",
    title: "Who serves next?",
    date: "2026-06-25",
    tags: ["new-feature"],
    summary:
      "A serve tracker in the game tracker, the live game pages and the TV overlay - because nobody can remember whose serve it is.",
    body: [
      text(
        "Table tennis alternates serve every two points, and every eleventh point at deuce. This is trivially simple and universally forgotten mid-rally. The score is now enough to derive it, so the app derives it.",
      ),
      text(
        "The logic is a small pure function in `common/serve-tracker.ts` - about 30 lines, with tests - and a display component that renders it. It shows up in four places: the live tracking page, the live game page, the TV overlay and the live game card on the leaderboard.",
      ),
      text(
        "The whole feature is 236 lines including tests. Pure functions that take a score and return a fact are the cheapest kind of feature to add and the easiest to trust.",
      ),
    ],
    commits: [{ hash: "218fcd6", subject: "Add serve tracker to track game and live game (#88)" }],
  },
  {
    slug: "predictions-rebuilt",
    title: "Predictions rebuilt, and moved off the main thread",
    date: "2026-06-24",
    tags: ["performance", "predictions", "technical"],
    summary:
      "The 791-line future-elo module was replaced by a 600-line predictions module, and prediction history moved into a web worker.",
    body: [
      text(
        "`future-elo.ts` had grown to 791 lines and was the slowest thing in the app. Every time you opened a player page it recomputed the full prediction set synchronously, and the UI simply stopped until it finished.",
      ),
      text("Three changes, one day:"),
      list(
        "`future-elo.ts` was deleted and replaced by `predictions.ts` - 600 lines, restructured so the expensive parts are computed once and shared rather than recomputed per consumer.",
        "The prediction history timeline moved into a web worker, joining the tournament and Elo simulations that were already there. The graph now fills in while you scroll instead of blocking the page.",
        "The expected-score simulation changed shape: games per opponent are now dynamic while the total stays static, which spends the simulation budget on the matchups that actually matter.",
      ),
      text(
        "The stealth theme - black on dark greyscale - landed the same day, which is unrelated but shipped in the same breath.",
      ),
    ],
    commits: [
      { hash: "f81e347", subject: "Performance refactor of predictions" },
      { hash: "e07a4f8", subject: "prediction history use web worker for async history calculations timeline" },
      { hash: "f2bc0c8", subject: "simulated expected score dynamic games per opponent, static total" },
      { hash: "baa9366", subject: "Add stealth theme (black/dark grayscale) (#86)" },
    ],
  },
  {
    slug: "deno-kv-to-sql",
    title: "Deno KV → SQL",
    date: "2026-06-20",
    tags: ["architecture", "technical"],
    summary:
      "The event store moved from Deno KV to SQL behind a database interface, with SQLite locally and Supabase in production.",
    body: [
      text(
        "The backend had been on Deno KV since the first commit. It is a lovely thing to start with - no schema, no connection string, `kv.set` and you are done - but the event store had outgrown it. Reading the full log meant paging through a key-value list, the 64 KiB per-value limit had already caused one memorable outage (see the cache post from March 2025), and there was no way to ask the store a question more specific than 'give me everything'.",
      ),
      text("The refactor introduced a `db/database.ts` interface with two implementations behind it:"),
      list(
        "`db/sqlite.ts` - 220 lines, used for local development. No external service needed to run the server.",
        "`db/supabase.ts` - 275 lines, used in production.",
        "`db/schema.sql` - 31 lines. The whole application, schema-wise.",
      ),
      text(
        "The old `migrations/` folder went away with it - inline migrations that ran on server startup were a Deno KV coping mechanism, and a real schema file replaces them. A one-off `scripts/migrate-dump-to-supabase.ts` carried the existing events across.",
      ),
      text(
        "Follow-up commits in the days after: paginating Supabase reads (it caps rows per request), an `/env` endpoint, and catching login failures properly. Migrations are never done in one commit.",
      ),
    ],
    commits: [
      { hash: "5e66fb0", subject: "Refactor db to sql (#81)" },
      { hash: "0d7cb53", subject: "paginate supabase records" },
      { hash: "4ccb879", subject: "catch login fails" },
      { hash: "b2b610b", subject: "add unstable flags to deno config" },
    ],
  },
  {
    slug: "hall-of-fame-score-factors",
    title: "Scoring a career: what the Hall of Fame measures",
    date: "2026-06-19",
    tags: ["new-feature"],
    summary:
      "Peak Elo, podium time and experience split into games won and lost - plus a full hypothetical leaderboard of everyone who ever played.",
    body: [
      text(
        "The Hall of Fame honours retired players, which raises an awkward question: how do you rank careers that never overlapped? The score has been extended factor by factor over several weeks.",
      ),
      list(
        "All-Time High Elo - your peak, not your final rating. Retiring after a bad run should not erase a good year.",
        "Podium Time - how long you spent in the top three, integrated over time rather than counted as a binary.",
        "Experience, split into games won and games lost as separate sub-scores. Showing up a lot counts for something even when it did not go well.",
      ),
      text(
        "A bug in the peak-Elo calculation for unranked players was fixed along the way: players who never crossed the ranked threshold had no leaderboard entries to read a peak from, and were scoring zero rather than their actual best.",
      ),
      text(
        "The page that came out of it is the full hypothetical leaderboard - every player who has ever played, active and retired, ranked together. It is not a real standing, and it is the most argued-about screen in the app.",
      ),
    ],
    commits: [
      { hash: "2c9f1ac", subject: "Add category filtering and sorting to Hall of Fame leaderboard (#80)" },
      { hash: "8d44097", subject: "Split Hall of Fame experience into games won/lost sub-scores (#79)" },
      { hash: "4393f11", subject: "Add Hall of Fame full hypothetical leaderboard page (#78)" },
      { hash: "bc8ee85", subject: "Add Podium Time factor to Hall of Fame score (#61)" },
      { hash: "b6e56cb", subject: "Add All-Time High Elo factor to Hall of Fame score (#56)" },
      { hash: "9b0504b", subject: "Fix Hall of Fame peak ELO calculation for unranked players (#58)" },
    ],
  },
  {
    slug: "optio-pong",
    title: "Optio Pong",
    date: "2026-06-10",
    tags: ["fun", "new-feature"],
    summary: "A playable pong game, 911 lines of standalone HTML, hidden under the simulations page. Now at V4.",
    body: [
      text(
        "There is a playable pong game in the app. It lives in `public/optio-pong.html` as a single self-contained file - 911 lines of HTML, CSS and canvas - wrapped by a thirteen-line React component that puts it on a route.",
      ),
      text(
        "It has no connection to the event store, the leaderboard, or anything else. It does not affect your Elo. It has been through four versions.",
      ),
      quote(
        "Not every feature needs a justification. Some of them need a canvas element and an afternoon.",
      ),
    ],
    commits: [
      { hash: "9f6525b", subject: "Add Optio Pong playable game under simulations page (#71)" },
      { hash: "473eab6", subject: "Update Optio Pong game to V4 (#87)" },
    ],
  },
  {
    slug: "hardening-public-endpoints",
    title: "Locking the front door",
    date: "2026-05-31",
    tags: ["technical", "admin"],
    summary:
      "Public backend endpoints got input validation and a shared secret, and the /migrate route stopped being reachable from the internet.",
    body: [
      text(
        "The backend grew up around a trusted office network and a small number of users, and it showed. Several write endpoints took whatever JSON you sent them, and a `/migrate` route that could rewrite data was sitting on a public URL.",
      ),
      text("The hardening pass added validation to public endpoints, put a shared secret in front of the sensitive ones, and closed off `/migrate`."),
      text(
        "It joins a slow trail of similar commits over the project's life: 'disable delete all endpoint' (Nov 2024), 'auth for protected event types' (Mar 2025), 'disable local routes in production' (Nov 2025), and an awareness modal in front of the raw event explorer so nobody edits the event log by accident. The pattern is always the same - something convenient during development stays reachable for months longer than it should.",
      ),
    ],
    commits: [
      { hash: "3abb362", subject: "Harden public backend endpoints (validation, secret, /migrate) (#68)" },
      { hash: "05b460f", subject: "disable local routes in production" },
      { hash: "a8cd45f", subject: "auth for protected event types" },
      { hash: "117252e", subject: "disable delete all endpoint" },
      { hash: "6c84d08", subject: "secure event page behind awareness modal" },
    ],
  },
  {
    slug: "achievement-wave-may-2026",
    title: "Nine achievements in one week",
    date: "2026-05-17",
    tags: ["achievements", "new-feature"],
    summary:
      "David and Goliath, Marathon Set, Streak Ender, Group Stage Star, five Elo-derived achievements - and a shortlist of the ones that did not make it.",
    body: [
      text(
        "A concentrated week of achievements. Some reward beating the odds - David for taking down a much higher-rated player, and Goliath added later as its mirror, for holding your ground against the field below you. Streak Ender fires when you are the one who breaks someone's run.",
      ),
      text(
        "Marathon Set is league-wide rather than personal: it belongs to whoever played the longest deuce battle on record, and moves when someone plays a longer one.",
      ),
      text(
        "The same week, achievement data started carrying contextual detail rather than just a timestamp - so a card can say who you beat and by how much, instead of just 'David, earned 3 weeks ago'. Leap Frog cards show the opponent you passed.",
      ),
      text(
        "There is also a `achievement-suggestions.md` file in the repo holding shortlisted ideas that have not been built. Keeping the backlog in the repo instead of a tracker means it turns up in every code search, which is either a feature or a bug depending on the day.",
      ),
    ],
    commits: [
      { hash: "68d094e", subject: "Add Streak Ender and Group Stage Star achievements (#63)" },
      { hash: "6721022", subject: "Add Marathon Set achievement for league-wide deuce records (#62)" },
      { hash: "0c3ab96", subject: "Add Goliath achievement as the mirror of David (#57)" },
      { hash: "7729f5d", subject: "Add 5 Elo / rank-derived achievements (#55)" },
      { hash: "b85c5a0", subject: "Enrich achievement data with contextual details for display (#59)" },
      { hash: "af8f5fe", subject: "Add shortlisted achievement suggestions (#60)" },
    ],
  },
  {
    slug: "deactivated-players-stay-in-elo",
    title: "Deactivated players still shaped history",
    date: "2026-05-14",
    tags: ["bug-fix", "technical"],
    summary:
      "Removing a player from the leaderboard used to remove them from every Elo calculation too, silently rewriting everyone else's timeline.",
    body: [
      text(
        "Elo is path-dependent: your rating is the result of replaying every game in order. The projection only counted games where both players existed in the active player list - which means deactivating someone did not just hide them, it deleted their games from the replay and recomputed everyone they had ever played against.",
      ),
      text(
        "The visible symptom was a player page graph that changed shape retroactively. A rating you earned in March could move in May because an opponent left the office.",
      ),
      text(
        "Deactivated players are now kept in Elo scoring; they are only filtered out of the standings at display time. History stops moving.",
      ),
    ],
    commits: [{ hash: "1d3819d", subject: "Keep deactivated players in Elo scoring so timelines stay stable (#54)" }],
  },
  {
    slug: "live-game-tv-overlay",
    title: "Live game on the TV in the corner",
    date: "2026-04-23",
    tags: ["new-feature"],
    summary:
      "Public and admin live-game pages, plus a chroma-friendly overlay route for streaming the game to a screen next to the table.",
    body: [
      text(
        "766 lines in one go: a live game feature with two audiences. An admin page for whoever is running the score, and a public page for everyone watching. State lives on the server in `live-game/live-game.ts` and is pushed to viewers over the existing WebSocket connection, so the public page has no polling loop.",
      ),
      text(
        "Then the part that took the rest of the day. `/live-game/overlay` is a route deliberately mounted *outside* the nav menu wrapper - no header, no menu, no padding - so it can be captured and put on a TV. Follow-up commits centred it, added a zoom option for different screen sizes, improved streaming reliability, and added a faster fallback refetch for when the socket drops mid-match.",
      ),
      text(
        "The overlay being the only route above `<NavMenu />` in `App.tsx` is the kind of detail that looks like a mistake until you know why.",
      ),
    ],
    commits: [
      { hash: "6516ea1", subject: "Add public and admin live-game pages (#50)" },
      { hash: "9a8cc7e", subject: "tv overlay" },
      { hash: "758417a", subject: "centre tv overlay" },
      { hash: "2906290", subject: "improve streaming reliability" },
      { hash: "045edac", subject: "zoom option" },
      { hash: "68ecdaf", subject: "faster fallback refetch" },
    ],
  },
  {
    slug: "melt-your-pc",
    title: "\"Melt your pc\": one million iterations",
    date: "2026-04-22",
    tags: ["predictions", "fun"],
    summary:
      "Tournament predictions got a simulation-count selector, and the top option is a million iterations labelled honestly.",
    body: [
      text(
        "Tournament predictions run a Monte Carlo simulation: play the bracket out thousands of times, count how often each player wins. More iterations means a smoother distribution and more time spent waiting.",
      ),
      text(
        "Rather than pick a number for everyone, there is now a selector. The bottom end is fast and rough; the top end is 1,000,000 iterations and is labelled 'Melt your pc', which is a more useful description than any number of iterations would be.",
      ),
      text("It runs in a web worker, so it melts your PC without freezing the page."),
    ],
    commits: [
      { hash: "4bea005", subject: 'Add 1,000,000 iteration "Melt your pc" option to predictions' },
      { hash: "a35a5e4", subject: "Add simulation iteration selector to tournament predictions (#47)" },
    ],
  },
  {
    slug: "event-backup-download",
    title: "Download the whole league",
    date: "2026-03-26",
    tags: ["admin", "new-feature", "technical"],
    summary: "A button in the admin Events tab that downloads the full event log as a file.",
    body: [
      text(
        "One genuine advantage of event sourcing: the backup is a single append-only list, and it is already in the browser because the client downloads all of it to work at all.",
      ),
      text(
        "So the backup button is a client-side feature. No endpoint, no export job, no server-side streaming - serialise what is already in memory and hand it to the user as a file. Restoring it is a separate problem, but having the data in your own hands is the part that matters at 5pm on a Friday.",
      ),
    ],
    commits: [{ hash: "0a4b85f", subject: "Add event backup download button to admin Events tab (#39)" }],
  },
  {
    slug: "recharts-v3-revert",
    title: "Reverting recharts v3",
    date: "2026-03-30",
    tags: ["bug-fix", "technical"],
    summary: "A major version bump of the charting library broke the graphs. It was reverted the same week.",
    body: [
      text(
        "The app leans hard on recharts - Elo history, prediction timelines, distribution charts, admin stats. A bump from v2 to v3 broke the display of several of them.",
      ),
      text(
        "The fix was to go back to v2 and move on. Chasing a major version of a charting library through a dozen bespoke graph configurations is a project, not a chore, and it was not the project that week.",
      ),
      text(
        "Alongside it, a set of npm dependency overrides was added for security and compatibility - pinning `nth-check`, `postcss`, `serialize-javascript` and others past the versions that `react-scripts` drags in. `react-scripts` at 5.0.1 is a comfortable place to build from and an uncomfortable place to audit.",
      ),
    ],
    commits: [
      { hash: "8f7d403", subject: "Revert recharts from v3 to v2 to fix graph display issues (#43)" },
      { hash: "ca60a04", subject: "Add npm dependency overrides for security and compatibility (#42)" },
    ],
  },
  {
    slug: "hall-of-fame-first-version",
    title: "Hall of Fame",
    date: "2026-03-07",
    tags: ["new-feature"],
    summary: "A place for players who have left, so the leaderboard can be about the people still playing.",
    body: [
      text(
        "People leave. Until now their options were to sit on the leaderboard forever, slowly sinking, or be deactivated and disappear as though they had never played.",
      ),
      text(
        "The Hall of Fame is the third option: a separate page ranking retired players by a career score. The first version was 241 lines of `hall-of-fame.ts` plus an overview page and a per-player page, computing a composite score from what a player did while they were active.",
      ),
      text(
        "It also made deactivation a reasonable thing to do. Before, removing a player felt like erasing them, so nobody did it and the leaderboard filled up with names from three offices ago.",
      ),
    ],
    commits: [{ hash: "80e3ac4", subject: "Hall of fame, first version" }],
  },
  {
    slug: "recent-games-page",
    title: "A page for recent games",
    date: "2026-02-20",
    tags: ["new-feature", "design"],
    summary:
      "Scores, profile pictures and an overall/season toggle - the fifth attempt at answering 'what just happened?'",
    body: [
      text(
        "'Recent games' has existed in some form since December 2024, always as a widget on the leaderboard showing the last handful of results. It is the most-looked-at thing in the app and it kept outgrowing its box.",
      ),
      text("It is now a page of its own, with:"),
      list(
        "Actual scores, not just winner and loser.",
        "A toggle between overall and current-season points, since the same game is worth different amounts in each.",
        "Profile pictures and emojis in the table, added the day after.",
        "Column headers, which sounds trivial and was the most requested item on the list.",
        "A 'load more' button for admins, because 20 rows is right for a wall display and wrong for investigating a dispute.",
      ),
      text("It scales up on wider screens now too - the table was designed for a phone held next to the table, and looked lost on a laptop."),
    ],
    commits: [
      { hash: "d2ce11a", subject: "Add Recent Games page with score results and overall/season toggle (#27)" },
      { hash: "9691284", subject: "Add profile pictures and emojis to recent games table (#29)" },
      { hash: "32c8a83", subject: "Add headers to Recent games tables (#24)" },
      { hash: "1affe97", subject: "Add 'Load more games' button for admins on recent games page (#34)" },
      { hash: "03fe030", subject: "Scale up recent games page on wider screens (#73)" },
    ],
  },
  {
    slug: "self-service-tournaments",
    title: "Tournaments without a developer",
    date: "2026-02-22",
    tags: ["new-feature", "tournaments", "admin"],
    summary:
      "Admins can create and edit tournaments in the UI. For the first fifteen months, starting a tournament meant a commit.",
    body: [
      text(
        "Look through the history for commits like 'Start optio tournament', '2025 year end tournament', 'Add optio easter tournament', 'add players to tryvann tournaments', 'edit test tournament start', 'remove vlad from tournament'. Every tournament, every signup change, every start-date adjustment was a code change and a deploy.",
      ),
      text(
        "There are dozens of them. It worked because the person who wanted the tournament was the person who wrote the app, which is a fine arrangement right up until it is someone else's office.",
      ),
      text(
        "Tournaments are now created and edited from the tournament page by any admin - a '+ New tournament' button, a form, and an edit page. The same week: hiding the Finals and Group Play tabs before a tournament has started, and a fix for the competitors achievement being awarded at signup rather than at first game.",
      ),
    ],
    commits: [
      { hash: "3a116d8", subject: "Add self-service tournament management for admins (#37)" },
      { hash: "77b4d56", subject: "Add '+ New tournament' button to tournament list page (#33)" },
      { hash: "4b1a6dd", subject: "Hide Finals and Group Play tabs before tournament starts (#35)" },
      { hash: "ad5689d", subject: "Fix competitors achievement being awarded before tournament starts (#36)" },
    ],
  },
  {
    slug: "gamebot-poller",
    title: "Games that add themselves",
    date: "2025-12-16",
    tags: ["new-feature", "technical"],
    summary:
      "A poller that reads matches from an external system and writes them into the event store - plus the log-driven debugging session that came with it.",
    body: [
      text(
        "Some players were already recording matches in another system. Asking them to enter the same game twice was never going to work, so the backend grew an integration: a poller on a cron, a `process-matches.ts` that maps external matches onto the app's event types, and per-client config for which external league maps to which players.",
      ),
      text(
        "The commit trail that follows is a familiar shape when you are debugging something that only misbehaves against a live third-party API: 'log headers', 'remove headers log', 'remove log', 'remove more logs'. Four commits of console output going in and coming back out again.",
      ),
      text(
        "The last functional fix was filtering out resigned and tied matches. Table tennis in the app has a winner and a loser, and the external system allowed neither - so those matches had to be dropped rather than guessed at.",
      ),
    ],
    commits: [
      { hash: "921021c", subject: "gamebot poller" },
      { hash: "cc44a3e", subject: "completed poller for gamebot" },
      { hash: "3d9723c", subject: "filter out resigned and tied matches" },
      { hash: "3f4acd6", subject: "log headers" },
    ],
  },
  {
    slug: "local-storage-events",
    title: "Your browser remembers",
    date: "2025-11-25",
    tags: ["performance", "technical"],
    summary:
      "Events are cached in localStorage and the client only asks the server for what happened since its last event. 27 lines.",
    body: [
      text(
        "A thick client that projects the full event log has an obvious cost: it has to download the full event log. That was fine at a few hundred events and less fine at tens of thousands.",
      ),
      text(
        "The fix is small enough to read in one sitting - 27 lines across the event-db context and one backend route. Events are persisted to localStorage; on startup the client reads its cache, finds the newest timestamp it has, and asks the server only for events after that. On a warm cache a page load fetches almost nothing.",
      ),
      text(
        "The endpoint it depends on had existed since March 2025 ('endpoint to only get events after time stamp'), added during the event sourcing migration and unused for eight months. Sometimes you build the primitive well before the thing that needs it.",
      ),
      text(
        "The settings page grew a 'clear cache' button in the same period, which is the honest admission that any cache will eventually need a manual escape hatch.",
      ),
    ],
    commits: [
      { hash: "8fdccc1", subject: "local storage for events and only fetch events after your timestamp" },
      { hash: "f882bbe", subject: "games pagination" },
      { hash: "635a639", subject: "endpoint to only get events after time stamp" },
    ],
  },
  {
    slug: "seasons",
    title: "Seasons: two months from POC to LAUNCH SEASONS!!!",
    date: "2026-01-22",
    tags: ["new-feature", "seasons"],
    summary:
      "An all-time leaderboard is unwinnable if you joined late. Seasons took two months, a tie-breaker argument, and one commit message in all caps.",
    body: [
      text(
        "The problem with a rating that goes back to May 2024 is that the top of it is settled. If you joined last month you are not going to catch someone with 600 games, no matter how well you play, and 'you cannot win' is a poor reason to keep playing.",
      ),
      text(
        "Seasons started as a proof of concept on 22 November 2025 - `seasons/season.ts` and `seasons/seasons.ts`, 175 lines between them, and a page. Over that day and the next: a season graph, making all games eligible, a season winner achievement, a per-player season page, theme support, tests.",
      ),
      text(
        "Then it sat. For two months it was visible only to logged-in players while the details got worked out - what happens to games played right on the boundary, how a season interacts with the achievements engine, what the tie-breaker is when two players finish level. That last one landed as 'tie breaker on amount of games in season': if you are tied on points, the player who played more games wins. Rewarding turnout over rating-protection is a deliberate choice about what the app is for.",
      ),
      quote("Launch SEASONS!!!", "commit 3519298, 22 January 2026"),
      text(
        "The launch commit added a season card, a season FAQ, recent-achievements and recent-changes widgets, and a nav menu entry. The FAQ page is the tell - a feature that needs one is a feature people are going to have opinions about.",
      ),
    ],
    commits: [
      { hash: "c49716d", subject: "init POC for seasons" },
      { hash: "fac723d", subject: "tie breaker on amount of games in season" },
      { hash: "3da70fb", subject: "season winner achievement" },
      { hash: "d6380cf", subject: "show for logged in players" },
      { hash: "3519298", subject: "Launch SEASONS!!!" },
      { hash: "ef01c1b", subject: "Mobile improvements for seasons" },
    ],
  },
  {
    slug: "tournament-predictions-worker",
    title: "Tournament predictions, and an honest commit message",
    date: "2025-11-15",
    tags: ["predictions", "tournaments", "performance"],
    summary:
      "Simulating a whole bracket thousands of times, moved into a web worker - and the skip mechanic became event sourced along the way.",
    body: [
      text(
        "Predicting a single game is one probability. Predicting a tournament means playing the entire bracket out thousands of times and counting who ends up holding the trophy - and it has to account for the games already played, and for the ones that were skipped.",
      ),
      text("The four-day arc, in commit messages:"),
      list(
        "'init beta tournament prediction' - a page behind a beta link.",
        "'bad init with bugs' - the most useful commit message in the repository.",
        "'implement missing methods', 'fix bug', 'update how many simualtions'.",
        "'improve tournament prediction to include skipped gamse' - two typos, one real modelling problem.",
        "'worker based simulation of tournaments' - the point where it stopped freezing the page.",
      ),
      text(
        "The prerequisite was 'Make tournament game skips event sourced'. Skips had been a mutable flag on a tournament; a simulation that replays a bracket needs to know *when* a game was skipped, not just that it was. Turning it into an event made the skip part of history - and made 'undo skip' possible, which arrived the next day as its own page.",
      ),
      text(
        "The tournament page was reorganised into tabs in the same week, because a bracket, a group table, a signup list and a prediction chart do not fit on one phone screen.",
      ),
    ],
    commits: [
      { hash: "a9c5a67", subject: "init beta tournament prediction" },
      { hash: "1a1ceaf", subject: "bad init with bugs" },
      { hash: "94331da", subject: "improve tournament prediction to include skipped gamse" },
      { hash: "9d2a3bf", subject: "worker based simulation of tournaments" },
      { hash: "36f26e2", subject: "Make tournament game skips event sourced" },
      { hash: "9bfb91a", subject: "tournament tab navigation completed" },
    ],
  },
  {
    slug: "trophies-to-achievements",
    title: "From trophies to achievements: two days, twenty ideas",
    date: "2025-11-08",
    tags: ["achievements", "new-feature"],
    summary:
      "A 100-line experiment called trophies became a 430-line achievements engine, and then a burst of two dozen commits naming things like Edge Lord and Welcome Committee.",
    body: [
      text(
        "6 November 2025: 'init trophies'. 100 lines, one page, a handful of badges. Two days later the file was deleted and rewritten as `achievements.ts` at 430 lines, with a 308-line display layer. The rename was not cosmetic - trophies were a list of badges, achievements are a set of rules evaluated against the projected history with progress tracked for the ones you have not earned yet.",
      ),
      text("Then the fun part. In a single day, in roughly this order:"),
      list(
        "Nice game, Close Calls, Edge Lord, Consistency Is Key, Variety Player",
        "Best Friends - your most frequent opponent - which needed three follow-up commits to get 'current progress' right",
        "Humiliation Streak, losing streaks and comebacks",
        "Welcome Committee and Community Builder - for playing new people",
        "Global Player, tournament achievements",
        "'activity is stricter', 'improved activity tracking', 'fix activity period tracking' - deciding what 'active' means turned out to be the hard part",
      ),
      text(
        "The performance note from the same day is 'skip repeat calculations of achievements if already calculated'. Evaluating two dozen rules against every game for every player, on every render, is exactly as expensive as it sounds.",
      ),
      text(
        "Tests arrived four days later, and there are now over 30 achievement test files in `__tests__/achievements/`. Rules that read 'win 5 games in a row without dropping a set' are easy to write and very easy to get subtly wrong.",
      ),
    ],
    commits: [
      { hash: "a83a6ed", subject: "init trophies" },
      { hash: "39a6484", subject: "rename from trophies to achievements" },
      { hash: "4592a05", subject: "close calls" },
      { hash: "084ad1d", subject: "best friends achievement" },
      { hash: "18a8826", subject: "Welcome Committee achievement" },
      { hash: "bbb0d9e", subject: "skip repeat calculations of achievements if already calculated" },
      { hash: "826ef88", subject: "activity is stricter" },
      { hash: "00d605a", subject: "init achievements tests" },
    ],
  },
  {
    slug: "track-game-live",
    title: "Track a game while you play it",
    date: "2025-10-21",
    tags: ["new-feature"],
    summary:
      "Two ways to record a match: type in a finished score, or tap points as they happen. Plus the removal of a page nobody used.",
    body: [
      text(
        "Adding a game after the fact means remembering the score, which people are bad at. The tracker lets you put a phone on the table and tap points as they happen, then hand the finished game straight to the add-game flow.",
      ),
      text(
        "Because there are now two entry paths, `/add-game` became a fork - 'choose how to add game' - rather than a form. One button for a finished game, one for a live one.",
      ),
      text(
        "The same week, the expected score page was deleted. It had been superseded by the predictions tab two weeks earlier and was still on the menu. Removing a page you built is harder than it should be.",
      ),
    ],
    commits: [
      { hash: "bdbf9f3", subject: "init track game" },
      { hash: "3c8edf5", subject: "add game from tracking game page" },
      { hash: "97ec901", subject: "choose how to add game" },
      { hash: "7fe5e37", subject: "remove expected score page" },
    ],
  },
  {
    slug: "player-network",
    title: "The player network, vibe-coded",
    date: "2025-08-28",
    tags: ["new-feature", "experiment"],
    summary: "A d3 force-directed graph of who plays whom, 567 lines in a single commit, honestly labelled.",
    body: [
      quote("Player network Proof of concept mvp vibe code", "commit 679914b, 27 August 2025"),
      text(
        "Four hedges in one commit message. It added d3 to the dependency list and 567 lines of force-directed graph: players as nodes, games as edges, thicker where two people play each other more.",
      ),
      text(
        "It turned out to be genuinely informative. The leaderboard tells you who is good; the network tells you that half the league has never played the other half, which is the thing that actually undermines a rating system.",
      ),
      text(
        "Cleanup over the following day: only active players shown (the full graph was unreadable), no pointer events on labels (they ate every click meant for a node), and 'simplify code'. It later moved under the simulations page, where the other exploratory tools live.",
      ),
    ],
    commits: [
      { hash: "679914b", subject: "Player network Proof of concept mvp vibe code" },
      { hash: "c68e6b7", subject: "only active players show up" },
      { hash: "32387ca", subject: "no pointer events on labels" },
      { hash: "0932ded", subject: "move player network to simulations page" },
    ],
  },
  {
    slug: "deleting-the-server-cache",
    title: "Deleting the cache we spent a day tuning",
    date: "2025-08-15",
    tags: ["technical", "performance", "architecture"],
    summary: "The server-side event cache was removed entirely. Five months earlier it had been the most-debugged file in the repo.",
    body: [
      text(
        "In March 2025 the backend cache was a 102-line file that chunked the payload into 64 KiB batches to fit inside Deno KV's per-value limit, and it took a day of commits to stabilise. In August it was deleted.",
      ),
      text("The removal came in stages, which is the polite way to delete something load-bearing:"),
      list(
        "'skip event cache' - stop reading from it.",
        "'skip creating cache on post event' - stop writing to it.",
        "'stage 1 delete all caches' - clear what is there.",
        "'completely remove event cache' - delete the file.",
      ),
      text(
        "It was not that the cache was bad. It was that the clients had learned to cache for themselves, and the event log endpoint had learned to serve only what changed. The cache was solving a problem that two other changes had already solved, and every extra layer that stores a copy of the truth is a layer that can serve a stale one.",
      ),
      text("Net effect: 47 lines deleted, 15 added, and one fewer thing that can be wrong."),
    ],
    commits: [
      { hash: "095728e", subject: "skip event cache" },
      { hash: "f06055c", subject: "skip creating cache on post event" },
      { hash: "ff6f20f", subject: "stage 1 delete all caches" },
      { hash: "941a6c4", subject: "completely remove event cache" },
    ],
  },
  {
    slug: "opponent-scores-graph",
    title: "How close were those games, really?",
    date: "2025-08-14",
    tags: ["new-feature", "design"],
    summary: "A graph of the scores your opponents put up against you - and later, bars drawn only between the real min and max.",
    body: [
      text(
        "Win/loss records flatten everything. Beating someone 11-9 five times is a very different relationship from beating them 11-2 five times, and the leaderboard cannot tell you which one you have.",
      ),
      text(
        "The opponent scores graph shows the distribution of points your opponents scored against you. It is the most direct answer in the app to 'am I actually better than them, or have I just been lucky?'",
      ),
      text(
        "Two later refinements are worth noting. The bars were changed to span only between the actual minimum and maximum score rather than starting at zero - a bar from 0 to 9 implies you have conceded every score from 0 upwards, which is usually false. And the Points Exchanged bars had their orientation flipped, because the first version read backwards to everyone who was not the person who wrote it.",
      ),
    ],
    commits: [
      { hash: "e84f845", subject: "first version of oponents scores graph" },
      { hash: "ba3bd96", subject: "tweak new graph visuals" },
      { hash: "e594dcf", subject: "Show opponent score chart bars only between actual min and max (#52)" },
      { hash: "57b7426", subject: "Flip orientation of Points Exchanged bars (#67)" },
    ],
  },
  {
    slug: "expected-leaderboard",
    title: "The leaderboard as it should be",
    date: "2025-06-17",
    tags: ["predictions", "new-feature"],
    summary:
      "If everyone played everyone the same number of times, who would be on top? A simulated leaderboard that removes the schedule.",
    body: [
      text(
        "The player network had made the problem concrete: the real leaderboard is partly a ranking of skill and partly a ranking of who you happened to play. Beat the same three people forty times and your rating says something quite narrow.",
      ),
      text(
        "The expected leaderboard simulates the games that never happened. Every player plays every other player, using the prediction model for each matchup, and the resulting standing is what the league would look like on a fair schedule.",
      ),
      text(
        "It is not the real leaderboard and is not meant to replace it. It is the answer to 'yes, but'. The simulation went through months of tuning afterwards - excluding games from before a player was ranked, avoiding double compensation, and eventually making games-per-opponent dynamic while keeping the total fixed.",
      ),
    ],
    commits: [
      { hash: "ce0a963", subject: "First iteration of expected leaderboard" },
      { hash: "4ad2b04", subject: "prepare for expected leaderboard" },
      { hash: "c849a90", subject: "exclude games before ranked from simulation" },
      { hash: "1a8327e", subject: "Fix double compensation in expected simulation" },
    ],
  },
  {
    slug: "loader-animation",
    title: "A loading screen worth looking at",
    date: "2025-06-13",
    tags: ["design", "performance"],
    summary:
      "Six commits in one day on the loading animation, including deleting a fake delay that existed to make it visible.",
    body: [
      text(
        "A thick client has an unavoidable startup cost: download the events, project them, then render. On a cold cache that is a real wait, and it is the first thing anyone sees.",
      ),
      text(
        "One day, six commits: 'new loader animation', 'faster animation', 'improved loader', 'improve progress bar', 'smooth animation to finished load', 'let animations finish'.",
      ),
      text(
        "The interesting one is 'no fake delay for loading'. There had been an artificial minimum duration - a common trick, since a spinner that flashes for 80ms looks like a glitch. Once the loader had a real progress bar tied to real work, the delay was just making the app slower on purpose, so it went.",
      ),
      text("The rest is easing curves. 'let animations finish' is the fix for a progress bar that snapped to 100% and vanished before you could see it get there."),
    ],
    commits: [
      { hash: "1793dea", subject: "new loader animation" },
      { hash: "e6c9631", subject: "no fake delay for loading" },
      { hash: "94b7965", subject: "smooth animation to finished load" },
      { hash: "1bf247c", subject: "let animations finish" },
    ],
  },
  {
    slug: "simulations-to-worker",
    title: "Getting the simulations off the main thread",
    date: "2025-06-04",
    tags: ["performance", "predictions", "technical"],
    summary: "Monte Carlo simulations moved into a web worker. The first of what became four workers.",
    body: [
      text(
        "Monte Carlo simulation is embarrassingly parallel and completely blocking if you run it where the UI lives. Ten thousand simulated tournaments on the main thread is a frozen page and a browser 'this tab is unresponsive' warning.",
      ),
      text(
        "'offload simulation to worker' moved it out, followed immediately by 'decrease batch size' - the worker posts progress back as it goes, and the batch size is the tradeoff between message overhead and a progress bar that actually moves.",
      ),
      text(
        "This became the pattern. There are now four worker hooks in `src/hooks/`: Elo simulation, tournament prediction, prediction history, and auto-seeding tournaments. Anything expensive goes off the main thread, which is the rule that makes a thick client viable at all.",
      ),
    ],
    commits: [
      { hash: "95594bb", subject: "offload simulation to worker" },
      { hash: "0c44bc6", subject: "decrease batch size" },
      { hash: "b94b696", subject: "increase simulation iterations" },
    ],
  },
  {
    slug: "player-page-rebuild",
    title: "Rebuilding the player page, and giving admin tabs",
    date: "2025-06-03",
    tags: ["design"],
    summary: "A new player page built alongside the old one and swapped in, plus a range slider for the score timeline.",
    body: [
      text(
        "The player page had accumulated: Elo history, a games table, a points distribution, opponent stats, pending tournament games, achievements. Each addition was reasonable and the result was a very long scroll.",
      ),
      text(
        "The rebuild was done as a parallel page - 'New page init with header', 'tabs set up', 'graphs in overview', then 'replace old page'. Building next to the thing you are replacing rather than inside it means you can compare them, and means the old one keeps working while you go.",
      ),
      text(
        "The admin page got the same treatment ('tabs in admin page'), and the Elo timeline got a range slider so you can zoom into a month instead of squinting at two years of history. Mobile padding was reduced across the page in the same batch - the app is used on a phone next to a table, and every wasted pixel of padding costs a row of data.",
      ),
    ],
    commits: [
      { hash: "9fbbf10", subject: "New page init with header" },
      { hash: "a0f0708", subject: "tabs set up" },
      { hash: "527f915", subject: "replace old page" },
      { hash: "e4f9a37", subject: "tabs in admin page" },
      { hash: "a269300", subject: "range slider for player score timeline" },
    ],
  },
  {
    slug: "game-scores",
    title: "Scores, not just winners",
    date: "2025-05-30",
    tags: ["new-feature"],
    summary:
      "For a year the app recorded who won. It now records 11-9, 11-7, 9-11 - and lets you fix it when you typo.",
    body: [
      text(
        "The original data model was two player ids and a winner. That is all Elo needs, and it threw away the thing everyone actually talks about afterwards.",
      ),
      text("Adding scores took a week, mostly spent on the input:"),
      list(
        "'add game flow first iteration' - a multi-step flow rather than one form.",
        "'Add game scores', then 'numbered points' and 'support numbered points in simulations'.",
        "'improved points setting for mobile', 'improve mobile add game ux', 'sticky top and bottom in add game', 'empty input fields' - entering four or six numbers on a phone, standing up, holding a bat.",
        "'fix validation for optional set points' - not every game is played to three sets, so most of the fields have to be optional without letting nonsense through.",
      ),
      text(
        "Then 'Edit game score', with 'dont save unchanged score' right behind it - in an event-sourced system every save is a permanent event, so a no-op save writes a permanent record of nothing happening.",
      ),
      text(
        "Scores unlocked a lot of what came later: the opponent scores graph, close-call achievements, Marathon Set, the serve tracker, and a prediction model that can reason about points and sets rather than just wins.",
      ),
    ],
    commits: [
      { hash: "5d6e655", subject: "add game flow first iteration" },
      { hash: "4e91dbf", subject: "Add game scores" },
      { hash: "7eed069", subject: "numbered points" },
      { hash: "200ec21", subject: "fix validation for optional set points" },
      { hash: "778faef", subject: "Edit game score" },
      { hash: "a762a9f", subject: "dont save unchanged score" },
    ],
  },
  {
    slug: "discard-degrading-k",
    title: "The K-factor experiment that did not survive",
    date: "2025-04-10",
    tags: ["experiment", "technical"],
    summary:
      "Reducing Elo's K-factor for experienced players sounded right, ran for two months, and was reverted. Its parameters are still in the signature.",
    body: [
      text(
        "In Elo, K controls how much a single game moves your rating. Chess federations lower it for established players so that one bad Tuesday does not undo a year. In February 2025 the same idea landed here: past 200 games, K decayed from 32 towards a floor of 10.",
      ),
      text("In April it was removed."),
      text(
        "The reason is that an office league is not a chess federation. A decaying K freezes the top of the table: the people with the most games become the hardest to move, so a newcomer who is genuinely better has to grind through games that barely register. It made the leaderboard more stable and less true.",
      ),
      text(
        "A fossil survives. `Elo.calculateELO` still takes `winnersGames` and `losersGames` parameters, and still ignores them:",
      ),
      quote(
        "static calculateELO(winnersElo: number, losersElo: number, winnersGames: number = 0, losersGames: number = 0)",
        "client-db/elo.ts, present tense",
      ),
      text("Kept in case the idea comes back. Two months of production data says it should not."),
    ],
    commits: [
      { hash: "14e8c20", subject: "degrading k over time" },
      { hash: "b053491", subject: "discard reducing K over amount of games" },
      { hash: "b50c12e", subject: "simulate 10 000 tournaments" },
    ],
  },
  {
    slug: "imagekit-and-easter",
    title: "Profile pictures move out, and the app gets a bunny",
    date: "2025-04-01",
    tags: ["technical", "design"],
    summary:
      "Images moved to ImageKit after living in the database, and the theme system got its second holiday.",
    body: [
      text(
        "Profile pictures had been stored in the database, which is why the March cache saga included the commit 'exclude profile picture from cache'. Base64 images in a key-value store with a 64 KiB value limit is not a long-term plan.",
      ),
      text(
        "They moved to ImageKit, with the backend proxying uploads. The migration trail is unusually honest about how these go: 'migrate profile pictures' (twice), 'skimore migrate profile pictures', 'delete old profile pictures', 'remove delete profile picture migration', 'remove migration for skimore'. There is also 'temporarily load images from static frontend instead of db for optio users' - a workaround that shipped to production while the real fix was built.",
      ),
      text(
        "The Easter theme arrived alongside, including a debug easter bunny that was committed and removed the same day. The theme system now has Halloween, Easter, Christmas snowfall, per-office themes, and a stealth mode - all through CSS variables, so a new theme is a colour list rather than a stylesheet.",
      ),
    ],
    commits: [
      { hash: "9d4d3ab", subject: "Image kit hosting" },
      { hash: "ca56f69", subject: "migrate profile pictures" },
      { hash: "9b9145a", subject: "temporarily load images from static frontend instead of db for optio users" },
      { hash: "a6394c4", subject: "Update to easter theme" },
      { hash: "b112b4c", subject: "remove debug easter bunny" },
      { hash: "483a745", subject: "game limit for ranked custom per client" },
    ],
  },
  {
    slug: "event-sourcing",
    title: "Event sourcing: rewriting the truth",
    date: "2025-03-29",
    tags: ["architecture", "technical"],
    summary:
      "The biggest change in the project's history. Tables of players and games became an append-only event log, projected in the browser. 71 files, +1480/-993.",
    body: [
      text(
        "Before: the database had players and games, and the frontend read them. Deleting a game deleted a row. Renaming a player rewrote a name, and any game that referenced the old one was quietly broken. There was no way to answer 'what did the leaderboard look like in November?' because November was gone.",
      ),
      text(
        "After: the database has events. `PLAYER_CREATED`, `GAME_CREATED`, `TOURNAMENT_SIGNUP`, and so on - appended, never updated. State is what you get when you replay them.",
      ),
      text("The migration ran over six days in a sequence that is readable as a plan:"),
      list(
        "'init backend for storing and retrieving events' - the append-only store.",
        "'init frontend fetch and store events', then 'init frontend to read from events and reduce states form events'.",
        "'frontend add player as event', 'frontend add games as event', 'frontend tournament signup and cancel signup as events' - one write path at a time.",
        "'Frontend validators' - with the server reduced to storing opaque payloads, validation had to move to the client that creates them.",
        "'init most frontend pages support player id' - the change that touched everything.",
        "'rename from reducer to projector' - the vocabulary catching up with the design.",
      ),
      text(
        "The player-name-to-id switch was the painful part. Names had been primary keys since the first commit, and every reference had to move to an id while existing data was translated in place. There are commits called 'Tournament translate names to ids TEMP' and 'Dont replace names with ids' - the second one reverting an over-eager version of the first.",
      ),
      text(
        "It also gave the project the architecture it still has: a thin server that stores and broadcasts events, and a thick client that projects them into leaderboards, seasons, predictions, achievements and hall-of-fame scores. Every feature since - seasons replaying a date window, achievements evaluated against history, prediction timelines, the event backup button - exists because the log is the truth and everything else is a view of it.",
      ),
      text("There is also, briefly, a commit called 'maintenance message'. Not every migration is invisible."),
    ],
    commits: [
      { hash: "f00397e", subject: "init backend for storing and retrieving events" },
      { hash: "a914143", subject: "init frontend to read from events and reduce states form events" },
      { hash: "e528d3e", subject: "Frontend validators" },
      { hash: "d8d3d76", subject: "init most frontend pages support player id" },
      { hash: "76fe6cb", subject: "rename from reducer to projector" },
      { hash: "45f1f4c", subject: "Merge pull request #11 from rikadr/event-sourced" },
      { hash: "1dc3454", subject: "maintenance message" },
    ],
  },
  {
    slug: "custom-themes",
    title: "Themeable everything",
    date: "2025-03-19",
    tags: ["design", "technical"],
    summary:
      "Colours moved into CSS variables with opacity support, so a theme is a list of values instead of a stylesheet.",
    body: [
      text(
        "By March 2025 there were a Halloween theme, a Skimore theme and a default, each implemented by scattering conditionals through components. Adding a fourth was going to be worse than adding the third.",
      ),
      text(
        "The theme system replaced that with CSS variables exposed through Tailwind: `primary`, `secondary` and `tertiary`, each with a text and a background colour. Components use `bg-primary-background` and `text-primary-text` and never learn which theme is active.",
      ),
      text(
        "The detail that made it work is opacity support. A naive `var(--color)` breaks Tailwind's `/50` opacity modifier, which is used everywhere for borders and dividers. The config wraps each variable in a function that returns `rgb(var(...))` or `rgba(var(...), value)` depending on whether an opacity was requested - so `border-primary-text/50` keeps working.",
      ),
      text(
        "Four commits of 'theme corrections' followed, fixing hardcoded colours across the leaderboard, the player page and the admin page. This is now the first rule in the frontend guidelines: never hardcode a colour.",
      ),
    ],
    commits: [
      { hash: "6c52606", subject: "custom themes" },
      { hash: "3ae63b6", subject: "improvements to custom theming and support opacity" },
      { hash: "827b4bd", subject: "improved leaderboard theme support" },
      { hash: "29eff3b", subject: "more theme corrections" },
    ],
  },
  {
    slug: "multi-client",
    title: "One codebase, many offices",
    date: "2025-03-15",
    tags: ["architecture", "new-feature"],
    summary:
      "A client config layer gave each organisation its own theme, logo, title, favicon, tournaments and ranked-game threshold.",
    body: [
      text(
        "The app was built for one office. Then a second one wanted it, and the difference between 'our tool' and 'a tool' turned out to be a config object.",
      ),
      text("`client-config` gives each client:"),
      list(
        "A theme and a logo.",
        "A custom page title and favicon, via react-helmet.",
        "Its own tournaments - 'tournaments are now client specific'.",
        "Its own threshold for how many games you must play to appear ranked, which was later tuned per client many times over.",
      ),
      text(
        "There are six client configs in the repo today: Optio, Skimore, Asplan Viak, DeepInsight, Tryvann and a guest client, plus one for local development. Each one arrived with its own small trail of commits - a logo that broke in Safari, a theme that needed contrast fixes, a data migration for existing games.",
      ),
      text(
        "The per-client ranked threshold is the one that gets adjusted most. Search the history for 'game limit for ranked' and you will find it moved between 5, 7, 10, 15, 20, 25 and 30 across different clients over two years. It is not a technical parameter - it is the answer to 'how many games before we are willing to rank you', and that answer depends entirely on how much your office plays.",
      ),
    ],
    commits: [
      { hash: "c7d10a6", subject: "client config" },
      { hash: "4a10eec", subject: "Custom title and favicon" },
      { hash: "a7c9d75", subject: "tournaments are now client specific" },
      { hash: "8914fed", subject: "add skimore theme" },
      { hash: "e1daad1", subject: "fix skimore logo for safari browser" },
      { hash: "483a745", subject: "game limit for ranked custom per client" },
    ],
  },
  {
    slug: "64-kib-cache-saga",
    title: "64 KiB at a time: a day spent inside Deno KV's value limit",
    date: "2025-03-09",
    tags: ["technical", "performance", "bug-fix"],
    summary:
      "A server-side cache that had to be chopped into 63 KB chunks, and the eleven-commit afternoon of tuning it took.",
    body: [
      text(
        "The client needed one blob of everything. Computing that blob on every request was wasteful, so it got cached in Deno KV. Deno KV caps a single value at 64 KiB. The blob was much bigger than that.",
      ),
      text("So the cache learned to split itself:"),
      quote(
        "private readonly MAX_CACHE_BATCH_SIZE = 64_000 - 1_000; // Max value size of 64 KiB, I minus some overhead for metadata",
        "client-db-cache.ts, March 2025",
      ),
      text(
        "Each batch is written under an indexed key and carries `{ index, total, time, value }`; reading means walking indices until one comes back empty, then concatenating. It works. It is also a small distributed system where there was previously a variable.",
      ),
      text("What followed, in one afternoon, in order:"),
      list(
        "'client db cache' - the 102-line implementation.",
        "'debug cache sizes', 'reduce cache max size', 'smaller cache batch', 'bigger cache size', '50 000 batch size', 'reduce cache size', 'debug logs', 'debug logs and reduce cache size'.",
        "'exclude profile picture from cache' - the actual problem. Base64 profile pictures were most of the payload.",
        "'remove debug logs'.",
      ),
      text(
        "The postscript writes itself: profile pictures moved to ImageKit three weeks later, the cache was deleted entirely in August 2025, and Deno KV itself was replaced by SQL in June 2026. Every layer of that afternoon is gone. The comment about metadata overhead is the kind of thing you only write once.",
      ),
    ],
    commits: [
      { hash: "c7747ab", subject: "client db cache" },
      { hash: "529a43d", subject: "debug cache sizes" },
      { hash: "5bf23f5", subject: "50 000 batch size" },
      { hash: "8822196", subject: "exclude profile picture from cache" },
      { hash: "5362ee5", subject: "remove debug logs" },
    ],
  },
  {
    slug: "group-play",
    title: "Group play",
    date: "2025-02-26",
    tags: ["new-feature", "tournaments"],
    summary: "A group stage before the bracket, so a tournament is worth showing up to even if you lose early.",
    body: [
      text(
        "A pure knockout bracket gives half the field exactly one game. Group play fixes that: everyone plays several games in a group, and the group results seed the bracket.",
      ),
      text(
        "The hard part is group distribution. With an arbitrary number of signups you need groups of near-equal size, seeded so the strong players do not all land together, and it has to stay sensible when someone drops out an hour before. 'improved group distribution algorythm' and 'refactor grop distribution logic' are both in the history, spelling included.",
      ),
      text(
        "There is also an override for group size, added for a specific tournament and then hidden when not needed - 'hide group size adjustment stuff if not needed'. Tournament config has a way of accumulating options that matter once.",
      ),
    ],
    commits: [
      { hash: "bdbb82f", subject: "group play v1" },
      { hash: "317d964", subject: "indicate skipped group game" },
      { hash: "0d2145e", subject: "improved group distribution algorythm" },
      { hash: "6297d0c", subject: "refactor grop distribution logic" },
      { hash: "a743bcb", subject: "hide group size adjustment stuff if not needed" },
    ],
  },
  {
    slug: "future-elo-confidence",
    title: "Predicting your future Elo, with a confidence curve",
    date: "2025-02-05",
    tags: ["predictions", "technical"],
    summary:
      "Simulating where your rating is heading - and the two-year argument about how confident a prediction should be.",
    body: [
      text(
        "'simulate future elo ish' is a good name for a first attempt. The idea: take your recent results, simulate forward, and show where your rating is likely to end up as a band rather than a number.",
      ),
      text(
        "The interesting problem is confidence. A prediction built on your last three games should be held loosely; one built on two hundred should not. But recent games also matter more than old ones, so the weighting has to decay - and how fast it decays is a value judgement dressed as a parameter.",
      ),
      text("Search the history for 'confidence' and you get a two-year conversation:"),
      list(
        "'adjust confidence calculation in future elo prediction' (Feb 2025)",
        "'Update simulation confidence calculation', 'two layer simulation' (Feb 2025)",
        "'increase halflife of confidence decay in simulation' (Oct 2025)",
        "'update confidence calculation weights' (Oct 2025)",
        "'adjust confidence weights' (May 2026)",
        "'Improve confidence curve with half-life and exponent parameters' (Jun 2026)",
      ),
      text(
        "The last one is the resolution: rather than hard-coded weights, the curve is defined by a half-life and an exponent, which can be reasoned about and tuned without rewriting the maths. Also from this era: 'show confidence over time', because a confidence number is much easier to trust once you can see it grow as you play.",
      ),
    ],
    commits: [
      { hash: "81da282", subject: "simulate future elo ish" },
      { hash: "1afc118", subject: "adjust confidence calculation in future elo prediction" },
      { hash: "7646b33", subject: "two layer simulation" },
      { hash: "e626750", subject: "show confidence over time" },
      { hash: "21d3d63", subject: "Improve confidence curve with half-life and exponent parameters (#72)" },
    ],
  },
  {
    slug: "simulations-page",
    title: "A page for the what-ifs",
    date: "2025-01-29",
    tags: ["new-feature", "predictions"],
    summary:
      "The speculative tools got their own home, away from the leaderboard - which is where every experiment has landed since.",
    body: [
      text(
        "Monte Carlo charts and expected-wins calculations do not belong next to the standings. The standings are a fact; a simulation is an argument.",
      ),
      text(
        "So the simulations got a page, with its own navigation. It has since become the app's back room: expected leaderboard, individual points, win/loss, the player network, and a playable pong game all live there. If a feature is interesting but not authoritative, that is where it goes.",
      ),
      text(
        "The Monte Carlo work that started it, three weeks earlier, produced one genuinely nice detail - a candlestick chart for simulated rating ranges. Borrowing a visualisation from finance to show a distribution of possible Elo outcomes is exactly the right amount of over-engineering.",
      ),
    ],
    commits: [
      { hash: "860fdd1", subject: "separate simulations page" },
      { hash: "8bddf53", subject: "expected wins simulations" },
      { hash: "32648b1", subject: "monte carlo simulation graph first version" },
      { hash: "4fe9507", subject: "tweak candle stick chart" },
      { hash: "b64f2c2", subject: "move monte carlo to simulation class" },
    ],
  },
  {
    slug: "tournaments-launch",
    title: "Tournaments, seeding, skips and confetti",
    date: "2024-11-24",
    tags: ["new-feature", "tournaments", "fun"],
    summary: "A bracket, a signup flow, and a week of tuning how much confetti is too much confetti.",
    body: [
      text(
        "A leaderboard measures the long run. A tournament produces an evening. Tournaments went from 'Tournament init' to a working signup flow in about a week.",
      ),
      text(
        "The bracket brought its own problems. Seeding, so the top two do not meet in round one. Skips, for when someone does not show up - which needed to be reversible and, a year later, needed to become an event so predictions could account for it. A tree view with a list toggle, defaulting based on screen width, because a bracket on a phone is mostly horizontal scrolling.",
      ),
      text(
        "Small touches that made it feel finished: scrolling to and wiggling the game you just played, showing pending tournament games in the add-game page so you do not have to remember who you owe a match, and navigating straight to the tournament after adding a game.",
      ),
      text(
        "And the confetti. 'confetti fun', then 'fun confetti adding players', then 'reduce confetti', then 'less konfetti'. Two commits to add it and two to turn it down. It is still there.",
      ),
    ],
    commits: [
      { hash: "4c5c091", subject: "Tournament init" },
      { hash: "b79aac8", subject: "update tournament seeding, and fix skip" },
      { hash: "f7787da", subject: "tree list switch" },
      { hash: "6756786", subject: "signup finished" },
      { hash: "52458e0", subject: "scroll to and wiggle in tournament" },
      { hash: "37ccf90", subject: "confetti fun" },
      { hash: "99a9d5d", subject: "less konfetti" },
    ],
  },
  {
    slug: "halloween-theme",
    title: "The app gets a costume",
    date: "2024-10-29",
    tags: ["design", "fun"],
    summary: "A Halloween theme with pumpkin logos - the first seasonal skin, and the start of the whole theme system.",
    body: [
      text(
        "The first theme was a Halloween theme, complete with a pumpkin version of the logo swapped in by the nav menu. It was implemented the direct way: conditionals in components, hardcoded colours, a different image import.",
      ),
      text(
        "It is also where the theme system started. 'Default theme' was added, reverted, and reapplied over two days - the sign of someone discovering that 'theme' needs to mean something more structured than 'a different set of colours in the components'. Five months later that turned into CSS variables and a real theming layer.",
      ),
      text(
        "There are now Halloween pumpkins, an Easter logo, Christmas snowfall via `react-snowfall`, per-office themes, and a stealth mode. The nav menu still special-cases two of them by hand, which is the honest residue of where this began.",
      ),
    ],
    commits: [
      { hash: "80439ab", subject: "Halloween theme" },
      { hash: "0e3164c", subject: "pumpkin images theme" },
      { hash: "a260613", subject: "Default theme" },
      { hash: "0dc7c7c", subject: 'Revert "Default theme"' },
      { hash: "a190747", subject: 'Reapply "Default theme"' },
    ],
  },
  {
    slug: "farmer-score",
    title: "The Farmer Score: a feature that lived four days",
    date: "2024-10-28",
    tags: ["experiment", "fun"],
    summary:
      "A metric for how much you were farming easy opponents. Added, rewritten three times, given a historical view, and deleted.",
    body: [
      text(
        "Elo has a known exploit in a small league: find someone below you, beat them repeatedly, bank the points. It is not cheating, exactly. It is farming.",
      ),
      text("So the app measured it. Over four days:"),
      list(
        "24 Oct - 'farming score', 44 lines, a column on the leaderboard.",
        "24 Oct - 'update farmer score', then 'rewrite farmer score', then 'tweak farmer score'.",
        "27 Oct - 'update farmer score' again, 'fix broker farmer score rounding', 'update farmer explanation example' - it needed an explanation, which is usually a warning sign.",
        "27 Oct - 'historical farmer score' and a dedicated page.",
        "28 Oct - 'remove farmer score'. 142 lines deleted, including the page.",
      ),
      text(
        "The metric worked. The problem was social: a public number labelling colleagues as farmers turns a friendly leaderboard into an accusation, and no amount of rounding fixes that.",
      ),
      text(
        "The underlying question was real, though, and it kept coming back in better forms - the player network showing who plays whom, the Player Diversity chart in the admin page, Variety Player and Community Builder achievements, and the expected leaderboard that simulates a fair schedule. Same concern, reframed from 'you are farming' to 'play more people, it is more fun'. That framing shipped and stayed.",
      ),
    ],
    commits: [
      { hash: "2c6a73d", subject: "farming score" },
      { hash: "1069ef0", subject: "rewrite farmer score" },
      { hash: "70656e1", subject: "fix broker farmer score rounding" },
      { hash: "853aa4f", subject: "historical farmer score" },
      { hash: "659d95b", subject: "remove farmer score" },
    ],
  },
  {
    slug: "thick-client-migration",
    title: "The great migration to the thick client",
    date: "2024-10-14",
    tags: ["architecture", "performance"],
    summary:
      "The leaderboard calculation was deleted from the backend and rebuilt in the browser. The decision the whole app now rests on.",
    body: [
      text(
        "For the first five months the server did the thinking. `DenoServer/leaderboard/leaderboard.ts` - 138 lines - loaded every player and game, replayed the Elo, and returned a ranked list. The frontend rendered whatever it got. Every page that wanted a slightly different cut of the data needed a new endpoint.",
      ),
      text("Over four days in October 2024, that inverted:"),
      list(
        "'Add client db endpoint' - one endpoint that returns everything.",
        "'client db context' - a React context holding the whole dataset.",
        "'Leaderboard and player summary pages use client db' - and in the same commit, `DenoServer/leaderboard/` deleted. 138 lines of backend gone, 128 lines of `frontend/wrappers/leaderboard.ts` in its place.",
        "'players comparison use client db', 'remove unused backend code'.",
      ),
      text(
        "That commit also created `tennis-table.ts` - 23 lines at the time - which is still the entry point to every projection in the app.",
      ),
      text(
        "Why it was the right call: the data is small (a few thousand games), the derived views are many and varied, and the calculations are pure. Ship the data once and the client can answer any question about it without a round trip. Adding the expected leaderboard, seasons, achievements or the player network later required no backend work at all.",
      ),
      text(
        "What it cost: a real startup wait on a cold cache, and the two years of caching work that followed - browser-side calculation caches, a server cache that had to be chunked, a localStorage event cache, and four web workers. Every one of those exists to pay for this decision.",
      ),
    ],
    commits: [
      { hash: "01d57a5", subject: "Add client db endpoint" },
      { hash: "4bef707", subject: "client db context" },
      { hash: "045c03e", subject: "Leaderboard and player summary pages use client db" },
      { hash: "3a5ed4b", subject: "players comparison use client db" },
      { hash: "ad7b6e8", subject: "remove unused backend code" },
    ],
  },
  {
    slug: "camera-page",
    title: "Take a selfie for your avatar",
    date: "2024-10-16",
    tags: ["new-feature", "fun"],
    summary: "A webcam page and a crop editor, so a profile picture is thirty seconds of work instead of a file upload.",
    body: [
      text(
        "Profile pictures had existed since June, uploaded as files. Almost nobody had one, because uploading a photo of yourself from a work laptop involves finding a photo of yourself on a work laptop.",
      ),
      text(
        "The camera page removes the step: `react-webcam` to take the shot, `react-avatar-edit` to crop it, done. Faces appeared on the leaderboard within a day.",
      ),
      text(
        "The follow-ups are the usual reality of images: 'up default image quality', an 'image fallback' for players without one, a default question-mark avatar, and 'Dont select profile image fallback text' - because the initials rendered as text and double-tapping a face on a phone selected them.",
      ),
    ],
    commits: [
      { hash: "5772224", subject: "Camera page" },
      { hash: "574a8da", subject: "avatar editor" },
      { hash: "af07183", subject: "up default image quality" },
      { hash: "ab4c2a4", subject: "default profile picture to question mark" },
      { hash: "92c192e", subject: "Dont select profile image fallback text" },
    ],
  },
  {
    slug: "websockets",
    title: "The table updates itself",
    date: "2024-09-26",
    tags: ["new-feature", "technical"],
    summary:
      "WebSockets, so a game entered on one phone appears on every other screen immediately. Including the wall display.",
    body: [
      text(
        "The app is used by several people standing around the same table. Someone enters a result on their phone and everyone else is looking at a stale leaderboard until they pull to refresh.",
      ),
      text(
        "The fix, over three commits: 'init socket example', then a client manager with broadcast, then 'Reload clients on data change'. When an event is written the server broadcasts to every connected client, which invalidates its queries and re-renders.",
      ),
      text(
        "Then the part nobody plans for. 'Socket retries' two days later, 'ws heartbeat' and 'up heartbeat interval' in November, 'reduce heartbeat time to 10 seconds', 'add shutdown cleanup closing all connections', 'update web socket to always execute on every message', and 'improve web socket handling' the following August. A long-lived connection to a browser tab that might be asleep, on a laptop that might be in a bag, is a genuinely hard thing to keep honest.",
      ),
      text(
        "The channel has paid for itself many times since. It carries cache invalidation when an admin edits an event, and it is what makes the live game page and the TV overlay work without polling.",
      ),
    ],
    commits: [
      { hash: "d7efc06", subject: "init socket example" },
      { hash: "fe5eb48", subject: "ws clients manager with broadcast" },
      { hash: "8216fd6", subject: "Reload clients on data change" },
      { hash: "838a974", subject: "Socket retries" },
      { hash: "9980749", subject: "ws heartbeat" },
      { hash: "a95d756", subject: "add shutdown cleanup closing all connections" },
    ],
  },
  {
    slug: "one-elo-calculator",
    title: "One Elo calculator to rule them all",
    date: "2024-06-14",
    tags: ["technical"],
    summary:
      "The Elo maths was extracted into a single reusable function. Every rating, prediction and simulation since runs through it.",
    body: [
      text(
        "Elo had been computed inline where it was needed. That is fine while there is one caller, and there were about to be many: the leaderboard, per-game point deltas, player streaks, and eventually seasons, simulations, predictions and hall-of-fame scores.",
      ),
      text(
        "'rewrite game elo calculation to reusable eloCalculator function' pulled it into one place. The signature it settled on is the important bit - it takes the games, the players, and an optional `onGameResult` callback invoked for each game with the running player map and the points won.",
      ),
      text(
        "That callback is why the same function serves every consumer. The leaderboard ignores it and reads the final map. The player timeline uses it to record a data point per game. Seasons use it to accumulate within a window. Achievements use it to notice the moment a streak breaks. One replay, many observers - and no possibility of two features disagreeing about what your rating is.",
      ),
      text(
        "Also this week: player streaks, and three consecutive commits fighting CORS ('add Access-Control-Allow-Origin to cors headers', 'allow all headers', 'add content type header to request'). Some things never change.",
      ),
    ],
    commits: [
      { hash: "abade22", subject: "rewrite game elo calculation to reusable eloCalculator function" },
      { hash: "093e45b", subject: "Add player streaks" },
      { hash: "30b3f24", subject: "add Access-Control-Allow-Origin to cors headers" },
    ],
  },
  {
    slug: "accounts-and-profiles",
    title: "Accounts, roles and profile pictures",
    date: "2024-06-10",
    tags: ["new-feature", "admin", "technical"],
    summary: "Sign-up, JWTs, resource-action permission checks, and the first profile pictures.",
    body: [
      text(
        "Until June anyone could do anything, including deleting players. The auth work added sign-up and account deletion, JWT sessions with automatic logout when the token expires, and resource-action permission checks rather than a single admin boolean.",
      ),
      text(
        "Two details worth keeping. 'no longer change your own role' - the check that stops an admin from removing their own access, which is the kind of thing you only add after doing it once. And 'include rikard as default-admin', a hardcoded bootstrap admin, which survived until 'disable pre-allocated admin users' five months later.",
      ),
      text(
        "Profile pictures arrived in the same batch, initially stored in the database. That decision echoed for a year: it is why the March 2025 cache had to exclude them, and why they eventually moved to ImageKit.",
      ),
    ],
    commits: [
      { hash: "bda14b5", subject: "sign up and delete user" },
      { hash: "3ab5db0", subject: "automatic log out when expired jwt" },
      { hash: "7c7bfee", subject: "resource-action checks" },
      { hash: "444369a", subject: "no longer change your own role" },
      { hash: "c442814", subject: "profile pictures" },
      { hash: "cc23240", subject: "disable pre-allocated admin users" },
    ],
  },
  {
    slug: "unranked-players",
    title: "The last place problem",
    date: "2024-05-23",
    tags: ["new-feature", "design"],
    summary:
      "Someone has to be last, and putting a new colleague there on their first day is a good way to make them stop playing.",
    body: [
      text(
        "A fresh Elo rating is 1000 and your first game against a decent player takes points off it. So a new player's experience was: join, lose, appear at the bottom of a public leaderboard with your name and your face on it.",
      ),
      text(
        "The fix was a ranked threshold. Play a handful of games and you are on the leaderboard; before that you are listed as unranked with a games-played count so you can see how close you are. 'last place for everyone' and 'Hide counts of matches played' are from the same days - working out how much to show while a rating is still meaningless.",
      ),
      text(
        "That threshold is now per-client config and has been retuned constantly - somewhere between 5 and 30 games depending on the office. Two years later there is a 'Ranked' achievement for crossing it, which turns the barrier into a goal. Same mechanic, inverted framing.",
      ),
    ],
    commits: [
      { hash: "5999211", subject: "unranked players" },
      { hash: "7684966", subject: "last place for everyone" },
      { hash: "cb50d45", subject: "Hide counts of matches played" },
      { hash: "ec6ca52", subject: "add games count to unranked players" },
      { hash: "555deab", subject: 'Add "Ranked" achievement for reaching the leaderboard (#89)' },
    ],
  },
  {
    slug: "init",
    title: "Init: 265 lines and an Elo formula",
    date: "2024-05-09",
    tags: ["technical", "architecture"],
    summary:
      "The first day: a Deno server, a Deno KV database, players, games, and fifty lines of Elo. No frontend yet.",
    body: [
      text(
        "The first commit is called 'Init' and is 265 lines across eight files: a Deno server on Oak, `db.ts` (one line), and routes for players and games.",
      ),
      text(
        "Later the same day, 'add elo ranking' - 62 lines that are still recognisably the heart of the app two years later:",
      ),
      quote("const K = 32;\nconst INITIAL_ELO = 1000;", "DenoServer/elo/elo.ts, 9 May 2024"),
      text(
        "`getAllPlayersELO` loaded every player, seeded them at 1000, replayed every game in order applying the standard Elo update, and sorted the result. Recomputing the entire league's history on every request, on the server, keyed by player name.",
      ),
      text(
        "Almost every architectural decision visible there has since been reversed. The calculation moved to the browser (Oct 2024), names became ids and the tables became an event log (Mar 2025), and Deno KV became SQL (Jun 2026).",
      ),
      text(
        "What survived is `K = 32`, `INITIAL_ELO = 1000`, and the shape of `calculateELO` - expected score from the rating difference over a divisor of 400, then a K-weighted update. It is now `Elo.calculateELO` in `client-db/elo.ts` and the arithmetic is line-for-line the same. Six commits after 'Init' came the first frontend, and three days later the first leaderboard.",
      ),
    ],
    commits: [
      { hash: "6309dc3", subject: "Init" },
      { hash: "280feed", subject: "add elo ranking" },
      { hash: "7591d53", subject: "Correctly register elo routes" },
      { hash: "bc5f0c7", subject: "init frontend" },
      { hash: "617f364", subject: "wip leaderboard" },
    ],
  },
];

/** Newest first. */
export function getChangelogPosts(): ChangelogPost[] {
  return [...CHANGELOG_POSTS].sort((a, b) => b.date.localeCompare(a.date));
}

export function getChangelogPost(slug: string): ChangelogPost | undefined {
  return CHANGELOG_POSTS.find((post) => post.slug === slug);
}

/** How many posts carry each tag. Used for the counts in the filter row. */
export function changelogTagCounts(): Map<ChangelogTag, number> {
  const counts = new Map<ChangelogTag, number>();
  CHANGELOG_POSTS.forEach((post) => {
    post.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  });
  return counts;
}
